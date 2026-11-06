import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, DesktopAPI, ProjectSummary } from "../src/shared/types.js";

const api: DesktopAPI = {
  getAppInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>,
  createProject: (name) => ipcRenderer.invoke("project:create", name) as Promise<ProjectSummary | null>,
  openProject: () => ipcRenderer.invoke("project:open") as Promise<ProjectSummary | null>,
  inspectProject: (projectPath) => ipcRenderer.invoke("project:inspect", projectPath) as Promise<ProjectSummary>,
};

contextBridge.exposeInMainWorld("gameForge", api);
