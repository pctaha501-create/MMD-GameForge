import "./styles.css";
import type { ProjectSummary } from "../shared/types.js";
import { renderProfessional, bindProfessional } from "./professional.js";
import { validateAIToolCall } from "../shared/ai-tool-call.mjs";

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
let aiConversation: { role: "user" | "assistant"; content: string }[] = [];
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

type ModelProfile = "bilingual-base-1b" | "multilingual-tiny" | "multilingual-pilot" | "code-tiny" | "game-design-tiny" | "game-agent-tiny";
const modelProfiles: Record<ModelProfile, {name:string;description:string;vocab:number;seq:number;hidden:number;layers:number;heads:number;steps:number;languages:string[]}> = {
  "bilingual-base-1b": {name:"MMD Base 1B (Persian + English)",description:"The main bilingual Base test target: ~1.023B parameters, random initialization, cloud CUDA GPU with at least 24 GiB preflight.",vocab:32000,seq:256,hidden:2048,layers:19,heads:16,steps:1000,languages:["fa","en"]},
  "multilingual-tiny": {name:"MMD Bilingual Tiny",description:"Small Persian/English experiment for verifying the end-to-end pipeline.",vocab:8000,seq:256,hidden:128,layers:2,heads:4,steps:500,languages:["fa","en"]},
  "multilingual-pilot": {name:"MMD Bilingual Pilot",description:"Small Persian/English pilot for measuring the end-to-end cloud training pipeline.",vocab:16000,seq:512,hidden:384,layers:6,heads:6,steps:2000,languages:["fa","en"]},
  "code-tiny": {name:"MMD Code Tiny",description:"A from-scratch code-language experiment; not yet trained or benchmarked.",vocab:12000,seq:256,hidden:192,layers:3,heads:6,steps:800,languages:["en","fa"]},
  "game-design-tiny": {name:"MMD Game Design Tiny",description:"A from-scratch game-design text experiment; not yet trained or benchmarked.",vocab:12000,seq:256,hidden:192,layers:3,heads:6,steps:800,languages:["en","fa"]},
  "game-agent-tiny": {name:"MMD Game Agent Tiny",description:"A from-scratch instruction model for structured GameForge tool calls; requires a dedicated licensed tool-use dataset.",vocab:12000,seq:512,hidden:192,layers:4,heads:6,steps:1000,languages:["en","fa"]},
};
function modelEstimate(profile: ModelProfile): {parameters:number;weightMiB:number;adamMiB:number} {
  const p=modelProfiles[profile],d=p.hidden,ff=d*4;
  const embedding=p.vocab*d+p.seq*d;
  const attention=4*d*d+4*d,feed=d*ff+ff+ff*d+d,norm=4*d;
  const total=embedding+p.layers*(attention+feed+norm)+2*d;
  return {parameters:total,weightMiB:total*4/1048576,adamMiB:total*(profile==="bilingual-base-1b"?10:16)/1048576};
}
function makeModelConfig(profile: ModelProfile, seed:number): object {
  const p=modelProfiles[profile];
  return {
    schema_version:"mct.model-config.v1",model_family:p.name,stage:profile==="bilingual-base-1b"?"base-test":"experiment",
    description:p.description+" Random initialization only; no pretrained weights.",
    architecture:{type:"decoder_only_transformer",vocab_size:p.vocab,max_sequence_length:p.seq,hidden_size:p.hidden,num_layers:p.layers,num_attention_heads:p.heads,feed_forward_multiplier:4,dropout:0.1,tie_word_embeddings:true},
    tokenizer:{type:"byte_level_bpe",training_from_scratch:true,target_vocab_size:p.vocab,normalization:"unicode_nfc",languages:p.languages},
    initialization:{weights:"random",method:"architecture_defined",seed},
    training:{objective:"causal_language_modeling_next_token_prediction",learning_rate:profile==="bilingual-base-1b"?0.0001:0.0003,optimizer:profile==="bilingual-base-1b"?"adamw_8bit":"adamw",gradient_checkpointing:profile==="bilingual-base-1b",weight_decay:0.1,warmup_steps:profile==="bilingual-base-1b"?100:Math.max(1,Math.round(p.steps*0.1)),max_steps:p.steps,micro_batch_size:1,gradient_accumulation_steps:profile==="bilingual-base-1b"?16:8,gradient_clipping:1,precision:"auto",checkpoint_interval_steps:profile==="bilingual-base-1b"?25:Math.max(10,Math.min(100,Math.round(p.steps/10))),evaluation_interval_steps:profile==="bilingual-base-1b"?50:Math.max(10,Math.min(100,Math.round(p.steps/10))),resume_from_checkpoint:true},
    data:{require_license_record:true,require_provenance_record:true,deduplicate:true,split:["train","validation","test"],language_balance:"measure_before_sampling"},
    resource_policy:{target:"free_compliant_cloud_notebooks",paid_fallback:false,user_started_sessions_only:true,save_checkpoint_before_runtime_limit:true,...(profile==="bilingual-base-1b"?{require_cuda:true,minimum_gpu_memory_gib:24,hardware_note:"8-bit AdamW state lower bound is about 9.53 GiB before activations and runtime overhead; gradient checkpointing reduces activation memory. 24 GiB is a conservative minimum preflight, not a fit guarantee."}:{})}
  };
}
function downloadModelConfig(profile:ModelProfile,seed:number):void {
  const blob=new Blob([JSON.stringify(makeModelConfig(profile,seed),null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
  anchor.href=url;anchor.download=profile+".json";anchor.click();URL.revokeObjectURL(url);
}
function aiCoreView():string {
  const cards=(Object.keys(modelProfiles) as ModelProfile[]).map(profile=>{
    const p=modelProfiles[profile],e=modelEstimate(profile);
    return `<article class="ai-model-card"><div class="ai-model-top"><span class="ai-model-symbol">✳</span><span class="ai-status">CONFIG ONLY</span></div><h3>${p.name}</h3><p>${p.description}</p><div class="ai-model-stats"><span><b>${e.parameters.toLocaleString()}</b><small>PARAMETERS</small></span><span><b>${e.weightMiB.toFixed(1)} MiB</b><small>FP32 WEIGHTS</small></span></div><small class="ai-model-languages">${p.languages.join(" · ").toUpperCase()}</small></article>`;
  }).join("");
  return `<div class="ai-page"><div class="page-heading"><div><div class="eyebrow">FIRST-PARTY INTELLIGENCE</div><h1>MMD AI <span>Core</span></h1><p class="page-lead">A family of models designed to be initialized and trained from scratch by MMD GameForge.</p></div><button class="button button-primary" data-ai-action="workshop">Open Model Workshop ↗</button></div><section class="ai-warning"><b id="ai-model-state">Research status — no trained model is installed yet.</b><p>These are architecture profiles only. Real capability requires licensed data, completed cloud training, held-out evaluation and a verified model bundle.</p></section><div class="ai-section-head"><div><span class="eyebrow">MODEL FAMILY</span><h2>First-party model profiles</h2></div><span class="section-note">RANDOM INITIALIZATION ONLY</span></div><div class="ai-model-grid">${cards}</div><section class="ai-installed panel"><div class="panel-heading"><div><span class="eyebrow">LOCAL MODEL LIBRARY</span><h2>Imported model bundles</h2></div><button class="button button-primary" id="ai-import-model">Import extracted bundle folder</button></div><div id="ai-imported-models" class="ai-imported-list"><p>Checking installed models…</p></div><section class="ai-chat"><div><span class="eyebrow">LOCAL INFERENCE</span><h3>Test an imported model</h3></div><select id="ai-chat-model" aria-label="Installed model"><option value="">Select an imported model</option></select><textarea id="ai-chat-prompt" rows="4" placeholder="Ask the selected MMD model to help design a game mechanic…"></textarea><div class="ai-chat-actions"><label for="ai-max-tokens">RESPONSE TOKENS</label><select id="ai-max-tokens"><option value="128">128</option><option value="256" selected>256</option><option value="512">512</option><option value="1024">1024</option></select><button class="button button-primary" id="ai-chat-generate">Generate response</button><button class="button button-ghost" id="ai-chat-clear">Clear conversation</button><span id="ai-runtime-status">Runtime stopped</span></div><pre id="ai-chat-output">Generated responses will appear here.</pre><div id="ai-tool-proposal" class="ai-tool-proposal" hidden></div><pre id="ai-tool-result" class="ai-tool-result" hidden></pre></section><small class="ai-fineprint">Import verifies SHA-256 hashes and from-scratch lineage. Extract the ZIP bundle first. Local inference requires a Python environment with PyTorch and tokenizers installed.</small></section><section class="ai-pipeline"><div><span class="eyebrow">TRAINING PIPELINE</span><h2>From dataset to verified model</h2><p>Dataset Studio → Cloud Training → Evaluation → Model Bundle → Desktop Runtime.</p></div><button class="button button-ghost" data-ai-action="training">View training pipeline</button></section></div>`;
}
function trainingView():string {
  return `<div class="ai-page"><div class="page-heading"><div><div class="eyebrow">MMD CLOUD TRAINING</div><h1>Model <span>Workshop</span></h1><p class="page-lead">Prepare reproducible model configurations and estimate their parameter and memory requirements.</p></div></div><section class="ai-warning"><b>No cloud job is running.</b><p>Start Kaggle or Colab manually from its official interface. Free GPU availability is not guaranteed. Never add API keys or private datasets to this public repository.</p></section><section class="ai-workshop panel"><div class="ai-workshop-copy"><span class="eyebrow">MODEL FACTORY / CONFIGURATION BUILDER</span><h2>Create a model configuration</h2><p>Select a from-scratch architecture profile. This creates a configuration file only; it does not create trained weights.</p><label for="ai-profile">MODEL PROFILE</label><select id="ai-profile">${(Object.keys(modelProfiles) as ModelProfile[]).map(k=>`<option value="${k}">${modelProfiles[k].name}</option>`).join("")}</select><label for="ai-seed">RANDOM INITIALIZATION SEED</label><input id="ai-seed" type="number" min="1" max="2147483647" value="20261108"/><div id="ai-estimate" class="ai-estimate"></div><button class="button button-primary" id="ai-download-config">↓ Export model config (.json)</button><p class="ai-fineprint">Memory is a lower-bound estimate. Activations, CUDA workspace and framework overhead are additional.</p></div><aside class="ai-workshop-side"><span class="eyebrow">NEXT STEPS</span><ol><li>Review document-level source rights with MCT-10 before preparing any corpus.</li><li>Prepare the approved corpus with Dataset Studio and preserve provenance.</li><li>Review the model configuration and resource estimate.</li><li>Run the notebook manually in Kaggle or Colab; save checkpoints before session limits.</li><li>Evaluate held-out tasks and export a hash-verified model bundle.</li><li>Import the extracted bundle into the desktop runtime and test it locally.</li><li>Complete MCT-11 human review and a real UnrealBuildTool build before any release decision.</li></ol><a href="https://github.com/pctaha501-create/MMD-GameForge/tree/feat/mmd-cloud-training-mct-02/cloud/notebooks" target="_blank" rel="noreferrer">Open cloud notebook templates ↗</a><a href="https://github.com/pctaha501-create/MMD-GameForge/blob/feat/mmd-cloud-training-mct-02/docs/MCT_10_DATASET_SOURCE_REVIEW.md" target="_blank" rel="noreferrer">Dataset rights review ↗</a><a href="https://github.com/pctaha501-create/MMD-GameForge/blob/feat/mmd-cloud-training-mct-02/docs/MCT_11_MODEL_ACCEPTANCE.md" target="_blank" rel="noreferrer">Model acceptance gate ↗</a></aside></section></div>`;
}

function parseAIToolCall(output:string):unknown {
  let trimmed=output.trim();
  if(trimmed.startsWith("```")){
    const newline=trimmed.indexOf("\n");
    if(newline>=0)trimmed=trimmed.slice(newline+1);
    if(trimmed.endsWith("```"))trimmed=trimmed.slice(0,-3).trim();
  }
  try{return JSON.parse(trimmed) as unknown;}catch{return null;}
}
function renderAIToolProposal(output:string):void {
  const root=document.querySelector<HTMLDivElement>("#ai-tool-proposal");if(!root)return;
  const parsed=parseAIToolCall(output);const result=validateAIToolCall(parsed);
  if(!result.ok){root.hidden=true;root.innerHTML="";return;}
  const labels:Record<string,string>={"project.list_files":"List project files","project.read_file":"Read project file","project.write_file":"Overwrite project file","project.create_file":"Create project file","scene.save":"Save scene","unreal.detect":"Detect Unreal Engine","unreal.validate_project":"Validate Unreal project structure","unreal.create_project":"Create Unreal C++ project scaffold","unreal.build_project":"Build Unreal project with UnrealBuildTool","unreal.launch":"Launch Unreal Editor"};
  root.hidden=false;
  root.innerHTML=`<div class="ai-tool-proposal-head"><b>Proposed GameForge action</b><span>USER APPROVAL REQUIRED</span></div><p>${escapeHtml(labels[result.value.tool]??result.value.tool)}</p><code>${escapeHtml(JSON.stringify(result.value.arguments,null,2))}</code><button class="button button-primary" id="ai-run-tool">Review and run action</button><small>Nothing has been changed. This allowlisted action runs only after you approve it.</small>`;
  root.querySelector("#ai-run-tool")?.addEventListener("click",()=>void executeAITool(result.value));
}
async function executeAITool(call:{tool:string;arguments:Record<string,unknown>}):Promise<void>{
  const result=document.querySelector<HTMLPreElement>("#ai-tool-result");
  const proposal=document.querySelector<HTMLDivElement>("#ai-tool-proposal");
  const project=activeProject;
  if(!project){notify("Open a project before using project tools.","error");return;}
  const a=call.arguments;
  try{
    let value:unknown;
    switch(call.tool){
      case "project.list_files":
        value=await window.gameForge.listProjectFiles(project.path);break;
      case "project.read_file":
        value=await window.gameForge.readProjectFile(project.path,String(a.path));break;
      case "project.write_file":
        if(!window.confirm(`Allow MMD AI to overwrite ${String(a.path)} in this project?`))return;
        value=await window.gameForge.writeProjectFile(project.path,String(a.path),String(a.content));break;
      case "project.create_file":
        if(!window.confirm(`Allow MMD AI to create ${String(a.path)} in this project?`))return;
        value=await window.gameForge.createProjectFile(project.path,String(a.path),String(a.content));break;
      case "scene.save":
        if(!window.confirm(`Save scene "${String(a.scene_name)}" into this project?`))return;
        value=await window.gameForge.saveScene(project.path,String(a.scene_name),String(a.content));break;
      case "unreal.detect":
        value=await window.gameForge.detectUnreal(project.path);break;
      case "unreal.validate_project":
        value=await window.gameForge.validateUnrealProject(project.path);break;
      case "unreal.create_project":
        if(!window.confirm(`Create Unreal C++ project ${String(a.project_name)} inside the active workspace?`))return;
        value=await window.gameForge.createUnrealProject(project.path,String(a.project_name));break;
      case "unreal.build_project":
        if(!window.confirm("Run UnrealBuildTool to compile the active Unreal project for Win64 Development? This may take several minutes."))return;
        value=await window.gameForge.buildUnrealProject(project.path);break;
      case "unreal.launch":{
        const status=await window.gameForge.detectUnreal(project.path);
        if(!status.projectFile)throw new Error("No .uproject file was found in the active project.");
        if(!status.installed||!status.editorPath)throw new Error("Unreal Editor was not detected. Configure its path in Settings.");
        if(!window.confirm("Launch Unreal Editor with the active project?"))return;
        value=await window.gameForge.launchUnreal(status.projectFile,status.editorPath);break;
      }
      default: throw new Error("This tool is not allowlisted.");
    }
    if(result){result.hidden=false;result.textContent=JSON.stringify(value,null,2);}
    if(proposal)proposal.hidden=true;
    notify("Approved GameForge action completed.");
  }catch(error){if(result){result.hidden=false;result.textContent=error instanceof Error?error.message:"Tool execution failed.";}notify(error instanceof Error?error.message:"Tool execution failed.","error");}
}

function bindAIEvents():void {
  document.querySelectorAll<HTMLElement>("[data-ai-action]").forEach(node=>node.addEventListener("click",()=>setView(node.dataset.aiAction==="training"?"training":"training")));
  const importButton=document.querySelector<HTMLButtonElement>("#ai-import-model");
  const importedList=document.querySelector<HTMLDivElement>("#ai-imported-models");
  const refreshModels=async()=>{
    if(!importedList)return;
    try{
      const models=await window.gameForge.listModels();
      const stateLabel=document.querySelector<HTMLParagraphElement>("#ai-model-state");
      if(stateLabel)stateLabel.textContent=models.length?`${models.length} verified model bundle(s) installed. Runtime must be started before generation.`:"Research status — no trained model is installed yet.";
      const select=document.querySelector<HTMLSelectElement>("#ai-chat-model");
      const previous=select?.value;
      if(select)select.innerHTML=`<option value="">Select an imported model</option>`+models.map(model=>`<option value="${escapeHtml(model.id)}">${escapeHtml(model.modelFamily)}${model.running?" · RUNNING":""}</option>`).join("");
      if(select&&models.some(model=>model.id===previous))select.value=previous!;
      importedList.innerHTML=models.length?models.map(model=>`<article class="ai-imported-row"><div><b>${escapeHtml(model.modelFamily)}</b><small>Installed ${new Date(model.installedAt).toLocaleString()} · Dataset ${escapeHtml(model.datasetRevision)} · ${model.runtimeDevice?escapeHtml(model.runtimeDevice):"Runtime stopped"}</small></div><span class="ai-status">${model.running?"RUNTIME READY":"HASH VERIFIED"}</span><strong>${model.testLoss===null?"No loss":`Test loss ${model.testLoss.toFixed(3)}`}</strong><button class="button button-ghost" data-model-runtime="${escapeHtml(model.id)}">${model.running?"Stop runtime":"Start runtime"}</button></article>`).join(""):`<p class="ai-empty-models">No verified model bundles imported yet.</p>`;
      importedList.querySelectorAll<HTMLButtonElement>("[data-model-runtime]").forEach(button=>button.addEventListener("click",async()=>{
        const id=button.dataset.modelRuntime!;button.disabled=true;
        try{if(models.find(model=>model.id===id)?.running){await window.gameForge.stopModel(id);notify("Local model runtime stopped.");}
        else{const result=await window.gameForge.startModel(id);if(result)notify(`Local runtime ready on ${result.device}.`);}
        await refreshModels();}
        catch(error){notify(error instanceof Error?error.message:"Could not change model runtime state.","error");}
        finally{button.disabled=false;}
      }));
      const status=document.querySelector<HTMLSpanElement>("#ai-runtime-status");
      if(status)status.textContent=models.some(model=>model.running)?"At least one local runtime is running":"Runtime stopped";
    }catch(error){importedList.textContent=error instanceof Error?error.message:"Could not read model inventory.";}
  };
  void refreshModels();
  importButton?.addEventListener("click",async()=>{
    importButton.disabled=true;importButton.textContent="Verifying bundle…";
    try{const model=await window.gameForge.importModelBundleFolder();if(model){notify(`Imported ${model.modelFamily} after hash verification.`);await refreshModels();}}
    catch(error){notify(error instanceof Error?error.message:"Model import failed.","error");}
    finally{importButton.disabled=false;importButton.textContent="Import extracted bundle folder";}
  });

  document.querySelector<HTMLButtonElement>("#ai-chat-clear")?.addEventListener("click",()=>{aiConversation=[];const output=document.querySelector<HTMLPreElement>("#ai-chat-output");if(output)output.textContent="Conversation cleared. Start a new chat.";const proposal=document.querySelector<HTMLDivElement>("#ai-tool-proposal");if(proposal){proposal.hidden=true;proposal.innerHTML="";}const result=document.querySelector<HTMLPreElement>("#ai-tool-result");if(result){result.hidden=true;result.textContent="";}});

  document.querySelector<HTMLButtonElement>("#ai-chat-generate")?.addEventListener("click",async()=>{
    const modelId=document.querySelector<HTMLSelectElement>("#ai-chat-model")?.value;
    const prompt=document.querySelector<HTMLTextAreaElement>("#ai-chat-prompt")?.value??"";
    const output=document.querySelector<HTMLPreElement>("#ai-chat-output");
    const button=document.querySelector<HTMLButtonElement>("#ai-chat-generate");
    if(!modelId){notify("Import and select a model first.","error");return;}
    if(!prompt.trim()){notify("Enter a prompt first.","error");return;}
    if(button){button.disabled=true;button.textContent="Generating…";}
    if(output)output.textContent="The local model is generating…";
    try{
      aiConversation.push({role:"user",content:prompt});
      const projectContext=activeProject?`Active project: ${activeProject.name}. Project tools operate only inside this folder.\n`:"No active project is open. Do not propose project tools.\n";
      const history=aiConversation.slice(-8).map(message=>`${message.role==="user"?"User":"Assistant"}: ${message.content}`).join("\n\n");
      const systemPrompt=`You are MMD GameForge AI. Help with Unreal game development. You may answer normally. If you need a project action, output exactly one JSON object using schema_version "mmd.tool-call.v1", an allowlisted tool, and arguments. Allowed tools: project.list_files {}, project.read_file {path}, project.write_file {path,content}, project.create_file {path,content}, scene.save {scene_name,content}, unreal.detect {}, unreal.validate_project {}, unreal.create_project {project_name}, unreal.build_project {}, unreal.launch {}. Never output shell commands or arbitrary code execution requests. Ask before destructive actions; the desktop will independently require approval. Do not claim a tool ran unless its result is provided.\n${projectContext}Conversation:\n${history}\nAssistant:`;
      const maxNewTokens=Number(document.querySelector<HTMLSelectElement>("#ai-max-tokens")?.value??256);
      const result=await window.gameForge.generateWithModel(modelId,systemPrompt,{maxNewTokens,temperature:.8,topK:40});
      const answer=result.output||"(The model returned an empty response.)";
      aiConversation.push({role:"assistant",content:answer});
      aiConversation=aiConversation.slice(-12);
      if(output)output.textContent=aiConversation.map(message=>`${message.role==="user"?"YOU":"MMD AI"}:\n${message.content}`).join("\n\n");
      renderAIToolProposal(result.output);notify(`Generated with ${result.modelFamily} on ${result.device}.`);
    }
    catch(error){if(output)output.textContent=error instanceof Error?error.message:"Generation failed.";notify(error instanceof Error?error.message:"Generation failed.","error");}
    finally{if(button){button.disabled=false;button.textContent="Generate response";}}
  });

  const profile=document.querySelector<HTMLSelectElement>("#ai-profile");
  const seed=document.querySelector<HTMLInputElement>("#ai-seed");
  const estimate=document.querySelector<HTMLDivElement>("#ai-estimate");
  const update=()=>{
    if(!profile||!seed||!estimate)return;
    const key=profile.value as ModelProfile,e=modelEstimate(key),p=modelProfiles[key];
    estimate.innerHTML=`<div><small>MODEL PARAMETERS</small><b>${e.parameters.toLocaleString()}</b></div><div><small>FP32 WEIGHTS</small><b>${e.weightMiB.toFixed(1)} MiB</b></div><div><small>ADAMW LOWER BOUND</small><b>${e.adamMiB.toFixed(1)} MiB</b></div><p>${p.layers} layers · ${p.hidden} hidden · ${p.heads} attention heads · ${p.seq} context</p>`;
  };
  profile?.addEventListener("change",update);seed?.addEventListener("input",update);update();
  document.querySelector("#ai-download-config")?.addEventListener("click",()=>{
    const value=Number(seed?.value);if(!Number.isSafeInteger(value)||value<1||value>2147483647){notify("Enter a valid positive integer seed.","error");return;}
    downloadModelConfig(profile!.value as ModelProfile,value);notify("Model configuration exported. No weights were created.");
  });
}

function moduleView(view: Exclude<View, "dashboard" | "projects">): string {
  if (view === "ai") return aiCoreView();
  if (view === "training") return trainingView();
  if (["world", "code", "assets", "settings"].includes(view)) return renderProfessional(view as "world" | "code" | "assets" | "settings", activeProject);
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
  if (currentView === "ai" || currentView === "training") bindAIEvents();
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
