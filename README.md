# MMD GameForge

**An independent AI-powered game creation studio for Unreal Engine.**

MMD GameForge is a Windows-first desktop application focused on helping creators design, build, inspect, and iteratively improve Unreal Engine games through a dedicated game-development workspace and conversational creative agent.

## Core principles

- **AI models built from scratch:** MMD's first-party model weights, training pipelines, datasets, evaluation, and inference systems are developed as part of this project. The project does not rely on pretrained third-party models as its foundation.
- **Local-first:** The long-term target is local execution and user-controlled project data.
- **Unreal Engine focused:** Game creation workflows, assets, code, scenes, and iteration are designed around Unreal Engine.
- **Human-directed iteration:** Creators can request changes in natural language, review proposed actions, and inspect results.
- **Modular research:** Language, code, vision, image, 3D, and audio capabilities are separate research tracks coordinated by the MMD AI Core.

## Project status

**Early planning / foundation stage.** The repository currently contains project documentation and initial development conventions. No production AI model or Unreal integration is claimed to exist yet.

## Planned capability areas

| Area | Intended responsibility |
| --- | --- |
| MMD AI Core | Model runtime, training orchestration, task planning, memory, and coordination |
| MMD Language | First-party language model research and training |
| MMD Code | Game-code and Unreal-specific programming assistance |
| MMD Vision | Image and scene understanding |
| MMD Image | First-party image-generation research |
| MMD 3D | First-party 3D asset-generation research |
| MMD Audio | First-party audio-generation research |
| MMD Creative Agent | User-directed planning, tool execution, validation, and iteration |
| Unreal Bridge | Controlled integration with Unreal Engine projects |

## Independence and dependencies

The goal is to train MMD's own models from random initialization rather than starting from downloaded pretrained model weights. General-purpose development tools, programming languages, compilers, mathematical libraries, and Unreal Engine may be used. Any dependency that contains pretrained model weights must be reviewed and explicitly excluded from the first-party model pipeline.

Training frontier-scale models is not realistic on every developer workstation. Development will therefore begin with reproducible small-scale experiments and scale requirements documented honestly as the project evolves.

## Development

The initial implementation plan and architecture will be documented before major application code is introduced.

## License

No license has been selected yet. Until a license is added, standard copyright restrictions apply; do not assume this repository grants permission to reuse its contents.
