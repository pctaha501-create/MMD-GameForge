# AI Core milestone 02 — Resumable local training

This milestone adds bounded training sessions and durable resume for the first-party character MLP. The model is still initialized from fresh Xavier-uniform random weights for every new run; resuming continues only that MMD-created checkpoint and never imports pretrained weights.

## Checkpoint behavior

- A training run is divided into user-triggered chunks (default 1,024 optimizer updates; hard maximum 4,096 per request).
- Each new run stores its initial random weights, seed, dataset ID and SHA-256 lineage before training starts.
- Checkpoints are atomically rewritten every 128 updates and at the end of each chunk. A process interruption can therefore lose at most the updates since the last successful checkpoint write.
- The checkpoint stores the current epoch, sample cursor, completed/total update counts, accumulated loss, per-epoch losses, and all model tensors.
- Sample order is deterministically reconstructed from the original seed and epoch. Resume therefore continues at the exact next sample without storing a large permutation array.
- Resume reloads the original local dataset and verifies its SHA-256 against both the model lineage and dataset provenance before changing any weights.
- The current optimizer is plain SGD with no momentum state. If optimizer state is added later, it must be included in the checkpoint schema before it is used by resume.

## Resource limits

- Dataset cap: 2 MB imported UTF-8 file, 20,000 training characters, 128 unique characters.
- Model: 24 hidden units; CPU-only, no external ML framework or model download.
- Training: 1–10 epochs, 1–4,096 updates per user-triggered chunk.
- The renderer yields to the Electron event loop every 64 updates; checkpoints are written every 128 updates and after each chunk.

## Verification

`tests/ai-core.test.cjs` covers a partial run, reload through a fresh runtime instance, multiple resume calls, completion, inference after resume, dataset tamper rejection, invalid chunk/epoch limits, refusal to resume a completed checkpoint, and recovery after a simulated interruption immediately after a periodic atomic checkpoint. Run `npm test`.

## Limitations

This remains a tiny next-character MLP. Resumability improves training reliability; it does not make the model a semantic language model, coding assistant, or game-design agent. Evaluation splits and meaningful benchmarks remain the next AI Core milestone.
