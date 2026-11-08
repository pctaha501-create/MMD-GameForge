## Phase 02 — Desktop workspace

See [PHASE_02_WORKSPACE.md](./PHASE_02_WORKSPACE.md). Production acceptance remains subject to CI and on-device validation.

## MCT-01 — MMD Cloud Training foundation

See [MMD_CLOUD_TRAINING_ARCHITECTURE.md](./MMD_CLOUD_TRAINING_ARCHITECTURE.md).

## MCT-02 — Executable cloud training runner

See [MCT_02_CLOUD_RUNNER.md](./MCT_02_CLOUD_RUNNER.md). Adds a from-scratch tokenizer and Transformer runner, resumable checkpoints, Kaggle/Colab notebooks and automated checks.

## MCT-03 — Dataset Studio

See [MCT_03_DATASET_STUDIO.md](./MCT_03_DATASET_STUDIO.md). Adds JSONL ingestion, Unicode normalization, duplicate removal, deterministic document-level train/validation/test splits, language distribution reports, and provenance hashes. Also hardens the trainer against empty/undersized evaluation splits.

## MCT-04 — Model factory and experiment management

Add configurable model families, tokenizer evaluation, parameter/VRAM estimates, experiment tracking, and model registry integration. Validate pilot architecture against actual free-tier GPU memory before scaling.

## MCT-05 — Training evaluation and application integration

Add benchmark suites, generation/evaluation tools, portable inference runtime, model import/export, and explicit connection between trained model artifacts and the desktop AI Core.

## AI Core — Desktop runtime hardening

The current local character MLP is only a tiny research baseline. Expand model registry, checkpoint validation, training controls, inference API and UI only after architecture/resource requirements are measured. Do not label the assistant complete until it can reliably perform the advertised game-development tasks.

## Phase 03 — 3D Scene Editor

See [PHASE_03_SCENE_EDITOR.md](./PHASE_03_SCENE_EDITOR.md).
