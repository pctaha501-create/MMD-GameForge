# AI From Scratch — Technical Policy

## Non-negotiable requirement

Every AI model presented as an MMD GameForge first-party model must be initialized from random weights and trained by the MMD project. No pretrained, fine-tuned, distilled, quantized-from-pretrained, or converted third-party model weights may be used as its starting point.

## What is allowed

- General programming languages, compilers, operating systems, and build systems.
- Standard mathematical, tensor, and numerical-computing libraries.
- General-purpose deep-learning frameworks as implementation tools, provided model weights are initialized from scratch and training is performed by this project.
- Publicly available datasets when their licenses and terms permit the intended use; dataset provenance must be recorded.
- Unreal Engine and ordinary game-development tools.
- Third-party non-AI utilities that do not contain pretrained model weights.

## What is not allowed in the first-party AI core

- Loading third-party pretrained model checkpoints.
- Starting from a pretrained model and fine-tuning it.
- Hiding an external model behind a local API or renaming it as an MMD model.
- Depending on a hosted AI API for core functionality.
- Claiming a capability is implemented when it is only a mock UI or an unconnected integration.

## Model provenance record

Every model family must document:

- Architecture and implementation version.
- Random initialization method and seed policy.
- Dataset sources, licenses, preprocessing, and splits.
- Training configuration, hardware, runtime, and code revision.
- Checkpoint lineage and cryptographic hashes.
- Evaluation datasets, metrics, limitations, and known failure cases.

## Optional external integrations

A future optional connector to an external provider or user-supplied local model may be considered only as a separate, explicit opt-in feature. It must not be required for the application or represented as an MMD-trained model. The first-party path must continue to work independently.

## Practical scaling

The project should begin with small experiments that can run on available hardware. Larger language, vision, image, audio, and 3D models require significantly more compute and carefully curated data. Scaling must be based on measured experiments rather than unsupported performance claims.