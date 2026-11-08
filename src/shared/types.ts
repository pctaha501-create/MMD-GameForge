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

export interface ImportedModel { id:string; modelFamily:string; installedAt:string; datasetRevision:string; testLoss:number|null; parameterStatus:string; folder:string; running:boolean; runtimeDevice:string|null; }

export interface DesktopAPI {
  getAppInfo(): Promise<AppInfo>;
  listModels(): Promise<ImportedModel[]>;
  startModel(modelId:string):Promise<{running:boolean;device:string}|null>;
  stopModel(modelId:string):Promise<boolean>;
  generateWithModel(modelId:string,prompt:string,options?:{maxNewTokens?:number;temperature?:number;topK?:number}):Promise<{output:string;modelFamily:string;device:string}>;
  importModelBundleFolder(): Promise<ImportedModel | null>;
  createProject(name: string): Promise<ProjectSummary | null>;
  openProject(): Promise<ProjectSummary | null>;
  inspectProject(projectPath: string): Promise<ProjectSummary>;
  listProjectFiles(projectPath: string): Promise<ProjectFileNode[]>;
  readProjectFile(projectPath: string, relativePath: string): Promise<{ content: string; size: number }>;
  writeProjectFile(projectPath: string, relativePath: string, content: string): Promise<{ saved: boolean }>;
  listProjectAssets(projectPath: string): Promise<ProjectFileNode[]>;
  importAssets(projectPath: string): Promise<string[]>;
  readProjectAsset(projectPath: string, relativePath: string): Promise<Uint8Array>;
  saveScene(projectPath: string, sceneName: string, content: string): Promise<{ path: string }>;
  openScene(projectPath: string): Promise<{ content: string; path: string } | null>;
  revealPath(projectPath: string, relativePath?: string): Promise<boolean>;
  getSettings(): Promise<StudioSettings>;
  saveSettings(settings: StudioSettings): Promise<StudioSettings>;
  detectUnreal(projectPath: string): Promise<UnrealStatus>;
  launchUnreal(projectFile: string, editorPath?: string): Promise<boolean>;
}

declare global {
  interface Window {
    gameForge: DesktopAPI;
  }
}

export interface ProjectFileNode { name: string; path: string; kind: "file" | "folder"; size: number; extension: string; }
export interface UnrealStatus { installed: boolean; editorPath: string | null; projectFile: string | null; }
export interface StudioSettings { editorFontSize?: number; wordWrap?: boolean; confirmExternal?: boolean; unrealEditorPath?: string; }
