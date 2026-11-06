# Desktop architecture

## Runtime boundaries

MMD GameForge uses Electron with three deliberately separated areas:

- **Main process** (`electron/main.ts`): owns the native window, operating-system dialogs, and filesystem operations.
- **Preload bridge** (`electron/preload.ts`): exposes a small, typed API through `contextBridge`. Renderer code never receives raw Node.js or Electron access.
- **Renderer** (`src/renderer`): owns the visual workspace and calls only the explicit `window.gameForge` methods.

The renderer runs with `nodeIntegration: false`, `contextIsolation: true`, and sandboxing enabled. A restrictive Content Security Policy is included in the application HTML. New windows and unexpected navigation are denied.

## Current desktop capabilities

- Create a named project folder after choosing a parent directory.
- Initialize a small `GameForge/Notes` workspace folder inside a new project.
- Open an existing directory, including an existing Unreal project folder.
- Inspect a shallow, read-only directory snapshot (hidden items and `node_modules` are excluded; at most 80 entries are shown).
- Keep up to six recently opened project paths in renderer-local storage.

The current project browser does not parse or modify Unreal project files. It does not claim that Unreal Engine is installed or connected.

## Planned boundaries

The next engineering phases can add dedicated services behind narrow interfaces:

- Unreal Bridge: project discovery, engine-version detection, safe process launch, and editor integration.
- MMD AI Core: model registry, inference/training job orchestration, resource limits, and provenance.
- Asset services: indexing, metadata, thumbnails, and explicit import operations.

First-party model training must start from random initialization. General-purpose libraries and development tools are allowed, but pretrained model weights must not become a hidden dependency.
