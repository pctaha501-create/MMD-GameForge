# MCT-08 — Approval-gated GameForge tool router

MCT-08 connects structured model proposals to a small allowlisted set of desktop project actions. It does not execute arbitrary code or shell commands.

## Tool-call envelope

```json
{
  "schema_version": "mmd.tool-call.v1",
  "tool": "project.read_file",
  "arguments": { "path": "Source/Game.cpp" }
}
```

## Allowlisted tools

- `project.list_files`: list files in the active project.
- `project.read_file`: read a supported text file.
- `project.create_file`: create a new supported text file in an existing project folder.
- `project.write_file`: overwrite a supported text file.
- `scene.save`: save a validated GameForge scene JSON document.
- `unreal.detect`: inspect whether Unreal Editor and a .uproject are available.
- `unreal.launch`: launch the active .uproject in a detected Unreal Editor after confirmation.

## Safety rules

- Unknown tool names and unexpected arguments are rejected.
- File paths must be relative, cannot contain traversal segments, and are revalidated in Electron main.
- New file creation uses exclusive-create semantics and requires an existing parent folder.
- File writes are limited to supported text extensions and 2 MB.
- Scene documents are capped at 25 MB and must have a GameForge Group root.
- Every proposal is shown to the user. Writes, scene saves and Unreal launch require an explicit confirmation.
- No shell, PowerShell, arbitrary process, network, or unrestricted filesystem tool exists.
- Tool results are returned to the chat UI as text; the model cannot silently chain actions.

## Current limitations

The tool protocol is only useful when the active model has learned the exact schema. The MCT-07 instruction trainer and licensed task examples provide the training path, but no general-purpose tool-using model has been trained or benchmarked yet. Tool execution must remain disabled for untrusted or unverified model bundles.
