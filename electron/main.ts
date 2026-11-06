import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir, readdir, stat, readFile, writeFile, copyFile, realpath, access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import projectNameRules = require("../src/shared/project-name.cjs");
import type { ProjectSummary, ProjectFileNode, UnrealStatus, StudioSettings } from "../src/shared/types.js";

const { validateProjectName } = projectNameRules;
const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

async function summarizeProject(projectPath: string): Promise<ProjectSummary> {
  const resolved = path.resolve(projectPath);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error("The selected project path is not a directory.");
  const entries = await readdir(resolved, { withFileTypes: true });
  const visible = entries
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
    .slice(0, 80)
    .map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? "folder" as const : "file" as const }));
  return {
    name: path.basename(resolved),
    path: resolved,
    modifiedAt: info.mtime.toISOString(),
    entries: visible,
    entryCount: entries.length,
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#090c12",
    title: "MMD GameForge",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  if (isDevelopment) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadURL(pathToFileURL(path.join(__dirname, "../renderer/index.html")).toString());
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = isDevelopment
      ? url.startsWith("http://127.0.0.1:5173")
      : url === pathToFileURL(path.join(__dirname, "../renderer/index.html")).toString();
    if (!allowed) event.preventDefault();
  });
}

ipcMain.handle("app:get-info", () => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
}));

ipcMain.handle("project:create", async (_event, rawName: unknown) => {
  const name = validateProjectName(rawName);
  const parent = await dialog.showOpenDialog({
    title: "Choose where to create your game project",
    properties: ["openDirectory", "createDirectory"],
  });
  if (parent.canceled || !parent.filePaths[0]) return null;
  const projectPath = path.join(parent.filePaths[0], name);
  await mkdir(projectPath, { recursive: false });
  await mkdir(path.join(projectPath, "GameForge", "Notes"), { recursive: true });
  return summarizeProject(projectPath);
});

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open an Unreal Engine or GameForge project folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return summarizeProject(result.filePaths[0]);
});

ipcMain.handle("project:inspect", async (_event, projectPath: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) {
    throw new Error("Invalid project path.");
  }
  return summarizeProject(projectPath);
});


const ignoredDirectories = new Set([".git", "node_modules", "Binaries", "Intermediate", "Saved", "DerivedDataCache", ".vs"]);
const textExtensions = new Set(["ts","tsx","js","jsx","mjs","cjs","json","jsonc","md","txt","html","css","scss","xml","yml","yaml","ini","cfg","uproject","uplugin","h","hpp","c","cc","cpp","cs","py","bat","ps1","sh","toml","cmake","log","csv","svg"]);
const assetExtensions = new Set(["uasset","umap","fbx","obj","gltf","glb","png","jpg","jpeg","webp","tga","exr","hdr","wav","mp3","ogg","flac","mp4","mov","ttf","otf","mat","blend"]);
function inside(root: string, target: string): boolean { const rel = path.relative(root, target); return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel)); }
async function safeProjectFile(projectPath: unknown, relativePath: unknown): Promise<{ root: string; target: string }> {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath) || typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) throw new Error("Invalid project file path.");
  const root = await realpath(projectPath); const target = path.resolve(root, relativePath);
  if (!inside(root, target)) throw new Error("Path is outside the selected project.");
  const actual = await realpath(target); if (!inside(root, actual)) throw new Error("Symbolic links outside the project are not allowed.");
  return { root, target: actual };
}
async function walkProject(root: string, folders: string[], depth = 0): Promise<ProjectFileNode[]> {
  if (depth > 5 || folders.length > 2500) return folders;
  const dir = folders.length ? path.join(root, ...folders.map(x => x.split("/")).flat()) : root;
  const out: ProjectFileNode[] = [];
  let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name) || entry.isSymbolicLink()) continue;
    const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join("/");
    try {
      const info = await stat(path.join(dir, entry.name)); const extension = entry.isDirectory() ? "" : path.extname(entry.name).slice(1).toLowerCase();
      out.push({ name: entry.name, path: rel, kind: entry.isDirectory() ? "folder" : "file", size: info.size, extension });
      if (entry.isDirectory() && depth < 5 && out.length < 2500) out.push(...await walkProject(root, [rel], depth + 1));
    } catch { /* Skip inaccessible entries. */ }
    if (out.length >= 2500) break;
  }
  return out;
}
async function readStudioSettings(): Promise<StudioSettings> {
  try { return JSON.parse(await readFile(path.join(app.getPath("userData"), "settings.json"), "utf8")) as StudioSettings; } catch { return {}; }
}
async function writeStudioSettings(value: unknown): Promise<StudioSettings> {
  if (!value || typeof value !== "object") throw new Error("Invalid settings.");
  const raw = value as Record<string, unknown>;
  const settings: StudioSettings = {
    editorFontSize: Math.min(24, Math.max(10, Number(raw.editorFontSize) || 13)),
    wordWrap: Boolean(raw.wordWrap), confirmExternal: raw.confirmExternal !== false,
    unrealEditorPath: typeof raw.unrealEditorPath === "string" ? raw.unrealEditorPath.slice(0, 1024) : "",
  };
  const file = path.join(app.getPath("userData"), "settings.json"); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(settings, null, 2), "utf8"); return settings;
}
async function findUnrealEditor(preferred?: string): Promise<string | null> {
  const candidates = [preferred, process.env.UNREAL_EDITOR, ...(await (async () => { try { return (await readdir("C:\\Program Files\\Epic Games", { withFileTypes: true })).filter(x => x.isDirectory() && /^UE_/i.test(x.name)).map(x => path.join("C:\\Program Files\\Epic Games", x.name, "Engine", "Binaries", "Win64", "UnrealEditor.exe")); } catch { return []; } })())].filter((x): x is string => typeof x === "string" && !!x);
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* Continue probing. */ } }
  return null;
}

ipcMain.handle("project:files", async (_event, projectPath: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  const root = await realpath(projectPath); return walkProject(root, []);
});
ipcMain.handle("project:read-file", async (_event, projectPath: unknown, relativePath: unknown) => {
  const { target } = await safeProjectFile(projectPath, relativePath); const extension = path.extname(target).slice(1).toLowerCase();
  if (!textExtensions.has(extension)) throw new Error("This file type is not supported by the text editor.");
  const info = await stat(target); if (info.size > 2 * 1024 * 1024) throw new Error("Files larger than 2 MB are not opened in the built-in editor.");
  return { content: await readFile(target, "utf8"), size: info.size };
});
ipcMain.handle("project:write-file", async (_event, projectPath: unknown, relativePath: unknown, content: unknown) => {
  if (typeof content !== "string" || content.length > 2 * 1024 * 1024) throw new Error("Invalid content or file exceeds the 2 MB editor limit.");
  const { target } = await safeProjectFile(projectPath, relativePath); const extension = path.extname(target).slice(1).toLowerCase();
  if (!textExtensions.has(extension)) throw new Error("This file type cannot be edited in the built-in editor.");
  await writeFile(target, content, "utf8"); return { saved: true };
});
ipcMain.handle("project:assets", async (_event, projectPath: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  const root = await realpath(projectPath); const all = await walkProject(root, []);
  return all.filter(item => item.kind === "file" && assetExtensions.has(item.extension) && (item.path.startsWith("Content/") || item.path.startsWith("GameForge/Assets/")));
});
ipcMain.handle("project:import-assets", async (_event, projectPath: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  const root = await realpath(projectPath); const selected = await dialog.showOpenDialog({ title: "Import assets into GameForge", properties: ["openFile", "multiSelections"], filters: [{ name: "Game assets", extensions: [...assetExtensions] }, { name: "All files", extensions: ["*"] }] });
  if (selected.canceled) return [];
  const destination = path.join(root, "GameForge", "Assets"); await mkdir(destination, { recursive: true }); const imported: string[] = [];
  for (const source of selected.filePaths) { const base = path.basename(source); let target = path.join(destination, base); const ext = path.extname(base), stem = path.basename(base, ext); let n = 1; while (true) { try { await access(target); target = path.join(destination, `${stem}_${n++}${ext}`); } catch { break; } } await copyFile(source, target); imported.push(path.relative(root, target).split(path.sep).join("/")); }
  return imported;
});
ipcMain.handle("project:reveal", async (_event, projectPath: unknown, relativePath?: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  if (typeof relativePath === "string" && relativePath) { const { target } = await safeProjectFile(projectPath, relativePath); shell.showItemInFolder(target); }
  else shell.showItemInFolder(await realpath(projectPath)); return true;
});
ipcMain.handle("settings:get", () => readStudioSettings());
ipcMain.handle("settings:save", (_event, value: unknown) => writeStudioSettings(value));
ipcMain.handle("unreal:detect", async (_event, projectPath: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  const root = await realpath(projectPath); const entries = await readdir(root, { withFileTypes: true }); const descriptor = entries.find(x => x.isFile() && x.name.toLowerCase().endsWith(".uproject")); const settings = await readStudioSettings();
  const editorPath = await findUnrealEditor(settings.unrealEditorPath); return { installed: !!editorPath, editorPath, projectFile: descriptor ? path.join(root, descriptor.name) : null } satisfies UnrealStatus;
});
ipcMain.handle("unreal:launch", async (_event, projectFile: unknown, editorPath?: unknown) => {
  if (typeof projectFile !== "string" || !path.isAbsolute(projectFile) || path.extname(projectFile).toLowerCase() !== ".uproject") throw new Error("Invalid Unreal project descriptor.");
  await access(projectFile);
  if (typeof editorPath === "string" && path.isAbsolute(editorPath)) { await access(editorPath); const child = spawn(editorPath, [projectFile], { detached: true, stdio: "ignore", windowsHide: false }); child.unref(); }
  else { const error = await shell.openPath(projectFile); if (error) throw new Error(error); }
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
