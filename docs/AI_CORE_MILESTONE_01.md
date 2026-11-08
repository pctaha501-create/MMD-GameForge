# AI Core milestone 01 — Offline corpus baseline

This milestone connects the Model Workshop UI to a real local runtime. It provides text-corpus import, corpus metadata, training, persistent checkpoints, and local text generation.

## Runtime behavior

- The Electron main process owns all filesystem access. The renderer receives a narrow, typed IPC bridge and never receives arbitrary filesystem access.
- A user explicitly selects a UTF-8 `.txt` corpus. Files are limited to 2 MB and copied into the application user-data directory under `ai-core/datasets`.
- Training builds a character-trigram transition model from the selected corpus and saves a JSON checkpoint under `ai-core/models`. No external service or model download is involved.
- Generation loads a saved checkpoint and samples character transitions locally. Output is capped at 500 new characters per request.
- Invalid identifiers, empty/undersized corpora, and oversized input are rejected. Checkpoints are written atomically.

## Important model classification

The milestone is an **experimental statistical baseline**, not a neural network, not a general-purpose assistant, and not an MMD first-party neural model. It has no neural weights or random weight initialization. It exists to validate the local dataset → training → checkpoint → inference pipeline before neural architecture work begins. The from-scratch policy for first-party neural models remains unchanged: initialize all weights randomly, record seeds and provenance, train on licensed data, and report measured evaluation results.

## Known limitations

- Character transitions are not semantic reasoning and can produce repetitive or incoherent text.
- There is no train/validation/test split, perplexity, benchmark suite, GPU acceleration, or neural optimizer in this milestone.
- Imported corpus files remain local. Users are responsible for ensuring their corpus licenses permit their intended use.
- No pretrained weights, hosted API, or network dependency is used.

## Verification

`tests/ai-core.test.cjs` covers dataset import, training, checkpoint persistence, local generation, invalid IDs, undersized corpora, and helper behavior. Run `npm test`.
