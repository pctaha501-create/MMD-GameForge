import "./styles.css";
import type { ProjectSummary } from "../shared/types.js";
import { renderProfessional, bindProfessional } from "./professional.js";
import { renderAiWorkshop, bindAiWorkshop } from "./ai-workshop.js";

type View = "dashboard" | "projects" | "world" | "code" | "assets" | "ai" | "training" | "settings";
const icons: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  cube: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9"/>',
  code: '<path d="m8 17-5-5 5-5M16 7l5 5-5 5M14 4l-4 16"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1)"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  play: '<path d="m8 5 12 7-12 7z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
};
function icon(name: string, size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.grid}</svg>`;
}
const app = document.querySelector<HTMLDivElement>("#app")!;
let currentView: View = "dashboard";
let activeProject: ProjectSummary | null = null;
let appVersion = "0.2.0";
let toastTimer = 0;
const recentKey = "mmd-gameforge.recent-projects";

function readRecent(): ProjectSummary[] {
  try { return JSON.parse(localStorage.getItem(recentKey) ?? "[]") as ProjectSummary[]; }
  catch { return []; }
}
function saveRecent(project: ProjectSummary): void {
  const items = [project, ...readRecent().filter((item) => item.path !== project.path)].slice(0, 6);
  localStorage.setItem(recentKey, JSON.stringify(items));
}
function notify(message: string, kind: "success" | "error" = "success"): void {
  const node = document.querySelector<HTMLDivElement>("#toast");
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
  node.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.classList.remove("visible"), 3200);
}
function setView(view: View): void { currentView = view; render(); }
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
function projectTile(project: ProjectSummary): string {
  return `<button class="project-tile" data-project-path="${escapeHtml(project.path)}">
    <span class="project-tile-icon">${icon("cube", 21)}</span><span class="project-tile-copy"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.path)}</small></span><span class="tile-arrow">${icon("arrow", 16)}</span>
  </button>`;
}
function navItem(view: View, label: string, glyph: string): string {
  return `<button class="nav-item ${currentView === view ? "active" : ""}" data-view="${view}">${icon(glyph, 18)}<span>${label}</span>${currentView === view ? '<i class="nav-active-dot"></i>' : ""}</button>`;
}
function shell(content: string): void {
  app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><span>M</span><i></i></div><div class="brand-copy"><strong>MMD <b>GAMEFORGE</b></strong><small>CREATION STUDIO</small></div><button class="icon-button sidebar-collapse" aria-label="Toggle sidebar">${icon("menu",17)}</button></div>
      <div class="workspace-switch"><div class="workspace-avatar">G</div><div><strong>GameForge Studio</strong><small>Local workspace</small></div><span class="switch-chevron">${icon("chevron",14)}</span></div>
      <div class="nav-label">WORKSPACE</div>
      <nav class="primary-nav">
        ${navItem("dashboard", "Overview", "grid")}
        ${navItem("projects", "My Projects", "folder")}
        ${navItem("world", "World Builder", "cube")}
        ${navItem("code", "Code Studio", "code")}
        ${navItem("assets", "Asset Library", "image")}
      </nav>
      <div class="nav-label nav-label-spaced">INTELLIGENCE</div>
      <nav class="primary-nav">
        ${navItem("ai", "MMD AI Core", "spark")}
        ${navItem("training", "Model Workshop", "activity")}
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-status"><span class="status-pulse"></span><div><strong>Local-first mode</strong><small>No cloud dependency</small></div><span class="status-lock">●</span></div>
      <nav class="bottom-nav">${navItem("settings", "Settings", "settings")}</nav>
      <div class="profile"><div class="profile-avatar">M</div><div><strong>MMD Studio</strong><small>Developer workspace</small></div><button class="more-button">···</button></div>
    </aside>
    <main class="main-area">
      <header class="topbar"><div class="breadcrumbs"><span>GAMEFORGE</span>${icon("chevron",13)}<strong>${viewTitle(currentView)}</strong></div><div class="topbar-right"><div class="local-indicator"><span></span> ALL SYSTEMS LOCAL</div><button class="icon-button" aria-label="Search" id="search-button">${icon("search",18)}</button><div class="topbar-divider"></div><div class="topbar-avatar">M</div></div></header>
      <section class="page-content">${content}</section>
      <footer class="statusbar"><div><span class="status-dot"></span> READY</div><div><span>UNREAL WORKSPACE</span><span class="status-separator">/</span><span>AI: RESEARCH MODE</span></div><div>v${appVersion} <span class="status-separator">·</span> MMD STUDIO</div></footer>
    </main>
  </div><div id="toast" class="toast" role="status" aria-live="polite"></div><div id="modal-root"></div>`;
  bindShellEvents();
}
function viewTitle(view: View): string {
  return ({ dashboard: "Overview", projects: "My Projects", world: "World Builder", code: "Code Studio", assets: "Asset Library", ai: "MMD AI Core", training: "Model Workshop", settings: "Settings" })[view];
}
function dashboard(): string {
  const recent = readRecent();
  return `
  <div class="welcome-row"><div><div class="eyebrow"><span class="eyebrow-line"></span> YOUR CREATIVE COMMAND CENTER</div><h1>Build something <span>extraordinary.</span></h1><p class="page-lead">Your workspace for designing, building, and shaping the next generation of Unreal Engine games.</p></div><div class="date-chip">${icon("clock",15)} <span>LOCAL WORKSPACE</span></div></div>
  <section class="hero-panel">
    <div class="hero-glow"></div><div class="hero-grid"></div><div class="hero-copy"><div class="hero-kicker"><span class="kicker-dot"></span> MMD GAMEFORGE <span class="kicker-divider">/</span> PROJECT WORKSPACE</div><h2>Your next world<br/>starts <em>right here.</em></h2><p>Create a project workspace and bring your game concept to life. Your files stay on your machine.</p><div class="hero-actions"><button class="button button-primary" id="new-project">${icon("plus",17)} Create new project</button><button class="button button-ghost" id="open-project">${icon("folder",17)} Open project</button></div></div>
    <div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="core-cube"><div class="cube-face cube-front">M</div><div class="cube-face cube-side"></div><div class="cube-face cube-top"></div></div><div class="art-label label-top">WORLD ENGINE <b>01</b></div><div class="art-label label-bottom">CREATIVE SYSTEM <b>ONLINE</b></div><div class="art-coord">40° 42' 46.08" N<br/>74° 00' 21.60" W</div></div>
    <div class="hero-index">01 <span>/</span> 04</div>
  </section>
  <div class="section-heading"><div><div class="eyebrow">WORKSPACE MODULES</div><h2>Everything in one place</h2></div><span class="section-note">BUILT FOR YOUR PIPELINE</span></div>
  <div class="module-grid">
    <button class="module-card module-featured" data-view="world"><div class="module-icon purple">${icon("cube",20)}</div><span class="module-arrow">${icon("arrow",16)}</span><strong>World Builder</strong><p>Shape environments, plan levels, and organize your game world.</p><small>SCENE WORKSPACE</small></button>
    <button class="module-card" data-view="code"><div class="module-icon blue">${icon("code",20)}</div><span class="module-arrow">${icon("arrow",16)}</span><strong>Code Studio</strong><p>Manage gameplay code and Unreal project scripts.</p><small>DEVELOPMENT</small></button>
    <button class="module-card" data-view="assets"><div class="module-icon orange">${icon("image",20)}</div><span class="module-arrow">${icon("arrow",16)}</span><strong>Asset Library</strong><p>Keep models, materials, textures, and references organized.</p><small>CONTENT</small></button>
    <button class="module-card" data-view="ai"><div class="module-icon mint">${icon("spark",20)}</div><span class="module-arrow">${icon("arrow",16)}</span><strong>MMD AI Core</strong><p>Explore the first-party AI architecture and its research tracks.</p><small>INTELLIGENCE</small></button>
  </div>
  <div class="lower-grid"><section class="panel recent-panel"><div class="panel-heading"><div><span class="eyebrow">CONTINUE CREATING</span><h3>Recent projects</h3></div><button class="text-button" data-view="projects">View all ${icon("arrow",14)}</button></div>${recent.length ? `<div class="project-list">${recent.map(projectTile).join("")}</div>` : `<div class="empty-state"><div class="empty-icon">${icon("folder",22)}</div><strong>No projects yet</strong><p>Create your first workspace to see it here.</p><button class="text-button" id="empty-create">Create a project ${icon("arrow",14)}</button></div>`}</section>
  <section class="panel status-panel"><div class="panel-heading"><div><span class="eyebrow">SYSTEM OVERVIEW</span><h3>Studio status</h3></div><span class="live-badge"><i></i> LIVE</span></div><div class="status-row"><div class="status-symbol">${icon("monitor",18)}</div><div><strong>Desktop environment</strong><small>Electron workspace initialized</small></div><span class="status-tag good">READY</span></div><div class="status-row"><div class="status-symbol">${icon("spark",18)}</div><div><strong>MMD AI research</strong><small>From-scratch model track</small></div><span class="status-tag research">PLANNED</span></div><div class="status-row"><div class="status-symbol">${icon("cube",18)}</div><div><strong>Unreal connection</strong><small>Bridge integration not configured</small></div><span class="status-tag pending">PENDING</span></div></section></div>
  <div class="footnote"><span>✳</span> MMD GAMEFORGE IS BUILT AROUND FIRST-PARTY MODELS TRAINED FROM RANDOM INITIALIZATION — NOT DOWNLOADED PRETRAINED WEIGHTS.</div>`;
}
function projectsView(): string {
  const recent = readRecent();
  return `<div class="page-heading"><div><div class="eyebrow">YOUR WORK, YOUR MACHINE</div><h1>My <span>Projects</span></h1><p class="page-lead">Open an existing Unreal project or create a fresh GameForge workspace.</p></div><div class="heading-actions"><button class="button button-ghost" id="open-project">${icon("folder",17)} Open project</button><button class="button button-primary" id="new-project">${icon("plus",17)} New project</button></div></div>
  <div class="project-summary-strip"><div><small>RECENT WORKSPACES</small><strong>${recent.length.toString().padStart(2,"0")}</strong></div><div><small>STORAGE MODE</small><strong>LOCAL</strong></div><div><small>PROJECT ENGINE</small><strong>UNREAL-READY</strong></div></div>
  <section class="panel project-manager"><div class="panel-heading"><div><span class="eyebrow">PROJECT BROWSER</span><h3>Recently opened</h3></div><span class="section-note">UP TO 6 RECENT ITEMS</span></div>${recent.length ? `<div class="project-list large">${recent.map(projectTile).join("")}</div>` : `<div class="empty-state roomy"><div class="empty-icon">${icon("folder",24)}</div><strong>Your project list is empty</strong><p>Start a new project or open an existing folder from your computer.</p><button class="button button-primary" id="new-project">${icon("plus",16)} Create first project</button></div>`}</section>`;
}
function projectView(): string {
  if (!activeProject) return dashboard();
  const entries = activeProject.entries;
  return `<div class="page-heading"><div><div class="eyebrow">ACTIVE PROJECT WORKSPACE</div><h1>${escapeHtml(activeProject.name)}</h1><p class="page-lead path-lead">${escapeHtml(activeProject.path)}</p></div><div class="heading-actions"><button class="button button-ghost" id="refresh-project">${icon("activity",16)} Refresh</button><button class="button button-primary" id="open-project">${icon("folder",16)} Switch project</button></div></div>
  <div class="project-overview"><div class="project-overview-main"><div class="project-big-icon">${icon("cube",30)}</div><div><span class="eyebrow">PROJECT DIRECTORY</span><h2>${escapeHtml(activeProject.name)}</h2><p>Local folder connected to GameForge</p></div></div><div class="project-metric"><small>VISIBLE ITEMS</small><strong>${activeProject.entryCount}</strong></div><div class="project-metric"><small>LAST MODIFIED</small><strong>${new Date(activeProject.modifiedAt).toLocaleDateString()}</strong></div></div>
  <div class="section-heading compact"><div><div class="eyebrow">FILESYSTEM SNAPSHOT</div><h2>Project contents</h2></div><span class="section-note">TOP-LEVEL VIEW</span></div>
  <section class="panel file-panel">${entries.length ? entries.map((entry) => `<div class="file-row"><span class="file-icon ${entry.kind}">${icon(entry.kind === "folder" ? "folder" : "code",17)}</span><strong>${escapeHtml(entry.name)}</strong><small>${entry.kind.toUpperCase()}</small></div>`).join("") : `<div class="empty-state"><strong>This folder is empty</strong><p>GameForge can use this directory as your project workspace.</p></div>`}</section>
  <div class="footnote"><span>i</span> FILES ARE ONLY LISTED HERE. GAMEFORGE DOES NOT MODIFY OR DELETE YOUR EXISTING PROJECT CONTENTS.</div>`;
}
function moduleView(view: Exclude<View, "dashboard" | "projects">): string {
  if (["world", "code", "assets", "settings"].includes(view)) return renderProfessional(view as "world" | "code" | "assets" | "settings", activeProject);
  if (view === "ai" || view === "training") return renderAiWorkshop(view === "training" ? "training" : "core");
  const data = {
    world: ["WORLD BUILDER", "Shape the world.", "A dedicated space for level planning, scene organization, and environment workflows.", "Scene graph and Unreal level tooling will connect here in a later integration phase.", "cube", "WORLD PIPELINE"],
    code: ["CODE STUDIO", "Build the logic.", "A focused home for gameplay systems, scripts, and Unreal C++ workflows.", "The editor and project-aware code tools are planned. No source files are generated in this foundation build.", "code", "DEVELOPMENT PIPELINE"],
    assets: ["ASSET LIBRARY", "Every asset, organized.", "A structured library for meshes, materials, textures, audio, and reference files.", "Asset indexing and metadata tools will be introduced with the project pipeline.", "image", "CONTENT PIPELINE"],
    ai: ["MMD AI CORE", "Intelligence, built here.", "The coordination layer for MMD's own family of models and creative tools.", "This workspace currently documents the architecture. No pretrained model, cloud API, or production inference engine is bundled.", "spark", "FIRST-PARTY AI"],
    training: ["MODEL WORKSHOP", "Train from zero.", "Research and experiment with MMD-owned model architectures, datasets, and training runs.", "Training dashboards, checkpoint management, dataset validation, and evaluation will arrive in the AI foundation phase.", "activity", "RESEARCH PIPELINE"],
    settings: ["STUDIO SETTINGS", "Make it yours.", "Application preferences and local workspace configuration.", "Settings are intentionally minimal while the desktop foundation is being established.", "settings", "PREFERENCES"],
  }[view];
  return `<div class="module-hero"><div class="module-hero-icon">${icon(data[4]!,34)}</div><div class="eyebrow">${data[0]}</div><h1>${data[1]}</h1><p class="page-lead">${data[2]}</p><div class="module-divider"></div><div class="coming-panel"><span class="coming-mark">${icon("activity",18)}</span><div><strong>Workspace foundation is ready</strong><p>${data[3]}</p></div><span class="status-tag research">IN DEVELOPMENT</span></div><div class="module-foot"><span>${data[5]}</span><span>PHASE 02 <i>·</i> DESKTOP FOUNDATION</span></div></div>`;
}
function render(): void {
  let content = currentView === "dashboard" ? dashboard()
    : currentView === "projects" ? projectsView()
    : currentView === "world" ? moduleView("world")
    : currentView === "code" ? moduleView("code")
    : currentView === "assets" ? moduleView("assets")
    : currentView === "ai" ? moduleView("ai")
    : currentView === "training" ? moduleView("training")
    : moduleView("settings");
  shell(content);
}
function bindShellEvents(): void {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view as View)));
  document.querySelectorAll<HTMLElement>("[data-project-path]").forEach((node) => node.addEventListener("click", () => void openRecent(node.dataset.projectPath!)));
  document.querySelectorAll<HTMLElement>("#new-project, #empty-create").forEach((node) => node.addEventListener("click", showCreateModal));
  document.querySelectorAll<HTMLElement>("#open-project").forEach((node) => node.addEventListener("click", () => void openProject()));
  document.querySelector("#refresh-project")?.addEventListener("click", () => void refreshProject());
  document.querySelector("#search-button")?.addEventListener("click", () => notify("Search will be connected to your project index in a later phase."));
  document.querySelector(".sidebar-collapse")?.addEventListener("click", () => document.querySelector(".app-shell")?.classList.toggle("sidebar-compact"));
  if (["world", "code", "assets", "settings"].includes(currentView)) void bindProfessional(currentView as "world" | "code" | "assets" | "settings", activeProject, notify);
  if (currentView === "ai" || currentView === "training") bindAiWorkshop((message, type) => notify(message, type === "error" ? "error" : "success"));
}
function showCreateModal(): void {
  const root = document.querySelector<HTMLDivElement>("#modal-root")!;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal-card"><button class="modal-close icon-button" id="modal-close" aria-label="Close">${icon("close",18)}</button><div class="modal-symbol">${icon("cube",25)}</div><div class="eyebrow">NEW GAME WORKSPACE</div><h2>Create a project</h2><p>Choose a name. GameForge will ask where to create its local folder.</p><label class="field-label" for="project-name">PROJECT NAME</label><input id="project-name" class="text-field" maxlength="64" placeholder="My Next Game" autocomplete="off"/><div class="modal-hint">${icon("folder",14)} Your project stays on your computer.</div><div class="modal-actions"><button class="button button-ghost" id="modal-cancel">Cancel</button><button class="button button-primary" id="modal-create">${icon("plus",16)} Choose location</button></div></section></div>`;
  const close = () => { root.innerHTML = ""; };
  root.querySelector("#modal-close")?.addEventListener("click", close);
  root.querySelector("#modal-cancel")?.addEventListener("click", close);
  const input = root.querySelector<HTMLInputElement>("#project-name")!;
  input.focus();
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") void createProject(input.value, close); if (event.key === "Escape") close(); });
  root.querySelector("#modal-create")?.addEventListener("click", () => void createProject(input.value, close));
}
async function createProject(name: string, close: () => void): Promise<void> {
  if (!name.trim()) { notify("Enter a project name first.", "error"); return; }
  const button = document.querySelector<HTMLButtonElement>("#modal-create");
  if (button) { button.disabled = true; button.textContent = "Choosing location…"; }
  try {
    const project = await window.gameForge.createProject(name);
    if (!project) { if (button) { button.disabled = false; button.innerHTML = `${icon("plus",16)} Choose location`; } return; }
    close(); activeProject = project; saveRecent(project); setView("world"); notify(`Project “${project.name}” created.`);
  } catch (error) {
    notify(error instanceof Error ? error.message : "Could not create the project.", "error");
    if (button) { button.disabled = false; button.innerHTML = `${icon("plus",16)} Choose location`; }
  }
}
async function openProject(): Promise<void> {
  try {
    const project = await window.gameForge.openProject();
    if (!project) return;
    activeProject = project; saveRecent(project); setView("world"); notify(`Opened “${project.name}”.`);
  } catch (error) { notify(error instanceof Error ? error.message : "Could not open this folder.", "error"); }
}
async function openRecent(projectPath: string): Promise<void> {
  try {
    const project = await window.gameForge.inspectProject(projectPath);
    activeProject = project; saveRecent(project); setView("world"); notify(`Workspace “${project.name}” ready.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project folder is unavailable.";
    notify(message, "error");
  }
}
async function refreshProject(): Promise<void> {
  if (!activeProject) return;
  try { activeProject = await window.gameForge.inspectProject(activeProject.path); saveRecent(activeProject); render(); notify("Project snapshot refreshed."); }
  catch (error) { notify(error instanceof Error ? error.message : "Refresh failed.", "error"); }
}

async function boot(): Promise<void> {
  try { const info = await window.gameForge.getAppInfo(); appVersion = info.version; }
  catch { /* Browser preview remains usable without the Electron bridge. */ }
  render();
}
void boot();
