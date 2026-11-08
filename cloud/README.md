# MMD Cloud Training (MCT)

Cloud-only first-party training for MMD GameForge. The current test target is **MMD Base 1B**, restricted to Persian (`fa`) and English (`en`).

- MCT-01–02: provider-neutral contracts and user-started cloud Transformer training.
- MMD Base 1B: approximately 1,022,871,552 parameters, random initialization, Persian/English only; use `configs/mmd-base-1b-bilingual.json`.
- MCT-03: Dataset Studio with provenance, deduplication and deterministic splits.
- MCT-04: Model Factory, memory estimates and experiment registry.
- MCT-05: held-out evaluation and verified portable bundles.
- MCT-06: desktop model import and authenticated local inference.
- MCT-07: instruction dataset preparation and random-init supervised training.
- MCT-08: allowlisted, approval-gated project/scene/Unreal tools.
- MCT-09: task/language benchmark runner with human-reviewable outputs.
- MCT-10: metadata-only, document-level dataset rights review; no download or ingestion occurs.\n- MCT-11: human-gated model release acceptance checks bundle integrity, evaluation, task/language coverage and Unreal build evidence; no automatic promotion.

Important: the 1B Base model has an estimated AdamW training-state lower bound of about 15.25 GiB before activations and framework overhead. Its 24 GiB GPU check is only a preflight minimum, not a promise that a free runtime will fit or be available. No pretrained weights, hosted inference APIs, hidden workers, paid fallback or quota evasion. Free GPU availability is not guaranteed. Automated metadata checks do not grant data rights; human review is mandatory. Benchmark smoke scores do not certify production quality.
