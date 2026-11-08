# Public repository and cloud security rules

MMD GameForge is intended to be a public project. Treat every committed file, notebook output, dataset manifest, issue, and CI log as public.

## Never commit

- Kaggle API token files or credentials.
- Hugging Face access tokens.
- OAuth tokens, session cookies, passwords, private keys, or signed URLs.
- Private datasets, personal data, restricted content, or data without a verified redistribution/use license.
- Provider secrets in notebook source, outputs, screenshots, or logs.

## Secret handling

Use provider-managed notebook secrets or short-lived, least-privilege tokens. Read secrets at runtime from the provider's supported secret store. Never put secrets in the renderer, browser storage, job manifests, model metadata, or public artifacts. Revoke and rotate any secret that is accidentally exposed.

## Public dataset gate

Before a dataset is used, record:
- canonical source and immutable revision/snapshot;
- license identifier and link;
- attribution and redistribution obligations;
- collection date and preprocessing steps;
- language coverage and train/validation/test split method;
- filtering, deduplication, and known limitations.

A public URL does not imply a permissive license. Unknown or incompatible license means the dataset is not eligible for training.

## Public model release gate

Every public checkpoint must include model config, random initialization seed/method, dataset provenance, training code commit, tokenizer revision, checkpoint hashes, evaluation summary, and an explicit model license decision.
