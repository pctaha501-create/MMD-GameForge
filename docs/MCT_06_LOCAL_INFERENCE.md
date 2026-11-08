# MCT-06 — Desktop local inference runtime

MCT-06 connects imported model bundles to an optional local Python inference process.

## Desktop workflow

1. Open MMD AI Core and import an extracted, verified model bundle folder.
2. Select **Start runtime** for that model.
3. Select a Python executable whose environment has PyTorch and tokenizers installed.
4. Wait for model loading to finish. The app shows the active device (CPU or CUDA).
5. Select the model, enter a prompt and generate a response. Stop the runtime when finished.

The Electron main process launches `cloud/runtime/serve.py` from packaged application resources, passes a fresh per-process bearer token through the child environment, proxies generation requests over loopback, and terminates workers when the app exits. The Python process receives only a minimal environment allowlist rather than all Electron environment variables.

## Python environment

The runtime requires Python 3.10+ plus compatible PyTorch and tokenizers packages. These are intentionally not bundled into the desktop installer because PyTorch is large and CUDA wheels depend on the host. CPU inference is supported but may be slow; CUDA is used only when PyTorch detects a compatible GPU.

The app does not silently download or install Python packages. The selected Python environment must already contain the required dependencies.

## Security

- The server refuses any host other than 127.0.0.1.
- A random bearer token is generated for each runtime process and never shown in the renderer.
- Prompt size, generation length, temperature and top-k are bounded.
- Model config, checkpoint, tokenizer and bundle manifest hashes/lineage are checked before inference.
- Imported bundle file names are restricted and symbolic links are rejected.
- Runtime workers are stopped when the app exits.

## Limitations

This is a local inference bridge, not proof that a trained model is useful. It requires a real MMD-trained checkpoint and an installed Python environment. The small pilot models are experimental and may produce poor or incoherent output until sufficient licensed data and compute are available. No real cloud training run or trained weights are claimed by this code change.
