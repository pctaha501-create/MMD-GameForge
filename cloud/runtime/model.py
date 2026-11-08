"""Shared MMD decoder-only Transformer architecture."""
from __future__ import annotations

def build_model(config: dict):
    import torch
    import torch.nn as nn
    arch = config["architecture"]
    seq_len = int(arch["max_sequence_length"])
    class MMDTransformer(nn.Module):
        def __init__(self):
            super().__init__()
            self.token = nn.Embedding(arch["vocab_size"], arch["hidden_size"])
            self.position = nn.Embedding(seq_len, arch["hidden_size"])
            layer = nn.TransformerEncoderLayer(
                d_model=arch["hidden_size"], nhead=arch["num_attention_heads"],
                dim_feedforward=arch["hidden_size"] * arch["feed_forward_multiplier"],
                dropout=arch["dropout"], activation="gelu", batch_first=True, norm_first=True,
            )
            self.blocks = nn.TransformerEncoder(layer, num_layers=arch["num_layers"], enable_nested_tensor=False)
            self.norm = nn.LayerNorm(arch["hidden_size"])
            self.head = nn.Linear(arch["hidden_size"], arch["vocab_size"], bias=False)
            if arch.get("tie_word_embeddings", True):
                self.head.weight = self.token.weight
            self.register_buffer("causal_mask", torch.triu(torch.ones(seq_len, seq_len, dtype=torch.bool), diagonal=1), persistent=False)
            self.apply(self._init)
        @staticmethod
        def _init(module):
            if isinstance(module, (nn.Linear, nn.Embedding)):
                nn.init.normal_(module.weight, mean=0.0, std=0.02)
                if isinstance(module, nn.Linear) and module.bias is not None:
                    nn.init.zeros_(module.bias)
        def forward(self, ids):
            length = ids.size(1)
            positions = torch.arange(length, device=ids.device).unsqueeze(0)
            hidden = self.token(ids) + self.position(positions)
            hidden = self.blocks(hidden, mask=self.causal_mask[:length, :length])
            return self.head(self.norm(hidden))
    return MMDTransformer()

def generate(model, tokenizer, prompt: str, *, max_new_tokens: int = 96,
             temperature: float = 0.8, top_k: int = 40, device=None) -> str:
    import torch
    if max_new_tokens < 1 or max_new_tokens > 2048:
        raise ValueError("max_new_tokens must be between 1 and 2048.")
    if temperature <= 0 or temperature > 2:
        raise ValueError("temperature must be greater than 0 and at most 2.")
    if top_k < 1:
        raise ValueError("top_k must be positive.")
    ids = tokenizer.encode(prompt).ids
    if not ids:
        raise ValueError("Prompt must produce at least one token.")
    device = device or next(model.parameters()).device
    seq_len = model.position.num_embeddings
    model.eval()
    generated = list(ids)
    eos_id = tokenizer.token_to_id("<|endoftext|>")
    with torch.no_grad():
        for _ in range(max_new_tokens):
            context = torch.tensor([generated[-seq_len:]], dtype=torch.long, device=device)
            logits = model(context)[0, -1] / temperature
            if top_k < logits.numel():
                values, indices = torch.topk(logits, top_k)
                filtered = torch.full_like(logits, float("-inf"))
                filtered.scatter_(0, indices, values)
                logits = filtered
            next_id = int(torch.multinomial(torch.softmax(logits, dim=-1), 1).item())
            generated.append(next_id)
            if eos_id is not None and next_id == eos_id:
                break
    return tokenizer.decode(generated[len(ids):])

