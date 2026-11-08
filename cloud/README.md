# MMD Cloud Training (MCT)

MCT is the cloud-only training subsystem for MMD GameForge.

## Current implementation

- MCT-01: provider-neutral training/checkpoint contracts, multilingual pilot config, provider policy and public-repository security rules.
- MCT-02: dependency-free config/dataset preflight, dataset provenance validation, a PyTorch from-scratch Transformer trainer, Kaggle and Colab notebooks, resumable checkpoints, and Python/Node tests.

## Layout

- runtime/validate.py: preflight and dataset provenance validation.
- runtime/train.py: trains tokenizer and decoder-only Transformer from random initialization.
- notebooks/: user-started Kaggle and Colab notebook entrypoints.
- contracts/: versioned training-job and checkpoint schemas.
- configs/: model architecture and training configuration.
- providers/ and security/: provider compliance and secret-handling rules.

## Dataset requirements

Provide a UTF-8 corpus and provenance JSON. The required provenance fields are source, revision, license, license_url, collected_at, languages, preprocessing, and train/validation/test split descriptions. Do not publish private or unlicensed corpora in this public repository.

## Important limits

Kaggle is the preferred free GPU target, subject to availability and quota. Colab is an interactive fallback only. No hidden workers, quota evasion, paid fallback, guaranteed GPU time, or pretrained weights. A real cloud training run must be started by the user in the provider UI.
