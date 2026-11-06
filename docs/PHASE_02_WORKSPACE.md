# Phase 02 — Professional Workspace

This phase turns the desktop shell into a locally connected project workspace.

## Implemented in this phase

- Dashboard and recent-project navigation remain local-first.
- Project file explorer recursively indexes project files while skipping generated folders (`Binaries`, `Intermediate`, `Saved`, `DerivedDataCache`, `.git`, and `node_modules`).
- Built-in text editor opens supported source/config/document files up to 2 MB, supports tab indentation, line/column status, dirty state, and Ctrl+S saving.
- Asset Library indexes common Unreal/game asset formats under `Content/` and imported files under `GameForge/Assets/`; imports copy files without overwriting existing assets.
- World Builder includes an interactive WebGL preview viewport with orbit control and a scene outline. This is a preview viewport, not an Unreal level editor.
- Settings persist locally in Electron user data.
- Unreal integration detects a `.uproject` in the selected folder, probes a configured/installed editor, and can request launch of the project.
- Filesystem access is exposed through a restricted preload API and path checks; no Node integration is enabled in the renderer.

## Current boundaries

- The editor is a lightweight built-in text editor, not a full IDE or language server.
- The WebGL viewport currently renders a built-in wireframe primitive; it does not yet import/parse arbitrary FBX, OBJ, glTF or Unreal assets into a complete scene.
- Unreal detection/launch is implemented, but editor UI automation, Blueprint graph editing, asset cooking, packaging and live scene synchronization are not part of this phase.
- Asset metadata, thumbnails and previews are indexed only at a basic file level.

## Validation

Run `npm run typecheck`, `npm test`, and `npm run build` on Windows and Linux CI. Test file open/save, asset import, path traversal rejection, settings persistence, and Unreal detection on a machine with Unreal Engine installed before declaring this phase production complete.
