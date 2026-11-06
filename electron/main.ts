import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ProjectSummary } from "../src/shared/types.js";

const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function assertSafeProjectName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 64 || /[<>:"/\\|?*\x00-\x1f]/.test(name) || name === "." || name === "..") {
    throw new Error("Project name must be 1–64 characters and cannot contain filesystem-reserved characters.");
  }
  return name;
}

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = isDevelopment && url.startsWith("http://127.0.0.1:5173");
    if (!allowed && !url.startsWith("file://")) event.preventDefault();
  });
}

ipcMain.handle("app:get-info", () => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
}));

ipcMain.handle("project:create", async (_event, rawName: unknown) => {
  if (typeof rawName !== "string") throw new Error("A project name is required.");
  const name = assertSafeProjectName(rawName);
  const parent = await dialog.showOpenDialog({
    title: "Choose where to create your game project",
    properties: ["openDirectory", "createDirectory"],
  });
  if (parent.canceled || !parent.filePaths[0]) return null;
  const projectPath = path.join(parent.filePaths[0], name);
  await mkdir(projectPath, { recursive: false });
  await mkdir(path.join(projectPath, "GameForge"), { recursive: true });
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

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
