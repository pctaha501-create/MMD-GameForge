# MMD GameForge

**A Windows-first game creation studio for Unreal Engine, with first-party AI models trained from scratch.**

MMD GameForge is an independent desktop workspace for creating and iterating on Unreal Engine projects. Its AI program uses MMD-owned model architectures, random initialization, licensed training data, and user-reviewed project actions.

## Core principles

- **First-party AI:** MMD model weights start from random initialization; no pretrained checkpoints or hosted AI APIs are required.
- **Cloud-first training:** training runs in user-started, policy-compliant notebook sessions; the developer laptop is not used as a training worker.
- **Local desktop:** project files and approved tools remain under the user's control.
- **Unreal-focused:** code, project structure, scenes and game-design workflows are designed around Unreal Engine.
- **Human-directed:** AI-generated project changes are validated and require user approval.
- **Honest capability reporting:** model configuration, trained weights, benchmarked capability and production readiness are distinct states.

## Current development status

**Phase 02 — Desktop foundation: in progress.**

The repository contains an Electron + TypeScript desktop shell, project workspace, typed IPC bridge, World/Code/Assets modules, and cross-platform CI.

**MMD AI Core — implementation in progress.**

- Model Workshop with from-scratch architecture profiles and parameter/memory estimates.
- Import of extracted model bundles with SHA-256 and checkpoint-lineage validation.
- Local model inventory and an optional Python inference process using loopback-only authenticated requests.
- Prompt playground for imported models.
- Allowlisted project file, scene and Unreal actions with explicit user approval, plus read-only Unreal project structure validation and approval-gated creation of a C++ Unreal starter project.
- Tool-call validation rejects path traversal, arbitrary tools and shell execution.

The desktop inference path requires a user-selected Python environment with PyTorch and tokenizers. No trained model weights are included yet.

**MMD Cloud Training — MCT-01 through MCT-09 foundations in progress.**

- Versioned training/checkpoint contracts and provider policy.
- From-scratch Transformer pretraining and response-only instruction training.
- Dataset Studio with license/provenance records, normalization, deduplication and deterministic splits.
- Model Factory, parameter/memory estimation and SQLite experiment registry.
- Held-out evaluation, hash-verified model bundles and task benchmark reports.
- Kaggle and Colab notebook templates; users must start sessions themselves.

These are engineering foundations, not evidence that a useful model has already been trained. No real cloud GPU training run or trained MMD weights are claimed.

## Remaining AI release gates

1. Prepare and review properly licensed multilingual and game-development instruction datasets.
2. Run actual small-scale cloud training and measure time, VRAM, loss and checkpoint recovery.
3. Evaluate generated code and game-design outputs on held-out tasks, including human review.
4. Connect verified models to the desktop inference runtime and test on supported Windows hardware.
5. Validate tool-assisted changes in disposable Unreal projects and build them with UnrealBuildTool.
6. Complete reliability, security and end-to-end Windows acceptance tests.

Vision, image generation, audio, 3D and video models are separate research tracks. Training large models from scratch is not guaranteed to fit free GPU quotas.

## Quick start

Requirements: Node.js 24+, npm, and Git.

```powershell
git clone https://github.com/pctaha501-create/MMD-GameForge.git
cd MMD-GameForge
npm install
npm run dev
```

See [Development Guide](docs/DEVELOPMENT.md), [Architecture](docs/ARCHITECTURE.md), [Roadmap](docs/ROADMAP.md), [AI from-scratch policy](docs/AI_FROM_SCRATCH_POLICY.md), and [MMD Cloud Training](cloud/README.md).

## License

No license has been selected yet. Until a license is added, standard copyright restrictions apply.
