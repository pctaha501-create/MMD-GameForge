# MCT-06 — Local inference runtime

MCT-06 starts with an optional local runtime for already imported model bundles. It requires a Python environment with PyTorch and tokenizers; these dependencies are not silently bundled into the Windows installer.

## Start manually

```powershell
$env:MMD_RUNTIME_TOKEN = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
python cloud/runtime/serve.py --model-dir "$env:APPDATA\MMD GameForge\models\<installed-model-folder>" --port 8765
```

The runtime validates the bundle manifest, config hash, checkpoint lineage and tokenizer hash before loading. It binds exclusively to 127.0.0.1 and requires a per-process bearer token. Only /health and /generate are exposed; generation requests are size-bounded and serialized.

This script is the inference backend foundation. The desktop process launcher, lifecycle controls and interactive chat UI are still to be completed. Do not expose the runtime port outside loopback or reuse the token.
