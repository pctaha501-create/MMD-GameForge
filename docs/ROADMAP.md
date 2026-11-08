## Phase 02 — Desktop workspace

See [PHASE_02_WORKSPACE.md](./PHASE_02_WORKSPACE.md) for the desktop workspace implementation and its explicit boundaries. Production acceptance remains subject to CI and on-device validation.

## MCT-01 — MMD Cloud Training foundation

See [MMD_CLOUD_TRAINING_ARCHITECTURE.md](./MMD_CLOUD_TRAINING_ARCHITECTURE.md). This milestone establishes provider-neutral job/checkpoint contracts, a small multilingual model pilot configuration, provider-compliance rules, public-repository security guidance, and contract tests. It does not yet run cloud jobs or train model weights.

## MCT-02 — Provider notebook adapters

Prepare reproducible Kaggle and Colab notebook entrypoints that consume the same job manifest, verify runtime capabilities, and save resumable checkpoints. Users explicitly start notebook sessions; no policy-bypassing background workers or guaranteed always-on GPU is assumed.

## MCT-03 — Dataset Studio

Add dataset ingestion, license/provenance records, deduplication, language balance reports, and deterministic train/validation/test splits.

## MCT-04 — Multilingual model factory

Implement a tokenizer and decoder-only Transformer initialized from random weights, with a small pilot configuration and reproducible seed policy.

## MCT-05 — Training and evaluation

Add mixed-precision training where supported, checkpoint/resume, loss tracking, evaluation, and resource-aware experiment sizing.

## Phase 03 — 3D Scene Editor

See [PHASE_03_SCENE_EDITOR.md](./PHASE_03_SCENE_EDITOR.md). This phase adds a real local 3D scene authoring viewport and project scene persistence.
