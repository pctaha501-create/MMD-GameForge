# Provider adapter contract

## Shared behavior

Every provider adapter must:
1. Accept the same versioned MCT job manifest and model config.
2. Report provider, runtime image/version, accelerator model, accelerator memory, CPU/RAM, start time, and known session deadline.
3. Verify required packages and available disk/memory before training.
4. Never download or load pretrained model weights.
5. Write portable checkpoints and metrics to the configured artifact destination.
6. Stop safely when the provider session ends or a user stops it.
7. Resume only from a checkpoint whose hashes and lineage validate.

## Kaggle adapter

Kaggle is the preferred first free GPU notebook target. Package the training entrypoint as a Kaggle-compatible notebook/script and use only the account's available accelerator quota and supported API/UI. Free GPU availability and quota are not guaranteed. Keep each run within the provider's current session limits and checkpoint frequently.

## Colab adapter

Colab is an interactive fallback. Free managed runtimes have dynamic, non-guaranteed limits. Do not turn a free Colab runtime into an unattended service, persistent worker, distributed-computing worker, SSH/remote desktop host, or hidden backend for a separate web application. The user starts and operates the notebook through Colab's supported UI.

## Hugging Face adapter

Hugging Face Hub is an artifact/metadata registry adapter, not a compute provider. Use public repositories only for artifacts that are intended to be public and whose licenses permit redistribution. Verify storage and bandwidth limits before publishing.

## Capability negotiation

Provider adapters must return explicit capabilities rather than assuming a GPU exists:
- accelerator type and memory
- available host RAM and disk
- supported precision
- max expected runtime
- outbound network availability
- artifact persistence destination

If a provider is unavailable or its terms do not permit the requested execution pattern, mark the job as `waiting_for_provider` or `requires_user_action`. Never silently switch to a paid plan.
