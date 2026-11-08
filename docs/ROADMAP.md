## MCT-01 — Cloud foundation

See [MMD_CLOUD_TRAINING_ARCHITECTURE.md](./MMD_CLOUD_TRAINING_ARCHITECTURE.md).

## MCT-02 — Executable cloud runner

See [MCT_02_CLOUD_RUNNER.md](./MCT_02_CLOUD_RUNNER.md).

## MCT-03 — Dataset Studio

See [MCT_03_DATASET_STUDIO.md](./MCT_03_DATASET_STUDIO.md).

## MCT-04 — Model Factory and experiment registry

See [MCT_04_MODEL_FACTORY.md](./MCT_04_MODEL_FACTORY.md).

## MCT-05 — Evaluation and portable bundles

See [MCT_05_EVALUATION_AND_BUNDLES.md](./MCT_05_EVALUATION_AND_BUNDLES.md).

## MCT-06 — Desktop local inference

See [MCT_06_LOCAL_INFERENCE.md](./MCT_06_LOCAL_INFERENCE.md).

## MCT-07 — Instruction training

See [MCT_07_INSTRUCTION_TRAINING.md](./MCT_07_INSTRUCTION_TRAINING.md).

## MCT-08 — Approval-gated tool router

See [MCT_08_SAFE_TOOL_ROUTER.md](./MCT_08_SAFE_TOOL_ROUTER.md).

## MCT-09 — Task-specific benchmark runner

See [MCT_09_TASK_BENCHMARKS.md](./MCT_09_TASK_BENCHMARKS.md). Adds held-out task/language reporting and human-reviewable samples. Keyword-based pass rates are only smoke tests, not production certification.

## MCT-10 — Dataset source review and approval

See [MCT_10_DATASET_SOURCE_REVIEW.md](./MCT_10_DATASET_SOURCE_REVIEW.md). Public dataset candidates are reviewed for target-language coverage, document-level rights, provenance and practical size. No source is ingested until its scope and license are approved.

## MCT-11 — Model quality and Unreal end-to-end acceptance

Build larger curated benchmarks, compile generated Unreal C++ in controlled fixtures, verify project edits in disposable projects, and gate model releases on measured quality, safety and human review.

## Multimodal research

Vision, audio, 3D and video models remain separate from the text AI roadmap and require independently measured, from-scratch experiments. Free GPU availability is not guaranteed.

## AI Core release gate

The assistant is not complete until task-specific models exist, benchmarks pass, local inference is stable, approved tool workflows create valid Unreal project artifacts, and end-to-end Windows acceptance tests pass.
