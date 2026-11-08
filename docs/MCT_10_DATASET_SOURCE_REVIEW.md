# MCT-10 — Dataset source review

This tool audits a **metadata-only JSONL manifest**. It does not fetch source pages, download corpus files, inspect raw text, or ingest documents.

## Required document metadata

Each JSONL record must include:

- `document_id`, `source_url` (HTTPS), `source_revision`
- `language`, `license_id`, `license_url` (HTTPS)
- `attribution`, `text_sha256`
- `rights_basis`, `collection_method`
- `public_redistribution: true`
- `source_rights_verified: true` (a human assertion that still requires independent review)

The tool checks metadata completeness, duplicate IDs, SHA-256 syntax, target-language membership, and an explicit license allowlist. It does not infer license compatibility or verify the underlying rights itself.

## Example allowlist

Create a local `allowed-licenses.json` file. Start with an empty list until a human has reviewed the intended licenses:

```json
{"allowed_license_ids":[]}
```

Only add identifiers after reviewing the actual license terms and source-specific restrictions. A host page's license statement is not automatically a grant for every underlying document.

## Run

```bash
python cloud/runtime/dataset_review.py --input source-manifest.jsonl --allowlist allowed-licenses.json --output dataset-source-review.json --target-languages fa,en,de,fr,es,ar,zh,hi
```

A clean report is labeled `needs_human_rights_approval`, never `approved`. A person must inspect the sources and explicitly approve scope before Dataset Studio is run. Keep manifests and review reports with the dataset provenance. Do not commit private or restricted source metadata into this public repository.
