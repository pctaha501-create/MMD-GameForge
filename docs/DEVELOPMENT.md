# Development guide

## Requirements

- Node.js 24 or newer
- npm
- Git

Windows is the primary target. The desktop shell can also be type-checked and built on Ubuntu through CI.

## Install and run

```powershell
git clone https://github.com/pctaha501-create/MMD-GameForge.git
cd MMD-GameForge
npm install
npm run dev
```

The development command starts Vite, compiles the Electron main/preload TypeScript in watch mode, and launches the desktop app.

## Quality checks

```powershell
npm run typecheck
npm test
npm run build
```

Create a Windows NSIS installer:

```powershell
npm run dist
```

The installer output is written to `release/`. The first dependency installation and first Electron packaging run require internet access to obtain npm packages and the Electron binary; the source repository itself does not include those binaries.

## Project status

This is the Phase 02 desktop foundation. The navigation and workspaces establish the application shell; project folder operations are functional. World editing, code generation, asset processing, model inference/training, and Unreal Engine integration are not implemented yet. UI labels marked as planned or in development are intentional.
