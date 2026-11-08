# MCT-11 — Model quality and Unreal acceptance gate

The release gate is deliberately conservative and human-controlled. It checks bundle artifact hashes, random initialization lineage, held-out evaluation metrics, task/language benchmark coverage, and a separate human-review record.

## Run

```bash
python cloud/runtime/release_gate.py --bundle-dir /path/to/extracted-bundle --evaluation /path/to/evaluation.json --benchmark /path/to/benchmark-report.json --human-review /path/to/human-review.json --policy cloud/configs/release-policy.json --output /path/to/release-acceptance.json
```

The policy file defines minimum benchmark sample counts and pass rates plus maximum test loss/perplexity. These are initial research thresholds, not universal definitions of model quality.

The human review JSON must record:
- reviewer, review ID and ISO-8601 review time;
- data-rights, output-quality and safety review;
- an actual UnrealBuildTool build verification and build-log SHA-256;
- evidence references and known limitations.

A passing result is only `awaiting_release_owner_decision`. It never publishes, promotes or labels a model production-ready. The human review fields are attestations and must be backed by the referenced evidence; the script cannot independently prove that a person performed the review or that Unreal output is correct.

## Unreal end-to-end fixture requirements

For each supported engine version, acceptance should include a disposable project created by GameForge, a generated C++ change, a successful Win64 Development build with UnrealBuildTool, and a clean rebuild after regenerating project files. Preserve engine version, build command, exit code, log hash and fixture commit. This repository does not claim such a real Unreal build has been run yet.
