import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, DesktopAPI, ProjectSummary, ProjectFileNode, UnrealStatus, StudioSettings, AiStatus, AiDatasetInfo, AiModelInfo } from "../src/shared/types.js";

const api: DesktopAPI = {
  getAppInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>,
  createProject: (name) => ipcRenderer.invoke("project:create", name) as Promise<ProjectSummary | null>,
  openProject: () => ipcRenderer.invoke("project:open") as Promise<ProjectSummary | null>,
  inspectProject: (projectPath) => ipcRenderer.invoke("project:inspect", projectPath) as Promise<ProjectSummary>,
  listProjectFiles: (projectPath) => ipcRenderer.invoke("project:files", projectPath) as Promise<ProjectFileNode[]>,
  readProjectFile: (projectPath, relativePath) => ipcRenderer.invoke("project:read-file", projectPath, relativePath) as Promise<{ content: string; size: number }>,
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
  launchUnreal: (projectFile, editorPath) => ipcRenderer.invoke("unreal:launch", projectFile, editorPath) as Promise<boolean>,
  getAiStatus: () => ipcRenderer.invoke("ai:status") as Promise<AiStatus>,
  importAiDataset: () => ipcRenderer.invoke("ai:dataset:import") as Promise<AiDatasetInfo | null>,
  listAiDatasets: () => ipcRenderer.invoke("ai:datasets:list") as Promise<AiDatasetInfo[]>,
  trainAiModel: (datasetId, modelName) => ipcRenderer.invoke("ai:model:train", datasetId, modelName) as Promise<AiModelInfo>,
  listAiModels: () => ipcRenderer.invoke("ai:models:list") as Promise<AiModelInfo[]>,
  generateAiText: (modelId, prompt, maxCharacters) => ipcRenderer.invoke("ai:generate", modelId, prompt, maxCharacters) as Promise<string>,
};

contextBridge.exposeInMainWorld("gameForge", api);
