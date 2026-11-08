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
  getAiStatus(): Promise<AiStatus>;
  importAiDataset(): Promise<AiDatasetInfo | null>;
  listAiDatasets(): Promise<AiDatasetInfo[]>;
  trainAiModel(datasetId: string, modelName: string): Promise<AiModelInfo>;
  listAiModels(): Promise<AiModelInfo[]>;
  generateAiText(modelId: string, prompt: string, maxCharacters: number): Promise<string>;
}

declare global {
  interface Window {
    gameForge: DesktopAPI;
  }
}

export interface ProjectFileNode { name: string; path: string; kind: "file" | "folder"; size: number; extension: string; }
export interface UnrealStatus { installed: boolean; editorPath: string | null; projectFile: string | null; }
export interface StudioSettings { editorFontSize?: number; wordWrap?: boolean; confirmExternal?: boolean; unrealEditorPath?: string; }

export interface AiDatasetInfo { id: string; name: string; bytes: number; characters: number; createdAt: string; }
export interface AiModelInfo { id: string; name: string; datasetName: string; createdAt: string; trainedCharacters: number; vocabularySize: number; hiddenSize: number; architecture: string; initialization: string; seed: number; epochs: number; learningRate: number; trainingLoss: number; kind: string; }
export interface AiStatus { runtime: string; mode: "offline"; datasets: number; models: number; storagePath: string; modelKind: string; limitations: string[]; }
