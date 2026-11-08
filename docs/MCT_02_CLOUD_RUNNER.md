# MCT-02 — Reproducible cloud training runner

This milestone adds an executable training path, not merely provider architecture notes.

## Included

- Dependency-free preflight validation for model config, dataset size, and license/provenance.
- A PyTorch decoder-only Transformer trainer that trains a byte-level BPE tokenizer and model weights from scratch.
- Causal next-token objective, AdamW, warmup/cosine schedule, gradient accumulation/clipping, mixed precision when supported, validation/test loss, and runtime reporting.
- Atomic checkpoint replacement with model, optimizer, scheduler, scaler, seed, config hash, dataset revision, tokenizer hash, artifact SHA-256 values, and evaluation status.
- Resume is refused when the config hash or dataset revision differs.
- Kaggle and Colab notebook entry points. Users start sessions through provider UIs; no unattended worker, quota bypass, hidden API execution, or paid fallback.

## Dataset contract

Provide a UTF-8 corpus.txt and a separate provenance.json. The record must include source, revision, license, license_url, collected_at, languages (array), preprocessing (description), and splits (object containing train, validation, and test descriptions).

The runner performs a deterministic 90/5/5 text split before tokenizer training. The tokenizer is trained only on the training split. Review dataset licensing and privacy before adding a corpus to this public repository or publishing resulting artifacts.

## Run

python cloud/runtime/train.py --config cloud/configs/mmd-multilingual-pilot.json --dataset /path/to/corpus.txt --provenance /path/to/provenance.json --output /path/to/mmd-run

The notebook runtime must provide PyTorch; install tokenizers in the user-started session if absent. The script never fetches datasets or pretrained weights. It reports actual device/VRAM and saves a portable checkpoint bundle.

## Limits

The 384-hidden, 6-layer, 512-token pilot is an experiment configuration, not a promise that every free GPU tier can fit or finish it. Start with a smaller config if VRAM is insufficient. Free accelerator availability, quotas, and session duration are controlled by the provider. This code change does not claim a cloud training job has run or trained weights exist.
