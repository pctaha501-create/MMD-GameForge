# MMD Cloud Training (MCT)

MCT is the cloud-only training subsystem for MMD GameForge.

## Current implementation

- MCT-01: provider-neutral job/checkpoint contracts, multilingual pilot config, provider policy and public-repository security rules.
- MCT-02: config/dataset preflight, PyTorch from-scratch Transformer trainer, Kaggle/Colab notebooks, resumable checkpoints and automated validation.
- MCT-03: Dataset Studio for JSONL ingestion, Unicode normalization, duplicate removal, deterministic document-level splits, language reports and provenance hashes.

## Layout

- runtime/validate.py: preflight and provenance validation.
- runtime/dataset_studio.py: corpus preparation and audit report.
- runtime/train.py: tokenizer and decoder-only Transformer training from random initialization.
- notebooks/: user-started Kaggle and Colab entrypoints.
- contracts/: versioned training-job and checkpoint schemas.
- configs/: model architecture and training configuration.
- providers/ and security/: provider compliance and secret-handling rules.

## Dataset requirements

Use Dataset Studio to create corpus.txt and provenance.json from a UTF-8 JSONL file. Each record must contain text and a language tag. Supply truthful source, revision, license, license URL, collection date and preprocessing information. Do not publish private or unlicensed corpora in this public repository.

## Limits

Kaggle is the preferred free GPU target, subject to availability and quota. Colab is an interactive fallback only. No hidden workers, quota evasion, paid fallback, guaranteed GPU time, or pretrained weights. A real cloud training run must be started by the user in the provider UI.
