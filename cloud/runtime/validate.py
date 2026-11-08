"""Dependency-free validation helpers for MMD Cloud Training jobs."""
from __future__ import annotations
import json
from pathlib import Path

REQUIRED_PROVENANCE = ("source", "revision", "license", "license_url", "collected_at", "languages", "preprocessing", "splits")

def read_json(path: str | Path) -> dict:
    with Path(path).open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value

def validate_config(config: dict) -> None:
    if config.get("schema_version") != "mct.model-config.v1":
        raise ValueError("Unsupported model config schema_version.")
    if config.get("initialization", {}).get("weights") != "random":
        raise ValueError("MMD first-party models must start from random weights.")
    if config.get("resource_policy", {}).get("paid_fallback") is not False:
        raise ValueError("Paid fallback must remain disabled.")
    arch = config.get("architecture", {})
    for key in ("vocab_size", "max_sequence_length", "hidden_size", "num_layers", "num_attention_heads"):
        if not isinstance(arch.get(key), int) or arch[key] < 1:
            raise ValueError(f"architecture.{key} must be a positive integer.")
    if arch["hidden_size"] % arch["num_attention_heads"]:
        raise ValueError("hidden_size must be divisible by num_attention_heads.")
    languages = config.get("tokenizer", {}).get("languages", [])
    if not isinstance(languages, list) or not languages or any(x not in ("fa", "en") for x in languages):
        raise ValueError("This MMD Base release accepts only Persian (fa) and English (en).")
    if config.get("stage") == "base-test" and set(languages) != {"fa", "en"}:
        raise ValueError("The bilingual MMD Base test config must declare exactly fa and en.")
    if config.get("stage") == "base-test":
        if config.get("resource_policy", {}).get("require_cuda") is not True:
            raise ValueError("The 1B Base model must train on cloud CUDA; CPU fallback is disabled.")
        if float(config.get("resource_policy", {}).get("minimum_gpu_memory_gib", 0)) < 24:
            raise ValueError("The 1B Base model requires a declared 24 GiB GPU preflight minimum.")
        if config.get("training", {}).get("optimizer") != "adamw_8bit":
            raise ValueError("The 1B Base test profile must use 8-bit AdamW to reduce optimizer memory.")
        if config.get("training", {}).get("gradient_checkpointing") is not True:
            raise ValueError("The 1B Base test profile must enable gradient checkpointing.")
    train = config.get("training", {})
    for key in ("max_steps", "micro_batch_size", "gradient_accumulation_steps", "checkpoint_interval_steps"):
        if not isinstance(train.get(key), int) or train[key] < 1:
            raise ValueError(f"training.{key} must be a positive integer.")

def validate_provenance(provenance: dict) -> None:
    missing = [key for key in REQUIRED_PROVENANCE if provenance.get(key) in (None, "", [], {})]
    if missing:
        raise ValueError("Dataset provenance is incomplete: " + ", ".join(missing))
    if not isinstance(provenance["languages"], list) or not isinstance(provenance["splits"], dict):
        raise ValueError("languages must be a list and splits must be an object.")
    if not {"train", "validation", "test"}.issubset(provenance["splits"]):
        raise ValueError("Dataset provenance must define train, validation, and test splits.")

def validate_dataset(dataset_path: str | Path, provenance_path: str | Path) -> tuple[str, dict]:
    path = Path(dataset_path)
    if not path.is_file():
        raise FileNotFoundError(f"Dataset file not found: {path}")
    raw = path.read_text(encoding="utf-8")
    if len(raw.strip()) < 1000:
        raise ValueError("Pilot dataset must contain at least 1,000 non-whitespace characters.")
    provenance = read_json(provenance_path)
    validate_provenance(provenance)
    return raw, provenance

def validate_job(config_path: str | Path, dataset_path: str | Path, provenance_path: str | Path) -> dict:
    config = read_json(config_path)
    validate_config(config)
    raw, provenance = validate_dataset(dataset_path, provenance_path)
    allowed = set(config.get("tokenizer", {}).get("languages", []))
    supplied = set(provenance["languages"])
    if not supplied.issubset(allowed):
        raise ValueError("Dataset provenance contains languages outside the model's configured language set.")
    if config.get("stage") == "base-test" and supplied != {"fa", "en"}:
        raise ValueError("MMD Base 1B test data must include both Persian (fa) and English (en).")
    return {"config": config, "dataset_characters": len(raw), "dataset_revision": provenance["revision"]}
