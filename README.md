# MMD GameForge

**AI-Powered Game Creation Studio**

MMD GameForge is a dedicated game-development environment focused on creating and iterating Unreal Engine projects with a proprietary AI system designed and trained by the MMD team.

## Core principles

- **AI models built from scratch:** MMD's first-party model architectures, tokenizers, datasets, training pipelines, evaluation suites, and inference runtimes are developed as part of this project.
- **No pretrained model weights:** The core product must not depend on downloaded, fine-tuned, distilled, or otherwise pretrained third-party AI model weights.
- **Local-first execution:** The long-term target is local operation, with hardware-aware model sizes and optional support for stronger local machines.
- **Game-development focus:** The product is purpose-built for Unreal Engine workflows, not a general-purpose chatbot.
- **Human-directed iteration:** Users can request changes in natural language, inspect proposed results, approve them, and iterate.
- **Clear separation of integrations:** Any future optional external provider or third-party model connector must remain isolated, explicitly opt-in, and must never become a dependency of MMD's own AI core.

## Planned capabilities

- Project-aware AI assistant for Unreal Engine
- Game design, gameplay systems, and level planning
- Code and Blueprint assistance
- Image understanding and visual asset generation
- Character, environment, and 3D asset workflows
- Audio workflows for games
- Project inspection, validation, and iterative changes
- A dedicated training lab for MMD's models

## Development status

**Stage:** Project foundation and technical planning.

The repository does not yet contain a working AI model, Unreal integration, or production application. These will be implemented and validated incrementally. The current interface preview is a design prototype, not a functional game editor.

## Documentation

- [Project vision](docs/PROJECT_VISION.md)
- [AI-from-scratch policy](docs/AI_FROM_SCRATCH_POLICY.md)

## Important constraints

Training frontier-scale language, image, audio, or 3D models requires substantial datasets and compute. Development will begin with small, independently initialized models and measurable experiments, then scale when suitable hardware and data are available. No pretrained model will be silently substituted to make a feature appear complete.

## Repository policy

Do not commit secrets, API keys, private datasets, user projects, or large model checkpoints. Store model artifacts outside Git and document reproducible training and evaluation procedures.