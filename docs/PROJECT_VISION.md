# MMD GameForge — Project Vision

## Mission

Build a dedicated desktop studio for creating, inspecting, and iterating Unreal Engine games with a first-party AI stack whose models are designed and trained by MMD from random initialization.

## Product experience

The application is organized around a game project, not a generic chat session. The user works with a central project workspace, visual previews, asset and level tools, project files, and a context-aware creative agent. Chat is the natural-language control surface for proposing and refining changes; consequential project modifications should be reviewable and reversible.

## Product areas

1. **Project workspace:** Create, open, inspect, and manage game projects.
2. **Creative Agent:** Understand project context, plan tasks, propose edits, and coordinate specialized capabilities.
3. **World Builder:** Assist with level layout, environment composition, lighting, and scene iteration.
4. **Characters and assets:** Create and manage character concepts, materials, props, and 3D asset workflows.
5. **Code and Blueprint:** Assist with Unreal C++ and Blueprint-oriented game logic.
6. **Audio Studio:** Support game audio and sound workflows.
7. **Training Lab:** Prepare datasets, configure experiments, train models, and evaluate checkpoints.
8. **Model Center:** Manage MMD-owned model versions, capabilities, resource needs, and local inference.
9. **Project files and validation:** Inspect changes, run checks, and keep a traceable project history.

## AI independence

MMD's own models are the product's primary intelligence. They must be independently initialized and trained; no third-party pretrained model weights may be used as a base. General-purpose software libraries, compilers, graphics tools, Unreal Engine, and standard numerical infrastructure may be used, provided they do not smuggle pretrained AI weights into the core.

Optional integrations, if introduced later, must be clearly labeled, disabled by default, and isolated from the first-party AI runtime. MMD GameForge must remain useful without them.

## Engineering principles

- Local-first and privacy-conscious.
- Modular model families with documented interfaces.
- Reproducible datasets, training runs, checkpoints, and evaluations.
- Hardware-aware execution and graceful low-resource modes.
- Explicit user approval for destructive or broad project changes.
- Honest capability reporting: distinguish a real model capability from a UI mockup or planned feature.
- Incremental delivery with tests and runnable milestones.

## Initial milestone

Establish the repository structure, technical architecture, development environment, and a tiny end-to-end research experiment that proves MMD can initialize, train, save, reload, and evaluate its own model without importing pretrained weights.