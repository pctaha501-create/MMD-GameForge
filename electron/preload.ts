import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, DesktopAPI, ProjectSummary, ProjectFileNode, UnrealStatus, StudioSettings, ImportedModel } from "../src/shared/types.js";

const api: DesktopAPI = {
  getAppInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>,
  listModels: () => ipcRenderer.invoke("models:list") as Promise<ImportedModel[]>,
  startModel: (modelId) => ipcRenderer.invoke("models:start",modelId),
  stopModel: (modelId) => ipcRenderer.invoke("models:stop",modelId),
  generateWithModel: (modelId,prompt,options) => ipcRenderer.invoke("models:generate",modelId,prompt,options),
  importModelBundleFolder: () => ipcRenderer.invoke("models:import-folder") as Promise<ImportedModel | null>,
  createProject: (name) => ipcRenderer.invoke("project:create", name) as Promise<ProjectSummary | null>,
  openProject: () => ipcRenderer.invoke("project:open") as Promise<ProjectSummary | null>,
  inspectProject: (projectPath) => ipcRenderer.invoke("project:inspect", projectPath) as Promise<ProjectSummary>,
  listProjectFiles: (projectPath) => ipcRenderer.invoke("project:files", projectPath) as Promise<ProjectFileNode[]>,
  readProjectFile: (projectPath, relativePath) => ipcRenderer.invoke("project:read-file", projectPath, relativePath) as Promise<{ content: string; size: number }>,
  createProjectFile: (projectPath, relativePath, content) => ipcRenderer.invoke("project:create-file", projectPath, relativePath, content) as Promise<{ saved: boolean; created: boolean }>,
  writeProjectFile: (projectPath, relativePath, content) => ipcRenderer.invoke("project:write-file", projectPath, relativePath, content) as Promise<{ saved: boolean }>,
  listProjectAssets: (projectPath) => ipcRenderer.invoke("project:assets", projectPath) as Promise<ProjectFileNode[]>,
  importAssets: (projectPath) => ipcRenderer.invoke("project:import-assets", projectPath) as Promise<string[]>,
  readProjectAsset: (projectPath, relativePath) => ipcRenderer.invoke("project:read-asset", projectPath, relativePath) as Promise<Uint8Array>,
  saveScene: (projectPath, sceneName, content) => ipcRenderer.invoke("scene:save", projectPath, sceneName, content) as Promise<{ path: string }>,
  openScene: (projectPath) => ipcRenderer.invoke("scene:open", projectPath) as Promise<{ content: string; path: string } | null>,
  revealPath: (projectPath, relativePath) => ipcRenderer.invoke("project:reveal", projectPath, relativePath) as Promise<boolean>,
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<StudioSettings>,
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings) as Promise<StudioSettings>,
  detectUnreal: (projectPath) => ipcRenderer.invoke("unreal:detect", projectPath) as Promise<UnrealStatus>,
  validateUnrealProject: (projectPath) => ipcRenderer.invoke("unreal:validate-project", projectPath) as Promise<{valid:boolean;projectFile:string|null;errors:string[];warnings:string[];modules:string[];sourceFiles:number;buildFiles:number;buildPerformed:false}>,
  createUnrealProject: (projectPath,projectName) => ipcRenderer.invoke("unreal:create-project",projectPath,projectName) as Promise<{created:boolean;name:string;projectPath:string;projectFile:string;files:string[]}>,
  launchUnreal: (projectFile, editorPath) => ipcRenderer.invoke("unreal:launch", projectFile, editorPath) as Promise<boolean>,
  buildUnrealProject: (projectPath) => ipcRenderer.invoke("unreal:build-project",projectPath) as Promise<{success:boolean;exitCode:number|null;projectFile:string;elapsedMs:number;stdout:string;stderr:string}>,
};

contextBridge.exposeInMainWorld("gameForge", api);
