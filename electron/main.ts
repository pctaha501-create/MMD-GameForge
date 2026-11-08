import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir, readdir, stat, lstat, readFile, writeFile, copyFile, realpath, access, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import projectNameRules = require("../src/shared/project-name.cjs");
import type { ProjectSummary, ProjectFileNode, UnrealStatus, StudioSettings, ImportedModel } from "../src/shared/types.js";

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


async function hashFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}
async function modelStorageRoot(): Promise<string> {
  const root = path.join(app.getPath("userData"), "models");
  await mkdir(root, { recursive: true });
  return root;
}
async function readInstalledModels(): Promise<ImportedModel[]> {
  const root = await modelStorageRoot();
  const entries = await readdir(root, { withFileTypes: true });
  const models: ImportedModel[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const folder = path.join(root, entry.name);
    try {
      const installed = JSON.parse(await readFile(path.join(folder, "installed.json"), "utf8")) as ImportedModel;
      const manifest = JSON.parse(await readFile(path.join(folder, "bundle-manifest.json"), "utf8")) as Record<string, unknown>;
      if (manifest.schema_version !== "mct.model-bundle.v1" || installed.id !== entry.name) continue;
      models.push({...installed,running:modelProcesses.has(installed.id),runtimeDevice:modelProcesses.get(installed.id)?.device??null});
    } catch { /* Ignore incomplete or invalid folders. */ }
  }
  return models.sort((a,b)=>b.installedAt.localeCompare(a.installedAt));
}
ipcMain.handle("models:list", async () => readInstalledModels());

const modelProcesses = new Map<string, { child: ReturnType<typeof spawn>; port: number; token: string; device: string }>();
async function freeLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve,reject)=>server.once("error",reject).listen(0,"127.0.0.1",()=>resolve()));
  const address=server.address();
  if(!address||typeof address==="string"){server.close();throw new Error("Could not allocate a local runtime port.");}
  const port=address.port;
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  return port;
}
async function findInstalledModel(id: string): Promise<ImportedModel> {
  const model=(await readInstalledModels()).find(item=>item.id===id);
  if(!model)throw new Error("The selected model is not installed.");
  return model;
}
ipcMain.handle("models:start",async(_event,rawId:unknown)=>{
  if(typeof rawId!=="string"||!rawId)throw new Error("Select an installed model first.");
  const model=await findInstalledModel(rawId);
  const existing=modelProcesses.get(model.id);
  if(existing)return {running:true,device:existing.device};
  if(modelProcesses.size>0)throw new Error("Only one MMD model runtime can be active at a time. Stop the current model before starting another.");
  const python=await dialog.showOpenDialog({title:"Select Python with PyTorch and tokenizers installed",properties:["openFile"],...(process.platform==="win32"?{filters:[{name:"Python executable",extensions:["exe"]}]}:{})});
  if(python.canceled||!python.filePaths[0])return null;
  const scriptRoot=app.isPackaged?path.join(process.resourcesPath,"cloud","runtime"):path.resolve(app.getAppPath(),"cloud","runtime");
  const script=path.join(scriptRoot,"serve.py");
  await access(script);
  const port=await freeLoopbackPort();
  const token=randomBytes(32).toString("base64url");
  const child=spawn(python.filePaths[0],[script,"--model-dir",model.folder,"--host","127.0.0.1","--port",String(port)],{
    cwd:scriptRoot,windowsHide:true,stdio:["ignore","pipe","pipe"],
    env:{PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,USERPROFILE:process.env.USERPROFILE,HOME:process.env.HOME,CUDA_VISIBLE_DEVICES:process.env.CUDA_VISIBLE_DEVICES,MMD_RUNTIME_TOKEN:token,PYTHONUNBUFFERED:"1"}
  });
  let stdout="",stderr="",settled=false;
  const result=await new Promise<{running:true;device:string}>((resolve,reject)=>{
    const timeout=setTimeout(()=>finish(new Error("Model runtime did not become ready within 180 seconds. Check that this Python environment has PyTorch and tokenizers.")),180000);
    const finish=(error?:Error,value?:{running:true;device:string})=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      if(error){child.kill();reject(error);}else if(value)resolve(value);
    };
    child.once("error",error=>finish(new Error("Could not start Python: "+error.message)));
    child.once("exit",(code)=>{const active=modelProcesses.get(model.id);if(active?.child===child)modelProcesses.delete(model.id);if(!settled)finish(new Error("Python runtime exited before becoming ready (code "+code+"). "+stderr.slice(-1200)));});
    child.stdout?.on("data",(chunk:Buffer)=>{
      stdout+=chunk.toString();
      for(const line of stdout.split("\n")){
        try{const message=JSON.parse(line);if(message.event==="MMD_RUNTIME_READY"){
          modelProcesses.set(model.id,{child,port,token,device:String(message.device??"unknown")});
          finish(undefined,{running:true,device:String(message.device??"unknown")});
        }}catch{/* Wait for a complete JSON line. */}
      }
      stdout=stdout.slice(-8192);
    });
    child.stderr?.on("data",(chunk:Buffer)=>{stderr=(stderr+chunk.toString()).slice(-8192);});
  });
  return result;
});
ipcMain.handle("models:stop",async(_event,rawId:unknown)=>{
  if(typeof rawId!=="string")return false;
  const runtime=modelProcesses.get(rawId);if(!runtime)return false;
  modelProcesses.delete(rawId);runtime.child.kill();return true;
});
ipcMain.handle("models:generate",async(_event,rawId:unknown,rawPrompt:unknown,options:unknown)=>{
  if(typeof rawId!=="string"||typeof rawPrompt!=="string")throw new Error("Invalid generation request.");
  const runtime=modelProcesses.get(rawId);if(!runtime)throw new Error("Start the selected local model first.");
  const opts=options&&typeof options==="object"?options as Record<string,unknown>:{};
  const response=await fetch(`http://127.0.0.1:${runtime.port}/generate`,{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+runtime.token},
    body:JSON.stringify({prompt:rawPrompt,max_new_tokens:opts.maxNewTokens??128,temperature:opts.temperature??0.8,top_k:opts.topK??40}),
    signal:AbortSignal.timeout(180000)
  });
  const body=await response.json() as {output?:string;error?:string;model_family?:string};
  if(!response.ok)throw new Error(body.error??"Local generation failed.");
  return {output:body.output??"",modelFamily:body.model_family??"MMD model",device:runtime.device};
});

ipcMain.handle("models:import-folder", async () => {
  const selected = await dialog.showOpenDialog({
    title: "Select an extracted MMD model bundle folder",
    properties: ["openDirectory"],
  });
  if (selected.canceled || !selected.filePaths[0]) return null;
  const source = await realpath(selected.filePaths[0]);
  const entries = await readdir(source, { withFileTypes: true });
  if (entries.some(x => x.isSymbolicLink())) throw new Error("Model bundles cannot contain symbolic links.");
  const manifestFile = path.join(source, "bundle-manifest.json");
  const manifestInfo = await stat(manifestFile);
  if (manifestInfo.size > 1024 * 1024) throw new Error("Bundle manifest exceeds the 1 MB safety limit.");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as {
    schema_version?: string; model_family?: string;
    initialization?: { weights_origin?: string };
    lineage?: { config_sha256?: string; dataset_revision?: string };
    evaluation?: { test_loss?: number; perplexity?: number };
    files?: { path: string; sha256: string; size_bytes: number }[];
  };
  if (manifest.schema_version !== "mct.model-bundle.v1") throw new Error("Unsupported MMD model bundle version.");
  if (manifest.initialization?.weights_origin !== "random_initialization") throw new Error("This bundle is not verified as a from-scratch MMD model.");
  if (!manifest.model_family || !Array.isArray(manifest.files) || manifest.files.length < 4) throw new Error("Bundle manifest is incomplete.");
  const allowed = new Set(["checkpoint.pt", "tokenizer.json", "checkpoint-manifest.json", "mmd-multilingual-pilot.json", "evaluation.json", "config.json"]);
  const names = new Set<string>();
  let total = 0;
  for (const item of manifest.files) {
    if (!item || typeof item.path !== "string" || path.basename(item.path) !== item.path || !(allowed.has(item.path) || /^[a-zA-Z0-9_-]+\.json$/.test(item.path))) throw new Error("Bundle contains an unsupported file path.");
    if (names.has(item.path)) throw new Error("Bundle contains duplicate file entries.");
    names.add(item.path);
    if (!/^[a-f0-9]{64}$/i.test(item.sha256) || !Number.isSafeInteger(item.size_bytes) || item.size_bytes < 0) throw new Error("Bundle contains invalid artifact metadata.");
    total += item.size_bytes;
    if (total > 10 * 1024 * 1024 * 1024) throw new Error("Model bundle exceeds the 10 GB import safety limit.");
    const file = path.join(source, item.path);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== item.size_bytes) throw new Error("Model artifact size/type mismatch: " + item.path);
    if (await hashFile(file) !== item.sha256) throw new Error("Model artifact SHA-256 mismatch: " + item.path);
  }
  for (const required of ["checkpoint.pt", "tokenizer.json", "checkpoint-manifest.json"]) if (!names.has(required)) throw new Error("Required model artifact missing: " + required);
  const checkpointManifest = JSON.parse(await readFile(path.join(source, "checkpoint-manifest.json"), "utf8")) as {
    initialization?: { weights_origin?: string }; lineage?: { config_sha256?: string; dataset_revision?: string };
  };
  if (checkpointManifest.initialization?.weights_origin !== "random_initialization") throw new Error("Checkpoint lineage does not confirm random initialization.");
  if (checkpointManifest.lineage?.config_sha256 !== manifest.lineage?.config_sha256 || checkpointManifest.lineage?.dataset_revision !== manifest.lineage?.dataset_revision) throw new Error("Bundle and checkpoint lineage do not match.");
  const configArtifact = manifest.files.find(item => item.sha256 === manifest.lineage?.config_sha256);
  if (!configArtifact || configArtifact.sha256 !== manifest.lineage?.config_sha256) throw new Error("Bundle config hash does not match checkpoint lineage.");
  const checkpointArtifacts = new Map((checkpointManifest as { artifacts?: { path:string; sha256:string }[] }).artifacts?.map(item => [item.path,item.sha256]) ?? []);
  for (const name of ["checkpoint.pt","tokenizer.json"]) {
    const entry = manifest.files.find(item => item.path === name);
    if (!entry || checkpointArtifacts.get(name) !== entry.sha256) throw new Error("Checkpoint artifact manifest mismatch: " + name);
  }
  const safeFamily = manifest.model_family.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48) || "MMD-Model";
  const id = safeFamily + "-" + Date.now().toString(36);
  const root = await modelStorageRoot();
  const destination = path.join(root, id);
  await mkdir(destination, { recursive: false });
  try {
    for (const item of manifest.files) await copyFile(path.join(source, item.path), path.join(destination, item.path));
    await copyFile(manifestFile, path.join(destination, "bundle-manifest.json"));
    const installed: ImportedModel = {
      id, modelFamily: manifest.model_family, installedAt: new Date().toISOString(),
      datasetRevision: manifest.lineage?.dataset_revision ?? "unknown",
      testLoss: typeof manifest.evaluation?.test_loss === "number" ? manifest.evaluation.test_loss : null,
      parameterStatus: "verified_bundle_imported",
      folder: destination,
      running: false,
      runtimeDevice: null,
    };
    await writeFile(path.join(destination, "installed.json"), JSON.stringify(installed, null, 2), "utf8");
    return installed;
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
});

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
const assetExtensions = new Set(["uasset","umap","fbx","obj","gltf","glb","stl","mtl","bin","png","jpg","jpeg","webp","tga","exr","hdr","wav","mp3","ogg","flac","mp4","mov","ttf","otf","mat","blend"]);
function inside(root: string, target: string): boolean { const rel = path.relative(root, target); return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel)); }
async function safeProjectFile(projectPath: unknown, relativePath: unknown): Promise<{ root: string; target: string }> {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath) || typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) throw new Error("Invalid project file path.");
  const root = await realpath(projectPath); const target = path.resolve(root, relativePath);
  if (!inside(root, target)) throw new Error("Path is outside the selected project.");
  const actual = await realpath(target); if (!inside(root, actual)) throw new Error("Symbolic links outside the project are not allowed.");
  return { root, target: actual };
}
async function walkProject(root: string, folders: string[], depth = 0): Promise<ProjectFileNode[]> {
  if (depth > 5 || folders.length > 2500) return [];
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

ipcMain.handle("project:create-file",async(_event,projectPath:unknown,relativePath:unknown,content:unknown)=>{
  if(typeof projectPath!=="string"||!path.isAbsolute(projectPath)||typeof relativePath!=="string"||!relativePath||path.isAbsolute(relativePath)||/^[a-zA-Z]:/.test(relativePath))throw new Error("Invalid project file path.");
  if(relativePath.split(/[\\/]/).some(part=>!part||part==="."||part===".."))throw new Error("Project file path must stay inside the project.");
  if(typeof content!=="string"||content.length>2*1024*1024)throw new Error("New file content exceeds the 2 MB limit.");
  const root=await realpath(projectPath);const target=path.resolve(root,relativePath);if(!inside(root,target))throw new Error("Path is outside the selected project.");
  const parent=await realpath(path.dirname(target));if(!inside(root,parent))throw new Error("Parent folder is outside the selected project.");
  const extension=path.extname(target).slice(1).toLowerCase();if(!textExtensions.has(extension))throw new Error("This file type cannot be created in the built-in editor.");
  try{await lstat(target);throw new Error("A file already exists at this path. Use the approved overwrite tool instead.");}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  await writeFile(target,content,{encoding:"utf8",flag:"wx"});return {saved:true,created:true};
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

ipcMain.handle("project:read-asset", async (_event, projectPath: unknown, relativePath: unknown) => {
  const { target } = await safeProjectFile(projectPath, relativePath); const extension = path.extname(target).slice(1).toLowerCase();
  if (!["glb","gltf","obj","fbx","stl","mtl","bin","png","jpg","jpeg","webp","tga"].includes(extension)) throw new Error("Unsupported 3D asset or texture format.");
  const info = await stat(target); if (info.size > 100 * 1024 * 1024) throw new Error("Asset exceeds the 100 MB import limit.");
  return new Uint8Array(await readFile(target));
});
ipcMain.handle("scene:save", async (_event, projectPath: unknown, sceneName: unknown, content: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  if (typeof sceneName !== "string" || !/^[\p{L}\p{N}_ -]{1,64}$/u.test(sceneName.trim())) throw new Error("Scene name must be 1–64 letters, numbers, spaces, underscores or hyphens.");
  if (typeof content !== "string" || content.length > 25 * 1024 * 1024) throw new Error("Scene data exceeds the 25 MB limit.");
  const parsed = JSON.parse(content) as { object?: { type?: string; children?: unknown[] } };
  if (parsed?.object?.type !== "Group" || !Array.isArray(parsed.object.children)) throw new Error("Invalid GameForge scene document.");
  const root = await realpath(projectPath); const folder = path.join(root, "GameForge", "Scenes"); await mkdir(folder, { recursive: true });
  const safeName = sceneName.trim(); const file = path.join(folder, `${safeName}.mmdscene.json`);
  await writeFile(file, content, "utf8"); return { path: path.relative(root, file).split(path.sep).join("/") };
});
ipcMain.handle("scene:open", async (_event, projectPath: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  const root = await realpath(projectPath); const folder = path.join(root, "GameForge", "Scenes"); await mkdir(folder, { recursive: true });
  const selected = await dialog.showOpenDialog({ title: "Open GameForge scene", defaultPath: folder, properties: ["openFile"], filters: [{ name: "GameForge scenes", extensions: ["json"] }] });
  if (selected.canceled || !selected.filePaths[0]) return null;
  const target = await realpath(selected.filePaths[0]); if (!inside(root, target) || !target.toLowerCase().endsWith(".mmdscene.json")) throw new Error("Choose a .mmdscene.json file inside this project.");
  const info = await stat(target); if (info.size > 25 * 1024 * 1024) throw new Error("Scene file exceeds the 25 MB limit.");
  const content = await readFile(target, "utf8"); const parsed = JSON.parse(content) as { object?: { type?: string; children?: unknown[] } };
  if (parsed?.object?.type !== "Group" || !Array.isArray(parsed.object.children)) throw new Error("This file is not a valid GameForge scene.");
  return { content, path: path.relative(root, target).split(path.sep).join("/") };
});

ipcMain.handle("project:reveal", async (_event, projectPath: unknown, relativePath?: unknown) => {
  if (typeof projectPath !== "string" || !path.isAbsolute(projectPath)) throw new Error("Invalid project path.");
  if (typeof relativePath === "string" && relativePath) { const { target } = await safeProjectFile(projectPath, relativePath); shell.showItemInFolder(target); }
  else shell.showItemInFolder(await realpath(projectPath)); return true;
});
ipcMain.handle("settings:get", () => readStudioSettings());
ipcMain.handle("settings:save", (_event, value: unknown) => writeStudioSettings(value));

ipcMain.handle("unreal:validate-project",async(_event,rawProjectPath:unknown)=>{
  if(typeof rawProjectPath!=="string"||!path.isAbsolute(rawProjectPath))throw new Error("Invalid project folder.");
  const root=await realpath(rawProjectPath);
  const candidates=(await readdir(root,{withFileTypes:true})).filter(entry=>entry.isFile()&&entry.name.toLowerCase().endsWith(".uproject"));
  if(candidates.length!==1)return {valid:false,projectFile:null,errors:[candidates.length?"Multiple .uproject files found at project root.":"No .uproject file found at project root."],warnings:[],modules:[],sourceFiles:0};
  const projectFile=path.join(root,candidates[0].name);let projectJson:Record<string,unknown>;
  try{projectJson=JSON.parse(await readFile(projectFile,"utf8")) as Record<string,unknown>;}
  catch{return {valid:false,projectFile:candidates[0].name,errors:["The .uproject file is not valid JSON."],warnings:[],modules:[],sourceFiles:0};}
  const errors:string[]=[],warnings:string[]=[];
  if(!Array.isArray(projectJson.Modules)||projectJson.Modules.length===0)errors.push("The .uproject file has no Modules array.");
  const modules=Array.isArray(projectJson.Modules)?projectJson.Modules.filter((x):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)): [];
  for(const mod of modules){if(typeof mod.Name!=="string"||!mod.Name.trim())errors.push("A module entry has no valid Name.");}
  const sourceRoot=path.join(root,"Source");
  try{await access(sourceRoot);}catch{errors.push("The project has no Source directory.");}
  const sourceFiles:string[]=[];const buildFiles:string[]=[];
  async function scan(folder:string,depth:number):Promise<void>{
    if(depth>8)return;
    let entries;try{entries=await readdir(folder,{withFileTypes:true});}catch{return;}
    for(const entry of entries){
      if(entry.isSymbolicLink()||[".git","Binaries","Intermediate","Saved","DerivedDataCache","node_modules"].includes(entry.name))continue;
      const full=path.join(folder,entry.name);
      if(entry.isDirectory())await scan(full,depth+1);
      else if(entry.isFile()){if(/\.(h|hpp|cpp|c|cs)$/i.test(entry.name))sourceFiles.push(full);if(/\.Build\.cs$/i.test(entry.name))buildFiles.push(full);}
    }
  }
  await scan(sourceRoot,0);
  if(modules.length&&buildFiles.length===0)errors.push("No module .Build.cs file was found under Source.");
  if(sourceFiles.length===0)warnings.push("No C++ or C# source files were found under Source.");
  for(const mod of modules){
    const name=String(mod.Name??"");
    if(name&&!buildFiles.some(file=>path.basename(file).toLowerCase()===name.toLowerCase()+".build.cs"))warnings.push("No matching "+name+".Build.cs module file was found.");
  }
  return {valid:errors.length===0,projectFile:candidates[0].name,errors,warnings,modules:modules.map(x=>String(x.Name??"")),sourceFiles:sourceFiles.length,buildFiles:buildFiles.length,buildPerformed:false};
});

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

app.on("before-quit",()=>{for(const runtime of modelProcesses.values())runtime.child.kill();modelProcesses.clear();});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
