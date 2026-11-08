# MMD Cloud Training (MCT)

MCT is the cloud-only training subsystem for MMD GameForge.

## Current milestone: MCT-01

This directory currently contains contracts and configuration, not a running cloud service.

- `contracts/training-job.schema.json`: portable training job contract.
- `contracts/checkpoint.schema.json`: portable checkpoint/provenance contract.
- `configs/mmd-multilingual-pilot.json`: small random-init multilingual Transformer pilot.
- `providers/README.md`: provider adapter contract and current execution boundaries.
- `security/README.md`: public repository and secret-handling rules.

## Non-goals

MCT does not provide guaranteed free compute, bypass provider quotas, run hidden background workers, or use pretrained weights. A provider adapter prepares a reproducible notebook; users start it through the provider's supported interface.

See [the architecture document](../../docs/MMD_CLOUD_TRAINING_ARCHITECTURE.md) and [the AI-from-scratch policy](../../docs/AI_FROM_SCRATCH_POLICY.md).
