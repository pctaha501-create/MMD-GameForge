## Phase 02 — Desktop workspace

See [PHASE_02_WORKSPACE.md](./PHASE_02_WORKSPACE.md) for the desktop workspace implementation and its explicit boundaries. Production acceptance remains subject to CI and on-device validation.

## MCT-01 — MMD Cloud Training foundation

See [MMD_CLOUD_TRAINING_ARCHITECTURE.md](./MMD_CLOUD_TRAINING_ARCHITECTURE.md). Establishes provider-neutral job/checkpoint contracts, multilingual pilot configuration, provider-compliance rules, and public-repository security guidance.

## MCT-02 — Executable cloud training runner

See [MCT_02_CLOUD_RUNNER.md](./MCT_02_CLOUD_RUNNER.md). Adds preflight validation, a from-scratch tokenizer and decoder-only Transformer trainer, resumable checkpoints with provenance hashes, Kaggle/Colab notebook entrypoints, and automated Python/Node validation. Cloud execution and trained weights still require a user-started provider session.

## MCT-03 — Dataset Studio

Add dataset ingestion, license/provenance records, deduplication, language balance reports, and deterministic train/validation/test splits with inspection tools.

## MCT-04 — Model factory and experiment management

Add configurable model families, tokenizer evaluation, parameter/VRAM estimates, experiment tracking, and model registry integration. Validate the pilot architecture against actual free-tier GPU memory before scaling.

## MCT-05 — Training evaluation and application integration

Add benchmark suites, generation/evaluation tools, portable inference runtime, model import/export, and explicit connection between trained model artifacts and the desktop AI Core.

## AI Core — Desktop runtime hardening

The current local character MLP is only a tiny research baseline. Expand the model registry, checkpoint validation, training controls, inference API, and UI only after architecture and resource requirements are measured. Do not label the assistant as complete until it can perform the advertised game-development tasks reliably.

## Phase 03 — 3D Scene Editor

See [PHASE_03_SCENE_EDITOR.md](./PHASE_03_SCENE_EDITOR.md). This phase adds a local 3D scene authoring viewport and project scene persistence.
