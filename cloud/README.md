# MMD Cloud Training (MCT)

Cloud-only first-party training for MMD GameForge. The current test target is **MMD Base 1B**, restricted to Persian (`fa`) and English (`en`).

- MCT-01–02: provider-neutral contracts and user-started cloud Transformer training.
- MMD Base 1B: approximately 1,022,871,552 parameters, random initialization, Persian/English only; use `configs/mmd-base-1b-bilingual.json`.
- MCT-03: Dataset Studio with provenance, deduplication and deterministic splits.
- MCT-04: Model Factory, memory estimates and experiment registry.
- MCT-05: held-out evaluation and verified portable bundles.
- MCT-06: desktop model import and authenticated local inference.
- MCT-07: instruction dataset preparation and random-init supervised training.
- MCT-08: allowlisted, approval-gated project/scene/Unreal tools.
- MCT-09: task/language benchmark runner with human-reviewable outputs.
- MCT-10: metadata-only, document-level dataset rights review; no download or ingestion occurs.
- MCT-11: human-gated model release acceptance checks bundle integrity, evaluation, task/language coverage and Unreal build evidence; no automatic promotion.

## Reproducible quick start

1. Prepare a UTF-8 JSONL file with one document per line: {"text":"...","language":"fa"} or {"text":"...","language":"en"}. Use only documents you have permission to train on.
2. Run Dataset Studio locally (this only prepares files; it does not train a model):

   ```bash
   python cloud/runtime/dataset_studio.py --input ./licensed-documents.jsonl --output ./mmd-dataset --source "your source" --revision "dataset-v1" --license "your license" --license-url "https://example.org/license"
   ```

3. Review `mmd-dataset/report.json` and `provenance.json`. Confirm the source, license, language counts and document splits. Do not label data as licensed unless you have verified the rights.
4. Upload `corpus.txt` and `provenance.json` as a private Kaggle dataset, then open `notebooks/kaggle-multilingual.ipynb` and start the session manually with a GPU. Colab users can follow `notebooks/colab-multilingual.ipynb`.
5. The shared trainer checks for CUDA and a 24 GiB minimum preflight, then runs the random-initialized model. Save the output directory/checkpoints to persistent storage before the hosted session ends.
6. Run held-out evaluation and bundle verification before importing anything into the desktop app.

Important: the 1B Base model has an estimated 8-bit AdamW training-state lower bound of about 9.53 GiB before activations and framework overhead. The 24 GiB GPU check is a conservative preflight, not a promise that a free runtime will fit or be available. No pretrained weights, hosted inference APIs, hidden workers, paid fallback or quota evasion. Free GPU availability is not guaranteed. Automated metadata checks do not grant data rights; human review is mandatory. Benchmark smoke scores do not certify production quality.
