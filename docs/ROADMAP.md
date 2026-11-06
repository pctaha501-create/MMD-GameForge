# MMD GameForge — Initial Roadmap

This roadmap is a planning document, not a claim that the listed capabilities are already implemented.

## Phase 1 — Repository and product foundation
- [x] Create the public GitHub repository
- [x] Add initial project documentation
- [ ] Confirm application architecture and supported Windows baseline
- [ ] Define coding standards and contribution workflow

## Phase 2 — Desktop application shell
- [ ] Build the desktop application shell
- [ ] Implement the approved workspace layout
- [ ] Add project creation, opening, and recent-project management
- [ ] Add settings and diagnostics views

## Phase 3 — MMD AI Core foundations
- [ ] Specify model interfaces and tensor/data formats
- [ ] Implement reproducible training experiments from random initialization
- [ ] Implement checkpointing, metrics, and evaluation
- [ ] Build a local inference/runtime layer

## Phase 4 — First-party model research
- [ ] Language model
- [ ] Code and Unreal workflow model
- [ ] Vision model
- [ ] Image model
- [ ] 3D model
- [ ] Audio model

Each model track must document its dataset provenance, initialization method, training configuration, evaluation, and hardware requirements.

## Phase 5 — Unreal Engine integration
- [ ] Define a safe Unreal project bridge
- [ ] Inspect project structure and assets
- [ ] Apply user-approved changes
- [ ] Validate builds and report errors

## Phase 6 — Creative Agent and iteration
- [ ] Natural-language task planning
- [ ] Approval and execution workflow
- [ ] Change history and rollback strategy
- [ ] Automated validation and repair loops

## Phase 7 — Testing and release
- [ ] Automated tests and performance profiling
- [ ] Windows packaging
- [ ] Release documentation
