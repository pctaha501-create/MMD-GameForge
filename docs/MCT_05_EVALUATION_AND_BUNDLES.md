# MCT-05 — Evaluation, generation and portable model bundles

MCT-05 adds offline evaluation and packaging for user-trained MMD checkpoints. It does not train a model or claim that a model has passed quality gates.

## Evaluate a checkpoint

```bash
python cloud/runtime/evaluate.py --config cloud/configs/mmd-multilingual-pilot.json --dataset /path/to/corpus.txt --provenance /path/to/provenance.json --checkpoint /path/to/run/checkpoint.pt --tokenizer /path/to/run/tokenizer.json --output /path/to/run/evaluation.json
```

The evaluator verifies config, dataset revision, tokenizer hash and checkpoint lineage before measuring held-out test loss/perplexity. Optional task examples use JSONL with prompt, task and language fields; generated outputs are stored for human review. A low loss alone is not a production-quality or safety certification.

## Export a portable bundle

```bash
python cloud/runtime/bundle.py --checkpoint-dir /path/to/run --config cloud/configs/mmd-multilingual-pilot.json --evaluation /path/to/run/evaluation.json --output /path/to/MMD-Multilingual-Base.zip
```

The exporter checks that evaluation, checkpoint, tokenizer and config hashes agree, then packages the artifacts and a bundle manifest. Import into the desktop app is a separate integration milestone and must validate the bundle again.

## Release gates

A model is not promoted automatically. Before a release, run domain-specific held-out benchmarks, inspect generated samples in every target language, check for memorization and harmful outputs, verify data rights, compare multiple seeds, and record known limitations. The pilot model is a research artifact until these gates are met.
