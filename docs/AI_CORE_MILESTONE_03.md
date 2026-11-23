# AI Core milestone 03 — Holdout evaluation

This milestone adds a leakage-aware evaluation path to the first-party offline character MLP.

## Dataset split

- Adjacent next-character samples are partitioned in original text order into contiguous 80% train, 10% validation, and 10% test segments.
- Only the training segment is shuffled and used for gradient updates.
- Validation and test samples are evaluated after the final training epoch; they never update model weights.
- The split method and exact sample counts are stored in the checkpoint and checked again on resume.
- The character vocabulary is derived from the imported corpus so the fixed output alphabet is known before evaluation. No validation/test targets are used for gradient updates.

## Metrics

Each completed new-schema checkpoint stores train, validation, and test mean cross-entropy, perplexity (exp of cross-entropy), next-character top-1 accuracy, exact sample count, and evaluation timestamp.

These are diagnostic metrics for a tiny one-character-context model, not evidence of semantic understanding or game-design capability.

## Checkpoint compatibility

New checkpoints use training-state schema version 2 and train only on the 80% training segment. Existing version-1 checkpoints remain resumable using their original full-corpus sample order. Because those legacy runs already trained on the entire corpus, they are explicitly marked not-evaluated; no misleading holdout score is fabricated.

## Resource profile

The implementation remains dependency-free, CPU-only, and bounded by the existing 20,000-character / 128-character-vocabulary limits. It adds no model downloads, pretrained weights, cloud inference, or GPU requirement.

## Verification

Run npm test, npm run typecheck, and npm run build. The evaluation test checks split accounting, finite metrics, checkpoint persistence, and that evaluation does not mutate model weights.