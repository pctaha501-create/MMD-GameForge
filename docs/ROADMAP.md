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

See [MCT_07_INSTRUCTION_TRAINING.md](./MCT_07_INSTRUCTION_TRAINING.md). Adds prompt/response dataset preparation and response-only supervised training from random initialization, with Kaggle and Colab notebook entrypoints.

## MCT-08 — Approval-gated tool router

See [MCT_08_SAFE_TOOL_ROUTER.md](./MCT_08_SAFE_TOOL_ROUTER.md). Adds strict JSON tool-call validation and approved project file, scene and Unreal actions. No arbitrary shell execution.

## MCT-09 — Task-specific evaluation and multimodal research

Add Unreal/C++ and game-design benchmarks, code compilation checks, project-level integration tests, then separate from-scratch vision, audio and 3D research tracks. Large image/video models are not assumed feasible on free GPU tiers.

## AI Core release gate

The assistant is not complete until task-specific instruction-trained models exist, benchmark targets are met, local inference is stable, safe tool workflows create and validate Unreal project artifacts, and end-to-end Windows acceptance tests pass.
