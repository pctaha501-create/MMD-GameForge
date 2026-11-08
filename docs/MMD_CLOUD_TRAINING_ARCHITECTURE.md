# MMD Cloud Training Architecture

## Goals

MMD Cloud Training (MCT) is the cloud-first training subsystem inside the MMD GameForge repository. Training, dataset processing, evaluation, and checkpoint storage must execute remotely. The developer's laptop is a browser/control surface only and is never a required compute worker.

The first-party model policy remains mandatory: every MMD model starts from newly initialized random weights and is trained by this project. PyTorch and other general-purpose numerical libraries are implementation tools, not sources of pretrained weights.

## MCT-01 scope

MCT-01 establishes durable interfaces and policy, not a live training service:

- Versioned JSON contracts for training jobs and checkpoints.
- A small multilingual decoder-only Transformer pilot configuration.
- Provider capability and terms-of-use boundaries.
- Public-repository secret and dataset-license guidance.
- Automated tests for the contracts and pilot configuration.

Not included yet: a hosted dashboard, a job API, automatic cloud account login, automatic GPU provisioning, distributed training, live model inference, or a completed multilingual model.

## Logical architecture

```text
MMD GameForge (desktop / browser control surface)
                  |
          Job Manifest + Config
                  |
        Provider Notebook Adapter
           /             \
      Kaggle Notebook   Colab Notebook
           \             /
            Checkpoint + Metrics
                  |
       Public Model / Dataset Registry
```

The provider adapter prepares a reproducible notebook package and records the provider/runtime metadata. The user explicitly opens and starts a notebook session under the provider's supported workflow. The system must not promise unattended execution or attempt to bypass provider controls.

## Provider strategy

### Kaggle

Primary free GPU experiment target. Use the supported Kaggle Notebook interface and/or Kaggle API for notebook versioning and execution where permitted by current account quotas and product rules. GPU availability, accelerator type, quota, and session duration are provider-controlled and can change. A notebook must checkpoint frequently and finish each run within the currently available session window.

### Google Colab

Secondary interactive notebook target. The free tier is opportunistic and has dynamic limits. Do not use free managed runtimes as persistent remote workers, distributed-computing workers, SSH/remote-desktop hosts, or as a backend hidden behind a separate web UI. Colab notebook execution remains user-directed and compliant with its current terms.

### Hugging Face Hub

Optional public registry for datasets, model artifacts, tokenizer files, and metadata, subject to storage limits and each dataset/model license. It is not a GPU scheduler and must not be treated as unlimited backup storage.

### Additional providers

New providers are added only after reviewing their current free-tier limits, automation rules, public artifact terms, and secret-handling model. "All providers" means pluggable, policy-compliant adapters; it does not mean quota circumvention, account rotation, or combining accounts to evade limits.

## Training job lifecycle

1. Validate the versioned job manifest and referenced config.
2. Resolve the exact dataset revision and verify its license/provenance record.
3. Select a provider adapter based on supported hardware and policy.
4. Create a reproducible notebook run with code revision, seed, config hash, and runtime metadata.
5. Initialize every model parameter from the documented random initialization method.
6. Train within the provider's available session and resource limits.
7. Save an atomic checkpoint and metrics at configured intervals.
8. On interruption, resume only from a verified checkpoint with matching model/config/tokenizer lineage.
9. Evaluate on a held-out split and publish artifacts only with provenance metadata.

## Checkpoint portability

A checkpoint must include model weights, optimizer/scheduler state when supported, step/epoch, RNG state, model configuration, tokenizer revision, dataset revision, source commit, and SHA-256 hashes. Provider-specific paths are transport details; the logical checkpoint manifest remains provider-neutral.

## Initial multilingual pilot

The checked-in pilot config is a deliberately small architecture for measuring end-to-end feasibility on limited free accelerators. It is not a claim of ChatGPT-level capability or a production model size. Model dimensions, context length, batch size, and precision must be adjusted only after a real runtime memory/throughput test.

## Public project and data governance

The repository is public by project choice, but public visibility does not grant rights to third-party datasets. Every dataset must have a source URL, revision or snapshot identifier, license, attribution requirements, collection date, preprocessing description, and split strategy. Do not upload private, personal, restricted, or unlicensed data.

Never commit API keys, Kaggle credentials, Hugging Face tokens, OAuth tokens, cookies, or private dataset links. Use provider-managed notebook secrets and least-privilege tokens. Public model artifacts must include provenance and a license decision.

## Cost and availability guarantee

The project targets zero user spend. It cannot guarantee continuous GPU availability, unlimited free storage, a fixed accelerator, or a fixed quota. If no compliant free accelerator is available, the job remains queued/paused; it must not silently switch to a paid resource.


## Bilingual MMD Base 1B test target

The current test target is defined in `cloud/configs/mmd-base-1b-bilingual.json`: 1,022,871,552 estimated parameters, Persian and English only, random initialization, and a tokenizer trained from the supplied licensed corpus. The runtime rejects datasets whose provenance contains languages outside the configured pair and requires both languages for this test profile. A 24 GiB CUDA preflight is enforced; it does not guarantee that any particular free provider session will fit or be available. The developer laptop is not used for training.
