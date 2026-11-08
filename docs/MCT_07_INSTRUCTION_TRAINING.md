# MCT-07 — Instruction and tool-use training foundation

MCT-07 adds supervised instruction data preparation and a trainer that starts from random weights. It is not fine-tuning a pretrained model.

## Dataset format

UTF-8 JSONL, one example per line:

```json
{"prompt":"Design a stealth game mechanic","response":"The player can...","language":"en","task":"game_design"}
```

Required provenance: source, revision, license, license_url, collected_at. The dataset utility normalizes Unicode/whitespace, removes exact duplicates, creates deterministic document-level train/validation/test splits and reports task/language distribution.

## Prepare

```bash
python cloud/runtime/instruction_dataset.py --input /path/to/instructions.jsonl --output /path/to/instruction-data --source "my-instructions" --revision "v1" --license "CC-BY-4.0" --license-url "https://creativecommons.org/licenses/by/4.0/" --collected-at 2026-11-08
```

## Train from random initialization

```bash
python cloud/runtime/train_instructions.py --config cloud/configs/mmd-multilingual-tiny.json --dataset-dir /path/to/instruction-data --output /path/to/instruction-run
```

The tokenizer is trained only on the training split. Loss is masked over prompt tokens and applied to assistant responses. Checkpoints include optimizer/scheduler state and config/dataset/tokenizer lineage hashes.

## Tool use

Instruction examples can teach structured tool-call formats, but the model must not be allowed to execute arbitrary generated commands. Desktop tool execution needs a separate schema validator, explicit user approval for filesystem/process changes, and an allowlisted tool router. MCT-07 does not enable arbitrary tool execution.

## Quality limits

A small or synthetic instruction dataset does not create general coding ability. Evaluate on held-out, task-specific examples and human-review generated code/designs before connecting any model to Unreal project modification.
