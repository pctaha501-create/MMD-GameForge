# AI Core milestone 01 — Tiny neural text model

This milestone connects the Model Workshop UI to a real offline neural training runtime. It provides text-corpus import, training, persistent checkpoints, and local next-character generation.

## Architecture

- Character vocabulary → one-hot input → 24-unit tanh hidden layer → softmax character output.
- All input/output weights are initialized from a seeded Xavier-uniform random distribution. The seed, architecture, learning rate, epoch count, and training loss are stored in every checkpoint.
- Training uses a small online stochastic-gradient-descent loop with cross-entropy loss and a single shuffled pass over adjacent character pairs.
- The CPU resource guardrails cap a training run at 20,000 characters and 128 unique characters. This is intentionally small and does not require a GPU or third-party ML framework.

## Runtime behavior

- Electron's main process owns filesystem access; the renderer uses a narrow typed IPC bridge.
- A user explicitly selects a UTF-8 `.txt` corpus. Files are limited to 2 MB and stored locally under the application user-data directory in `ai-core/datasets`.
- Each dataset record stores its original filename, import time, optional source reference, declared license, attribution, notes, encoding/normalization policy, raw-file SHA-256, and normalized-text SHA-256. Unknown licenses remain explicitly marked `not-declared`.
- Training verifies the normalized-text hash before using a dataset and copies its hash and provenance summary into the model checkpoint, binding the checkpoint to the exact imported corpus.
- Model checkpoints are saved atomically as JSON under `ai-core/models`.
- Generation loads a checkpoint and predicts up to 500 new characters locally.
- No pretrained weights, cloud API, external model service, or network connection is used.

## Scope and limitations

This is a tiny character-level research model, not a general-purpose assistant, not a coding model, and not a game-design reasoning system. It learns only one-character transitions from the preceding character, so output quality is limited and may be repetitive. This milestone has no validation/test split, benchmark suite, GPU acceleration, long-context memory, or semantic understanding. It is a first neural training pipeline—not completion of the full MMD AI family.

## Verification

`tests/ai-core.test.cjs` covers dataset import and provenance hashes, provenance validation, tamper detection, random initialization metadata, training, checkpoint lineage/persistence, local generation, invalid IDs, undersized corpora, and helper behavior. Run `npm test`.
