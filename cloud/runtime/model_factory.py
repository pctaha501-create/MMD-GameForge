"""MMD Model Factory: create and estimate first-party model configurations."""
from __future__ import annotations
import argparse, copy, json, math
from pathlib import Path

BASE = {
    "schema_version": "mct.model-config.v1",
    "model_family": "MMD-Bilingual-Tiny",
    "stage": "experiment",
    "description": "Small Persian/English decoder-only Transformer initialized from random weights.",
    "architecture": {
        "type": "decoder_only_transformer", "vocab_size": 8000,
        "max_sequence_length": 256, "hidden_size": 128, "num_layers": 2,
        "num_attention_heads": 4, "feed_forward_multiplier": 4,
        "dropout": 0.1, "tie_word_embeddings": True
    },
    "tokenizer": {
        "type": "byte_level_bpe", "training_from_scratch": True,
        "target_vocab_size": 8000, "normalization": "unicode_nfc",
        "languages": ["fa", "en"]
    },
    "initialization": {"weights": "random", "method": "architecture_defined", "seed": 20261108},
    "training": {
        "objective": "causal_language_modeling_next_token_prediction",
        "optimizer": "adamw", "learning_rate": 0.0003, "weight_decay": 0.1,
        "warmup_steps": 50, "max_steps": 500, "micro_batch_size": 1,
        "gradient_accumulation_steps": 8, "gradient_clipping": 1.0,
        "precision": "auto", "checkpoint_interval_steps": 50,
        "evaluation_interval_steps": 50, "resume_from_checkpoint": True
    },
    "data": {"require_license_record": True, "require_provenance_record": True,
             "deduplicate": True, "split": ["train", "validation", "test"],
             "language_balance": "measure_before_sampling"},
    "resource_policy": {"target": "free_compliant_cloud_notebooks",
                        "paid_fallback": False, "user_started_sessions_only": True,
                        "save_checkpoint_before_runtime_limit": True}
}

PROFILES = {
    "multilingual-tiny": ("MMD-Multilingual-Tiny", 8000, 256, 128, 2, 4, 500),
    "multilingual-pilot": ("MMD-Multilingual-Base", 16000, 512, 384, 6, 6, 2000),
    "code-tiny": ("MMD-Code-Tiny", 12000, 256, 192, 3, 6, 800),
    "game-design-tiny": ("MMD-GameDesign-Tiny", 12000, 256, 192, 3, 6, 800),
    "game-agent-tiny": ("MMD-Game-Agent-Tiny", 12000, 512, 192, 4, 6, 1000),
    # ~1.023B parameters with tied embeddings; designed for a 24 GiB+ cloud GPU.
    "bilingual-base-1b": ("MMD-Base-1B-Bilingual", 32000, 256, 2048, 19, 16, 1000),
}

def estimate_parameters(config: dict) -> dict:
    arch = config["architecture"]
    vocab, seq, d = (int(arch[k]) for k in ("vocab_size", "max_sequence_length", "hidden_size"))
    layers, ff_mult = int(arch["num_layers"]), int(arch["feed_forward_multiplier"])
    ff = d * ff_mult
    embedding = vocab * d + seq * d
    # Per TransformerEncoderLayer: Q/K/V + output projections, two FFN
    # projections, and two LayerNorms, including biases.
    attention = 4 * d * d + 4 * d
    feed_forward = d * ff + ff + ff * d + d
    norms = 4 * d
    per_layer = attention + feed_forward + norms
    final_norm = 2 * d
    lm_head = 0 if arch.get("tie_word_embeddings", True) else vocab * d + vocab
    total = embedding + layers * per_layer + final_norm + lm_head
    return {
        "total_parameters": total,
        "embedding_parameters": embedding,
        "transformer_parameters": layers * per_layer,
        "output_head_parameters": lm_head,
        "fp32_weights_mib": total * 4 / 1024**2,
        "adamw_training_state_mib_lower_bound": total * 16 / 1024**2,
        "activation_estimate_note": "Activation memory, CUDA workspace, fragmentation and framework overhead are additional; this is not a VRAM fit guarantee."
    }

def create_config(profile: str, seed: int | None = None) -> dict:
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile {profile!r}; choose one of {', '.join(PROFILES)}")
    name, vocab, seq, hidden, layers, heads, steps = PROFILES[profile]
    config = copy.deepcopy(BASE)
    config["model_family"] = name
    config["architecture"].update(vocab_size=vocab, max_sequence_length=seq, hidden_size=hidden,
                                  num_layers=layers, num_attention_heads=heads)
    config["tokenizer"]["target_vocab_size"] = vocab
    config["training"]["max_steps"] = steps
    if profile == "bilingual-base-1b":
        config["stage"] = "base-test"
        config["description"] = "Approximately 1.023B-parameter Persian/English decoder-only Transformer; random initialization only. Requires a compatible cloud GPU and is a test baseline, not a trained model."
        config["training"].update(micro_batch_size=1, gradient_accumulation_steps=16,
                                  precision="auto", checkpoint_interval_steps=25,
                                  evaluation_interval_steps=50)
        config["resource_policy"].update(require_cuda=True, minimum_gpu_memory_gib=24,
                                         hardware_note="AdamW state lower bound is about 15.25 GiB before activations and runtime overhead; 24 GiB is a minimum preflight, not a fit guarantee.")
    config["training"]["checkpoint_interval_steps"] = min(100, max(10, steps // 10))
    config["training"]["evaluation_interval_steps"] = config["training"]["checkpoint_interval_steps"]
    if profile == "bilingual-base-1b":
        config["training"].update(checkpoint_interval_steps=25, evaluation_interval_steps=50)
    if seed is not None:
        config["initialization"]["seed"] = seed
    return config

def main():
    parser = argparse.ArgumentParser(description="Create or estimate an MMD from-scratch model config.")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--profile", choices=sorted(PROFILES), required=True)
    create.add_argument("--output", required=True)
    create.add_argument("--seed", type=int, default=20261108)
    estimate = sub.add_parser("estimate")
    estimate.add_argument("--config", required=True)
    args = parser.parse_args()
    if args.command == "create":
        config = create_config(args.profile, args.seed)
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"created": args.output, "model_family": config["model_family"],
                          "estimate": estimate_parameters(config)}, indent=2))
    else:
        config = json.loads(Path(args.config).read_text(encoding="utf-8"))
        print(json.dumps(estimate_parameters(config), indent=2))

if __name__ == "__main__":
    main()
