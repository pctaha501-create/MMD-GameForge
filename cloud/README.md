# MMD Cloud Training (MCT)

Cloud-only first-party training for MMD GameForge.

- MCT-01: versioned job/checkpoint contracts and provider/security policy.
- MCT-02: user-started Kaggle/Colab training runner and resumable random-init Transformer.
- MCT-03: Dataset Studio, deterministic splits and provenance reports.
- MCT-04: model profiles, parameter/memory estimator and SQLite experiment registry.
- MCT-05: held-out evaluation and hash-verified portable model bundles.
- MCT-06: desktop model inventory, hash-verified import, and authenticated loopback inference process (PyTorch/tokenizers required).

All first-party weights start from random initialization. No pretrained weights, hosted inference APIs, hidden workers, paid fallback or quota evasion. Free GPU availability is not guaranteed. See docs/MCT_*.md.
