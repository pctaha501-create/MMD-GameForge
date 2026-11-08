"""MMD from-scratch Persian/English Transformer trainer for user-started cloud notebooks.

Requires PyTorch and tokenizers in the selected notebook runtime. No pretrained
weights or hosted inference APIs are loaded. Dataset and provenance are supplied
by the user; this script never downloads training data.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
import random
import time
from pathlib import Path

from validate import read_json, validate_job

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)

def parse_args():
    parser = argparse.ArgumentParser(description="Train an MMD Persian/English model from random initialization.")
    parser.add_argument("--config", required=True)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--provenance", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-steps", type=int, default=None)
    parser.add_argument("--source-commit", default=os.environ.get("GITHUB_SHA", "local-unpinned"))
    parser.add_argument("--resume", action=argparse.BooleanOptionalAction, default=None)
    return parser.parse_args()

def main():
    args = parse_args()
    import torch
    import torch.nn as nn
    from tokenizers import ByteLevelBPETokenizer

    job = validate_job(args.config, args.dataset, args.provenance)
    config = job["config"]
    arch, train_cfg = config["architecture"], config["training"]
    max_steps = args.max_steps or train_cfg["max_steps"]
    if max_steps < 1:
        raise ValueError("--max-steps must be positive.")
    seed = int(config["initialization"]["seed"])
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    resource_policy = config.get("resource_policy", {})
    if resource_policy.get("require_cuda") and not torch.cuda.is_available():
        raise RuntimeError("This MMD Base configuration requires a cloud CUDA GPU; CPU training is disabled.")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cuda":
        required_gib = float(resource_policy.get("minimum_gpu_memory_gib", 0))
        available_gib = torch.cuda.get_device_properties(0).total_memory / 1024**3
        if required_gib and available_gib < required_gib:
            raise RuntimeError(
                f"Insufficient GPU memory for this configuration: {available_gib:.2f} GiB available; "
                f"at least {required_gib:.0f} GiB is required by the preflight policy. "
                "Choose a compliant larger free GPU; no CPU or paid fallback is allowed."
            )
    if device.type == "cuda":
        torch.backends.cuda.matmul.allow_tf32 = True
    print(f"Runtime: {device}; accelerator: {torch.cuda.get_device_name(0) if device.type == 'cuda' else 'CPU'}")
    if device.type == "cuda":
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GiB")

    text = Path(args.dataset).read_text(encoding="utf-8")
    n = len(text)
    split_details = provenance = read_json(args.provenance)
    studio = provenance.get("dataset_studio", {})
    offsets = studio.get("split_details", {})
    if all(name in offsets for name in ("train", "validation", "test")):
        train_text = text[offsets["train"]["corpus_start"]:offsets["train"]["corpus_end"]]
        val_text = text[offsets["validation"]["corpus_start"]:offsets["validation"]["corpus_end"]]
        test_text = text[offsets["test"]["corpus_start"]:offsets["test"]["corpus_end"]]
    else:
        train_end, val_end = int(n * 0.90), int(n * 0.95)
        train_text, val_text, test_text = text[:train_end], text[train_end:val_end], text[val_end:]
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    tokenizer_path = out / "tokenizer.json"
    tokenizer = ByteLevelBPETokenizer()
    tokenizer.train_from_iterator(
        [train_text],
        vocab_size=int(config["tokenizer"]["target_vocab_size"]),
        min_frequency=2,
        special_tokens=["<|endoftext|>"],
    )
    tokenizer.save(str(tokenizer_path))
    actual_vocab_size = tokenizer.get_vocab_size()
    if actual_vocab_size > int(arch["vocab_size"]):
        raise ValueError(f"Tokenizer produced {actual_vocab_size} tokens, exceeding architecture vocab_size={arch['vocab_size']}.")
    train_ids = torch.tensor(tokenizer.encode(train_text).ids, dtype=torch.long)
    val_ids = torch.tensor(tokenizer.encode(val_text).ids, dtype=torch.long)
    test_ids = torch.tensor(tokenizer.encode(test_text).ids, dtype=torch.long)
    seq_len = int(arch["max_sequence_length"])
    minimum_tokens = seq_len + 2
    for split_name, ids in (("train", train_ids), ("validation", val_ids), ("test", test_ids)):
        if len(ids) < minimum_tokens:
            raise ValueError(
                f"{split_name} split has {len(ids)} tokens; at least {minimum_tokens} are required "
                f"for sequence length {seq_len}. Add more licensed documents or use a smaller max_sequence_length."
            )

    from model import build_model
    model = build_model(config).to(device)
    actual_parameters = sum(parameter.numel() for parameter in model.parameters())
    if config.get("stage") == "base-test" and not 1_000_000_000 <= actual_parameters < 1_050_000_000:
        raise RuntimeError(f"Constructed model has {actual_parameters:,} parameters; expected a 1B-class model.")
    print(f"Constructed model: {actual_parameters:,} parameters ({actual_parameters / 1e9:.3f}B).")
    optimizer = torch.optim.AdamW(model.parameters(), lr=train_cfg["learning_rate"], weight_decay=train_cfg["weight_decay"])
    warmup = max(1, int(train_cfg.get("warmup_steps", 1)))
    def lr_factor(step):
        if step < warmup:
            return (step + 1) / warmup
        progress = min(1.0, (step - warmup) / max(1, max_steps - warmup))
        return 0.5 * (1.0 + math.cos(math.pi * progress))
    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_factor)
    precision = train_cfg.get("precision", "auto")
    use_amp = device.type == "cuda" and precision != "fp32"
    amp_dtype = torch.bfloat16 if precision == "bf16" or (precision == "auto" and device.type == "cuda" and torch.cuda.is_bf16_supported()) else torch.float16
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp and amp_dtype == torch.float16)
    loss_fn = nn.CrossEntropyLoss()
    config_hash = sha256(Path(args.config))
    checkpoint = out / "checkpoint.pt"
    manifest_path, metrics_path = out / "checkpoint-manifest.json", out / "metrics.json"
    start_step = 0
    resume = train_cfg.get("resume_from_checkpoint", True) if args.resume is None else args.resume
    if resume and checkpoint.exists():
        state = torch.load(checkpoint, map_location=device, weights_only=True)
        if state.get("config_sha256") != config_hash or state.get("dataset_revision") != provenance["revision"]:
            raise ValueError("Checkpoint config or dataset revision does not match this run.")
        if state.get("tokenizer_sha256") != sha256(tokenizer_path):
            raise ValueError("Checkpoint tokenizer does not match the newly built tokenizer.")
        model.load_state_dict(state["model"])
        optimizer.load_state_dict(state["optimizer"])
        scheduler.load_state_dict(state["scheduler"])
        scaler.load_state_dict(state.get("scaler", {}))
        start_step = int(state["global_step"])
        print(f"Resuming from step {start_step}.")
    else:
        print(f"Initialized {sum(p.numel() for p in model.parameters()):,} parameters from random weights.")

    def batch(source):
        starts = torch.randint(0, len(source) - seq_len - 1, (train_cfg["micro_batch_size"],))
        x = torch.stack([source[i:i+seq_len] for i in starts]).to(device)
        y = torch.stack([source[i+1:i+seq_len+1] for i in starts]).to(device)
        return x, y

    @torch.no_grad()
    def evaluate(source, batches=8):
        model.eval()
        losses = []
        for _ in range(batches):
            x, y = batch(source)
            with torch.autocast(device_type=device.type, enabled=use_amp, dtype=amp_dtype):
                logits = model(x)
                loss = loss_fn(logits.reshape(-1, logits.size(-1)), y.reshape(-1))
            losses.append(float(loss.detach().cpu()))
        model.train()
        return sum(losses) / len(losses)

    def save(step, val_loss, status="not_run"):
        temp = checkpoint.with_suffix(".pt.tmp")
        torch.save({
            "model": model.state_dict(), "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(), "scaler": scaler.state_dict(),
            "global_step": step, "config_sha256": config_hash,
            "dataset_revision": provenance["revision"], "tokenizer_sha256": sha256(tokenizer_path),
            "seed": seed,
        }, temp)
        os.replace(temp, checkpoint)
        metrics = {"global_step": step, "validation_loss": val_loss, "learning_rate": optimizer.param_groups[0]["lr"], "device": str(device)}
        atomic_json(metrics_path, metrics)
        artifacts = [{"path": item.name, "sha256": sha256(item), "size_bytes": item.stat().st_size} for item in (checkpoint, tokenizer_path)]
        manifest = {
            "schema_version": "mct.checkpoint.v1", "model_family": config["model_family"], "parameter_count": actual_parameters,
            "architecture_revision": "mmd-transformer-v1",
            "initialization": {"method": "architecture_defined", "seed": seed, "weights_origin": "random_initialization"},
            "training_state": {"global_step": step, "epoch": 0.0, "optimizer_state_included": True, "scheduler_state_included": True},
            "lineage": {"source_commit": args.source_commit if len(args.source_commit) >= 7 else "local-unpinned", "config_sha256": config_hash, "dataset_revision": provenance["revision"], "tokenizer_revision": sha256(tokenizer_path)},
            "artifacts": artifacts, "evaluation": {"status": status, "metrics_path": metrics_path.name},
        }
        atomic_json(manifest_path, manifest)
        print(f"Checkpoint saved at step {step}.")

    model.train()
    optimizer.zero_grad(set_to_none=True)
    last_val = float("nan")
    began = time.monotonic()
    interval = int(train_cfg["checkpoint_interval_steps"])
    accum = int(train_cfg["gradient_accumulation_steps"])
    runtime_budget = int(os.environ.get("MMD_MAX_RUNTIME_SECONDS", "0") or 0)
    global_step = start_step
    for step in range(start_step, max_steps):
        for _ in range(accum):
            x, y = batch(train_ids)
            with torch.autocast(device_type=device.type, enabled=use_amp, dtype=amp_dtype):
                logits = model(x)
                loss = loss_fn(logits.reshape(-1, logits.size(-1)), y.reshape(-1)) / accum
            scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), train_cfg.get("gradient_clipping", 1.0))
        scaler.step(optimizer)
        scaler.update()
        scheduler.step()
        optimizer.zero_grad(set_to_none=True)
        global_step = step + 1
        if global_step % int(train_cfg.get("evaluation_interval_steps", interval)) == 0 or global_step == max_steps:
            last_val = evaluate(val_ids)
            print(f"step={global_step} validation_loss={last_val:.4f} elapsed={time.monotonic()-began:.0f}s")
        if global_step % interval == 0 or global_step == max_steps:
            save(global_step, last_val)
        if runtime_budget > 0 and time.monotonic() - began >= runtime_budget:
            print("Runtime budget reached; checkpointing and stopping cleanly.")
            save(global_step, last_val)
            break
    test_loss = evaluate(test_ids)
    atomic_json(metrics_path, {"global_step": global_step, "validation_loss": last_val, "test_loss": test_loss, "elapsed_seconds": round(time.monotonic()-began, 2), "device": str(device)})
    save(global_step, last_val, "passed" if math.isfinite(test_loss) else "failed")
    print(f"Finished. test_loss={test_loss:.4f}; artifacts: {out}")

if __name__ == "__main__":
    main()
