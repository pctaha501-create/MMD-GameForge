# Phase 03 — 3D Scene Editor

## Scope delivered

- Real Three.js viewport with perspective camera, orbit/pan/zoom controls, PBR lighting and a visible editor grid.
- Primitive authoring: cube, sphere, cylinder and plane.
- Import 3D files from the user's computer into the project and load GLB, glTF, OBJ, FBX and STL geometry.
- glTF external buffer and image references are resolved from files inside the selected project; GLB supports embedded resources. Remote glTF references are rejected to preserve offline operation. OBJ/FBX are loaded as geometry with a neutral material; external FBX/OBJ material libraries are not applied automatically.
- Scene Outliner with selection, object rename and delete.
- Transform gizmos for translate, rotate and scale, plus keyboard shortcuts W/E/R.
- Numeric transform inspector, visibility toggle and standard material base-color/roughness/metalness controls.
- Save/load editable Three.js scene documents under `GameForge/Scenes/*.mmdscene.json`.
- Project-scoped IPC for reading supported assets and scene persistence, with path containment checks and size limits.
- Windows CI packaging uses `--publish never` so the build creates an installer artifact instead of attempting an unauthenticated GitHub release.

## Explicit boundaries

- This is a standalone GameForge scene editor, not an Unreal Engine level editor. It does not write `.uasset` or `.umap` files or edit Blueprint graphs.
- It imports common interchange formats; it does not load native `.blend` or Unreal binary assets into the viewport.
- OBJ/FBX geometry is supported; external MTL/FBX material and animation fidelity is not guaranteed. glTF/GLB is the preferred interchange format.
- Scene files are GameForge JSON documents and are not Unreal map files.
- Large assets are capped at 100 MB each and scene documents at 25 MB.

## Validation gates

- `npm run typecheck`, `npm test`, `npm run build` on Linux and Windows.
- Windows `npm run dist` must produce the NSIS x64 installer and CI must upload the installer artifact.
- Manual Windows validation: import a GLB, glTF with external textures, OBJ, FBX and STL; add/delete primitives; change transform/material; save, close, reopen and compare scene contents.
