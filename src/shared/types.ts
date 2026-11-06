export interface ProjectEntry {
  name: string;
  kind: "file" | "folder";
}

export interface ProjectSummary {
  name: string;
  path: string;
  modifiedAt: string;
  entries: ProjectEntry[];
  entryCount: number;
}

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isPackaged: boolean;
}

export interface DesktopAPI {
  getAppInfo(): Promise<AppInfo>;
  createProject(name: string): Promise<ProjectSummary | null>;
  openProject(): Promise<ProjectSummary | null>;
  inspectProject(projectPath: string): Promise<ProjectSummary>;
}

declare global {
  interface Window {
    gameForge: DesktopAPI;
  }
}
