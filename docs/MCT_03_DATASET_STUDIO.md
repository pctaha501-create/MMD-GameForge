# MCT-03 — Dataset Studio

Dataset Studio prepares user-supplied multilingual corpora for MMD training without downloading or scraping data.

## Input format

UTF-8 JSONL, one document per line:

```json
{"text":"متن نمونه","language":"fa"}
{"text":"Sample English text","language":"en"}
```

Language labels are supplied by the dataset owner; this tool does not pretend to perform automatic language identification. The owner must ensure they have the right to use the corpus and record truthful license/provenance metadata.

## Prepare a dataset

```bash
python cloud/runtime/dataset_studio.py --input /path/to/documents.jsonl --output /path/to/prepared --source "my-corpus" --revision "v1" --license "CC-BY-4.0" --license-url "https://creativecommons.org/licenses/by/4.0/"
```

Outputs:
- corpus.txt: deterministic train, validation, and test document ordering for the current trainer.
- provenance.json: required training provenance plus split details, source and output hashes.
- report.json: document counts, duplicate counts, language distribution, and per-split counts.

## Processing guarantees

- Unicode NFC and whitespace normalization.
- Exact duplicate removal on normalized text + language tag; the same text in distinct language tags is retained.
- Deterministic document-level split based on SHA-256 and an explicit seed.
- Split membership is disjoint; language distribution is reported rather than silently rebalanced.
- No external network calls and no dataset upload to this public repository.

## Training integration

The output corpus.txt and provenance.json can be passed directly to the MCT-02 runner. The trainer now rejects too-short tokenized splits with a clear message rather than attempting to evaluate an empty validation/test set. The configured sequence length may need to be reduced for small pilot corpora.
