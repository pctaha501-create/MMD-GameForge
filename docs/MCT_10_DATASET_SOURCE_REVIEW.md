# MCT-10 — Dataset source review (not yet approved for ingestion)

This review identifies public sources for the multilingual pilot. It does not download, copy or ingest any dataset. A source is not approved merely because its hosting page is public.

## Target languages

The current pilot targets Persian (fa), English (en), German (de), French (fr), Spanish (es), Arabic (ar), Simplified Chinese (zh), and Hindi (hi).

## Candidate sources

### PleIAs Common Corpus

- Official card: https://huggingface.co/datasets/PleIAs/common_corpus
- The publisher describes it as open-licensed, with document-level metadata including language, source/identifier and license; it supports filtering by language and license.
- Its currently documented language set includes English, French, German, Spanish, Arabic and Chinese, while Hindi coverage is described as an ongoing expansion. Persian is not clearly listed in the current language metadata.
- The dataset is enormous (multi-terabyte), so it is not suitable for an unrestricted free-tier pilot. Only a small, explicitly filtered subset could be considered.
- Before use, filter to public-domain/CC0 or a user-approved permissive license, preserve per-document attribution and license metadata, and verify the current dataset revision.

### HPLT multilingual corpora

- Official v2 page: https://hplt-project.org/datasets/v2.0
- The package exposes cleaned language-specific samples and includes all eight target language codes.
- The page says the packaging is CC0, but also explicitly states that HPLT does not own the underlying text and users remain responsible for legal compliance. Therefore, the package's CC0 statement must not be treated as blanket permission for every source document.
- Full language collections are very large (from hundreds of GB to multiple TB for several target languages), so full downloads are out of scope.
- Do not ingest any HPLT document unless its underlying source/license can be established and the record is retained in provenance.

### CoVoST 2

- Official project: https://github.com/facebookresearch/covost
- Meta describes CoVoST as CC0 speech-translation data. It includes English-to/from Persian, Arabic, Chinese, German, French and Spanish; Hindi is not listed in the supported languages.
- This is speech transcript/translation material, not a general-purpose text corpus or Unreal coding dataset. It may be useful for a later translation/speech task, not as the main general LM corpus.

### EverFlip multilingual flashcards

- Dataset page: https://everflip.app/dataset
- The publisher describes 24,963 flashcards across 81 languages under CC-BY-4.0.
- It is small and vocabulary-focused. It may be useful for tokenizer smoke tests or a tiny lexical evaluation set, but it is not sufficient for general language-model pretraining or GameForge instruction training.

## Recommended staged data plan

1. **Pipeline smoke test:** use a small, user-approved CC-BY/CC0 sample to validate ingestion, tokenizer training, checkpointing and evaluation. Do not present this as a capable model.
2. **Multilingual base:** select per-language subsets from a source with document-level rights metadata. Start with equal token budgets per language and preserve the original source/license fields.
3. **GameForge instruction data:** create a separate, curated dataset of original or permissively licensed Unreal/C++/game-design prompt-response examples. Keep held-out benchmark examples separate.
4. **Tool-use training:** add MMD tool-call JSON examples only after the tool schema is stable. Never train on private project contents without explicit permission.

## Approval gate

No dataset is added to the public repository or downloaded automatically. Before ingestion, record exact dataset revision, selected languages, subset filters, license policy, source URL, file hashes and retention/deletion policy. The user must approve the selected source and scope.
