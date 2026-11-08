"""Human-gated model release acceptance; never publishes or promotes a model."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import re
from datetime import datetime
from pathlib import Path

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")

def load(path: str | Path) -> dict:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict): raise ValueError(f"Expected a JSON object: {path}")
    return value

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()

def check_bundle(bundle_dir: Path) -> tuple[dict, list[str]]:
    issues = []
    manifest_path = bundle_dir / "bundle-manifest.json"
    if not manifest_path.is_file(): return {}, ["Missing bundle-manifest.json."]
    manifest = load(manifest_path)
    if manifest.get("schema_version") != "mct.model-bundle.v1": issues.append("Unsupported model bundle schema.")
    init = manifest.get("initialization", {})
    if not isinstance(init, dict) or init.get("weights") != "random": issues.append("Bundle is not verified as random-initialized.")
    files = manifest.get("files")
    if not isinstance(files, list) or not files: issues.append("Bundle manifest has no artifact file list.")
    else:
        for item in files:
            if not isinstance(item, dict) or not isinstance(item.get("path"), str) or not isinstance(item.get("sha256"), str):
                issues.append("Malformed artifact entry in bundle manifest."); continue
            relative = Path(item["path"])
            if relative.is_absolute() or ".." in relative.parts:
                issues.append(f"Unsafe artifact path in manifest: {item['path']}"); continue
            artifact = (bundle_dir / relative).resolve()
            if bundle_dir.resolve() not in artifact.parents:
                issues.append(f"Artifact escapes bundle directory: {item['path']}"); continue
            if not artifact.is_file(): issues.append(f"Missing bundle artifact: {item['path']}")
            elif sha(artifact) != item["sha256"]: issues.append(f"Artifact hash mismatch: {item['path']}")
    return manifest, issues

def check_review(review: dict) -> list[str]:
    issues = []
    if not isinstance(review.get("review_id"), str) or not review["review_id"].strip(): issues.append("Missing human review_id.")
    if not isinstance(review.get("reviewer"), str) or not review["reviewer"].strip(): issues.append("Missing reviewer identity.")
    timestamp = review.get("reviewed_at")
    try: datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except (AttributeError, ValueError): issues.append("reviewed_at must be an ISO-8601 timestamp.")
    for key in ("data_rights_reviewed", "outputs_reviewed", "safety_reviewed", "unreal_build_verified"):
        if review.get(key) is not True: issues.append(f"Human approval is missing: {key}.")
    evidence = review.get("evidence")
    if not isinstance(evidence, list) or not evidence or any(not isinstance(x, str) or not x.strip() for x in evidence):
        issues.append("At least one human-review evidence reference is required.")
    build_hash = review.get("unreal_build_log_sha256")
    if not isinstance(build_hash, str) or not SHA256_RE.fullmatch(build_hash):
        issues.append("A verified Unreal build log SHA-256 is required.")
    if not isinstance(review.get("limitations"), list) or not review["limitations"]:
        issues.append("Known limitations must be documented (use an explicit list, even if empty is not allowed).")
    return issues

def evaluate(bundle_dir: str | Path, evaluation_path: str | Path, benchmark_path: str | Path,
             review_path: str | Path, policy_path: str | Path, output_path: str | Path) -> dict:
    root = Path(bundle_dir).resolve()
    policy = load(policy_path)
    evaluation = load(evaluation_path)
    benchmark = load(benchmark_path)
    review = load(review_path)
    manifest, issues = check_bundle(root)
    if evaluation.get("schema_version") != "mct.evaluation.v1": issues.append("Unsupported evaluation report schema.")
    if benchmark.get("schema_version") != "mct.task-benchmark.v1": issues.append("Unsupported task benchmark schema.")
    family = manifest.get("model_family")
    if not family or evaluation.get("model_family") != family or benchmark.get("model_family") != family:
        issues.append("Bundle, evaluation and benchmark model families do not match.")
    for key in ("test_loss", "perplexity"):
        value = evaluation.get(key)
        if not isinstance(value, (int, float)) or not math.isfinite(value): issues.append(f"Evaluation {key} is missing or non-finite.")
    if evaluation.get("test_loss", float("inf")) > float(policy.get("max_test_loss", 5.0)):
        issues.append("Held-out test loss exceeds the release-review policy.")
    if evaluation.get("perplexity", float("inf")) > float(policy.get("max_perplexity", 150.0)):
        issues.append("Held-out perplexity exceeds the release-review policy.")
    overall = benchmark.get("overall", {})
    min_examples = int(policy.get("min_benchmark_examples", 50))
    min_rate = float(policy.get("min_overall_pass_rate", 0.85))
    if int(overall.get("examples", 0)) < min_examples: issues.append("Benchmark has too few held-out examples.")
    if float(overall.get("pass_rate", 0.0)) < min_rate: issues.append("Overall benchmark pass rate is below policy.")
    for group_name in ("by_task", "by_language"):
        groups = benchmark.get(group_name, {})
        required_groups = policy.get("required_" + group_name, [])
        if not isinstance(groups, dict): issues.append(f"Benchmark {group_name} must be an object."); continue
        for name in required_groups:
            stats = groups.get(name)
            if not isinstance(stats, dict): issues.append(f"Missing required benchmark group: {name}."); continue
            if int(stats.get("examples", 0)) < int(policy.get("min_group_examples", 5)):
                issues.append(f"Too few benchmark examples for {group_name}.{name}.")
            if float(stats.get("pass_rate", 0.0)) < float(policy.get("min_group_pass_rate", 0.75)):
                issues.append(f"Pass rate below policy for {group_name}.{name}.")
    issues.extend(check_review(review))
    result = {
        "schema_version": "mct.release-acceptance.v1",
        "model_family": family,
        "candidate_for_release_owner_review": not issues,
        "status": "awaiting_release_owner_decision" if not issues else "blocked",
        "automatic_promotion": False,
        "issues": issues,
        "evidence": {
            "bundle_manifest_sha256": sha(root / "bundle-manifest.json") if (root / "bundle-manifest.json").is_file() else None,
            "evaluation_file": str(Path(evaluation_path).name),
            "benchmark_file": str(Path(benchmark_path).name),
            "human_review_id": review.get("review_id")
        },
        "notice": "Passing this gate only makes the candidate eligible for a separate release-owner decision. It does not publish, promote, or certify the model."
    }
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result

def main() -> None:
    parser = argparse.ArgumentParser(description="Check MMD release evidence and human acceptance; never auto-promotes.")
    parser.add_argument("--bundle-dir", required=True)
    parser.add_argument("--evaluation", required=True)
    parser.add_argument("--benchmark", required=True)
    parser.add_argument("--human-review", required=True)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    result = evaluate(args.bundle_dir, args.evaluation, args.benchmark, args.human_review, args.policy, args.output)
    print(json.dumps({k: result[k] for k in ("model_family", "candidate_for_release_owner_review", "status", "issues")}, ensure_ascii=False, indent=2))

if __name__ == "__main__": main()
