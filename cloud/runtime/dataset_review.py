"""Review document-level dataset rights metadata without downloading or ingesting text."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
REQUIRED = ("document_id", "source_url", "source_revision", "language",
            "license_id", "license_url", "attribution", "text_sha256",
            "rights_basis", "collection_method")

def load_allowlist(path: str | Path) -> set[str]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    licenses = value.get("allowed_license_ids") if isinstance(value, dict) else None
    if not isinstance(licenses, list) or any(not isinstance(x, str) or not x.strip() for x in licenses):
        raise ValueError("Allowlist must contain a non-empty-string 'allowed_license_ids' array (an empty array is permitted).")
    return {x.strip() for x in licenses}

def is_https_url(value: object) -> bool:
    if not isinstance(value, str): return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)

def review(input_path: str | Path, output_path: str | Path, allowlist_path: str | Path,
           target_languages: list[str] | None = None) -> dict:
    allowed = load_allowlist(allowlist_path)
    path = Path(input_path)
    raw = path.read_bytes()
    try: decoded = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc: raise ValueError("Source manifest must be UTF-8 JSONL.") from exc
    targets = set(target_languages or [])
    seen: set[str] = set()
    records = []
    errors = []
    language_counts: Counter[str] = Counter()
    license_counts: Counter[str] = Counter()
    for line_no, line in enumerate(decoded.splitlines(), 1):
        if not line.strip(): continue
        try: item = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append({"line": line_no, "document_id": None, "issues": [f"Invalid JSON: {exc.msg}"]})
            continue
        if not isinstance(item, dict):
            errors.append({"line": line_no, "document_id": None, "issues": ["Record must be a JSON object."]})
            continue
        doc_id = item.get("document_id")
        issues = []
        if not isinstance(doc_id, str) or not doc_id.strip(): issues.append("Missing document_id.")
        elif doc_id in seen: issues.append("Duplicate document_id.")
        else: seen.add(doc_id)
        for field in REQUIRED:
            if field == "document_id": continue
            value = item.get(field)
            if not isinstance(value, str) or not value.strip(): issues.append(f"Missing {field}.")
        if not is_https_url(item.get("source_url")): issues.append("source_url must be an HTTPS URL.")
        if not is_https_url(item.get("license_url")): issues.append("license_url must be an HTTPS URL.")
        digest = item.get("text_sha256")
        if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest): issues.append("text_sha256 must be a lowercase SHA-256 hex digest.")
        language = item.get("language")
        if isinstance(language, str) and language.strip():
            language = language.strip().lower()
            language_counts[language] += 1
            if targets and language not in targets: issues.append(f"Language '{language}' is outside the configured target set.")
        license_id = item.get("license_id")
        if isinstance(license_id, str) and license_id.strip():
            license_counts[license_id] += 1
            if license_id not in allowed: issues.append(f"License '{license_id}' is not in the explicitly configured allowlist.")
        if item.get("public_redistribution") is not True:
            issues.append("public_redistribution must be explicitly true for a public training corpus.")
        if item.get("source_rights_verified") is not True:
            issues.append("Underlying source rights are not explicitly marked verified.")
        records.append({"line": line_no, "document_id": doc_id if isinstance(doc_id, str) else None,
                        "candidate_for_human_review": not issues, "issues": issues})
        if issues: errors.append({"line": line_no, "document_id": doc_id if isinstance(doc_id, str) else None, "issues": issues})
    total = len(records) + sum(1 for x in errors if x.get("document_id") is None)
    eligible = bool(records) and not errors and len(records) > 0
    report = {
        "schema_version": "mct.dataset-source-review.v1",
        "input_sha256": hashlib.sha256(raw).hexdigest(),
        "manifest_records": total,
        "valid_records": sum(1 for x in records if x["candidate_for_human_review"]),
        "rejected_records": len(errors),
        "language_counts": dict(sorted(language_counts.items())),
        "license_counts": dict(sorted(license_counts.items())),
        "allowlisted_license_ids": sorted(allowed),
        "target_languages": sorted(targets),
        "candidate_manifest_complete": eligible,
        "review_status": "needs_human_rights_approval" if eligible else "rejected_or_incomplete",
        "records": records,
        "issues": errors,
        "important_notice": "This automated metadata check is not legal advice and does not grant rights. A human must inspect each source's actual terms and underlying document rights before ingestion. No text was downloaded or ingested."
    }
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report

def main() -> None:
    parser = argparse.ArgumentParser(description="Audit document-level rights metadata; never downloads or ingests dataset text.")
    parser.add_argument("--input", required=True, help="UTF-8 JSONL source metadata manifest.")
    parser.add_argument("--output", required=True, help="JSON review report output.")
    parser.add_argument("--allowlist", required=True, help="JSON file with explicitly selected allowed_license_ids.")
    parser.add_argument("--target-languages", default="fa,en,de,fr,es,ar,zh,hi")
    args = parser.parse_args()
    result = review(args.input, args.output, args.allowlist,
                    [x.strip() for x in args.target_languages.split(",") if x.strip()])
    print(json.dumps({k: result[k] for k in ("manifest_records", "valid_records", "rejected_records",
          "language_counts", "license_counts", "candidate_manifest_complete", "review_status")}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
