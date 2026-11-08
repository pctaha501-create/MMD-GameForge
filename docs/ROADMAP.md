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

## MCT-07 — Instruction training and safe tool-use data

See [MCT_07_INSTRUCTION_TRAINING.md](./MCT_07_INSTRUCTION_TRAINING.md). Adds a prompt/response dataset pipeline, deterministic splits, and supervised response-only training from random initialization. Generated tool calls are not executed without a separate allowlisted approval layer.

## MCT-08 — Task-specific AI orchestration

Build the schema-validated tool router, project-aware context retrieval, code/design task workflows, approval gates and task-specific benchmark suites.

## MCT-09 — Multimodal model research

Evaluate from-scratch vision, audio and 3D model architectures separately. Do not promise free-tier training of large diffusion/video models; require small measured experiments and real dataset licensing first.

## AI Core release gate

The assistant is not complete until task-specific instruction-trained models exist, benchmark targets are met, local inference is stable, safe tool workflows can create and validate Unreal project artifacts, and end-to-end Windows acceptance tests pass.
