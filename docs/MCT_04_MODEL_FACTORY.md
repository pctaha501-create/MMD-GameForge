# MCT-04 — Model Factory and Experiment Registry

Create reproducible first-party model configurations and measure their parameter and lower-bound optimizer memory costs before requesting a GPU.

## Create a profile

```bash
python cloud/runtime/model_factory.py create --profile multilingual-tiny --output cloud/configs/mmd-multilingual-tiny.json
python cloud/runtime/model_factory.py estimate --config cloud/configs/mmd-multilingual-tiny.json
```

Profiles: multilingual-tiny, multilingual-pilot, code-tiny, game-design-tiny, game-agent-tiny. The Game Agent profile is intended for structured MMD tool-use instruction data and is not a trained agent by itself. Every generated profile starts from random weights and disables paid fallback. Domain profiles are architecture/configuration starting points, not trained specialist models.

Memory output is a lower bound: activations, CUDA workspace, allocator fragmentation, and framework overhead are additional. It must not be treated as a VRAM fit guarantee.

## Register an experiment

```bash
python cloud/runtime/experiment_registry.py --db mmd-experiments.sqlite3 register --name multilingual-pilot-r1 --config cloud/configs/mmd-multilingual-pilot.json --provenance /path/to/provenance.json --commit abcdef012345 --status completed --artifact /path/to/checkpoint.pt --metric validation:loss:2.31:500
python cloud/runtime/experiment_registry.py --db mmd-experiments.sqlite3 list
```

SQLite stores config hash, dataset revision, source commit, status, metrics and artifact SHA-256 hashes. It does not mark a model production-ready. Release promotion requires a separate benchmark and safety review; no automatic promotion is implemented.


## Bilingual MMD Base 1B test profile

The `bilingual-base-1b` profile defines a decoder-only Transformer with a 32,000-token byte-level BPE vocabulary, 256-token context, hidden size 2,048, 19 layers, 16 attention heads, 4x feed-forward width, and tied token embeddings. The estimator returns **1,022,871,552 parameters** for this exact architecture. Tokenizer training and model weights both start from scratch. Supported languages are Persian (`fa`) and English (`en`) only.

The 8-bit AdamW state lower bound is approximately 9.53 GiB before activations, CUDA workspaces, and framework overhead. The trainer therefore refuses CPU execution and requires a cloud CUDA GPU reporting at least 14 GiB. This is a conservative preflight, not a guarantee of fit or free GPU availability. The model is only a configured test target until it has actually been trained and evaluated.


Memory optimization for the 1B test profile: the trainer uses bitsandbytes 8-bit AdamW and activation gradient checkpointing. The optimizer-state lower bound is approximately 9.53 GiB before activations, CUDA workspaces, and framework overhead. The trainer refuses CPU execution and checks for at least 14 GiB of reported CUDA memory. This preflight is not a guarantee that a free runtime will fit or be available; the Kaggle/Colab notebooks install bitsandbytes in the cloud session only.
