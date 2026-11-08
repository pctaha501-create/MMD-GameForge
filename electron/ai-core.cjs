const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const MAX_DATASET_BYTES = 2 * 1024 * 1024;
const MAX_TRAINING_CHARS = 250_000;
const CONTEXT = 3;
const idPattern = /^[a-f0-9-]{36}$/i;

function safeName(value) {
  return String(value || "").trim().replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").slice(0, 64) || "Untitled";
}
function weightedPick(counts, random = Math.random) {
  const entries = Object.entries(counts || {});
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return undefined;
  let target = random() * total;
  for (const [value, count] of entries) { target -= count; if (target <= 0) return value; }
  return entries[entries.length - 1]?.[0];
}

class AiCore {
  constructor(storagePath) { this.storagePath = storagePath; this.datasetsPath = path.join(storagePath, "datasets"); this.modelsPath = path.join(storagePath, "models"); }
  async initialize() { await fs.mkdir(this.datasetsPath, { recursive: true }); await fs.mkdir(this.modelsPath, { recursive: true }); }
  async status() {
    await this.initialize();
    const [datasets, models] = await Promise.all([fs.readdir(this.datasetsPath), fs.readdir(this.modelsPath)]);
    return { runtime: "MMD Local Research Runtime", mode: "offline", datasets: datasets.filter(x => x.endsWith(".json")).length, models: models.filter(x => x.endsWith(".json")).length, storagePath: this.storagePath, modelKind: "character-trigram research baseline", limitations: ["This is a small statistical character model, not a neural network or GPT-class assistant.", "It learns character transitions from the imported corpus; output quality depends on corpus size and quality.", "It uses no pretrained weights, cloud API, external model service, or network connection."] };
  }
  async importDataset(sourcePath) {
    const info = await fs.stat(sourcePath);
    if (!info.isFile() || info.size < 32 || info.size > MAX_DATASET_BYTES) throw new Error("Choose a UTF-8 text file between 32 bytes and 2 MB.");
    const text = (await fs.readFile(sourcePath, "utf8")).replace(/\r\n?/g, "\n");
    if (!text.trim()) throw new Error("The selected dataset is empty.");
    if ([...text].length < 40) throw new Error("The dataset needs at least 40 characters.");
    const id = randomUUID();
    const doc = { id, name: safeName(path.basename(sourcePath, path.extname(sourcePath))), createdAt: new Date().toISOString(), characters: [...text].length, text };
    await this.atomicWrite(path.join(this.datasetsPath, id + ".json"), JSON.stringify(doc));
    return { id, name: doc.name, bytes: info.size, characters: doc.characters, createdAt: doc.createdAt };
  }
  async listDatasets() {
    await this.initialize(); const names = (await fs.readdir(this.datasetsPath)).filter(x => x.endsWith(".json")); const out = [];
    for (const name of names) { try { const d = JSON.parse(await fs.readFile(path.join(this.datasetsPath, name), "utf8")); out.push({ id: d.id, name: d.name, bytes: Buffer.byteLength(d.text), characters: d.characters, createdAt: d.createdAt }); } catch { /* Skip invalid records. */ } }
    return out.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async train(datasetId, modelName) {
    if (typeof datasetId !== "string" || !idPattern.test(datasetId)) throw new Error("Invalid dataset identifier.");
    const dataset = JSON.parse(await fs.readFile(path.join(this.datasetsPath, datasetId + ".json"), "utf8"));
    const chars = [...dataset.text].slice(0, MAX_TRAINING_CHARS);
    if (chars.length < 40) throw new Error("Dataset is too small to train.");
    const transitions = Object.create(null); const starts = Object.create(null); const vocabulary = new Set(chars);
    for (let i = 0; i < chars.length; i++) {
      const context = chars.slice(Math.max(0, i - CONTEXT), i).join("");
      if (i < CONTEXT) starts[chars[i]] = (starts[chars[i]] || 0) + 1;
      if (i + 1 < chars.length) { const row = transitions[context] || (transitions[context] = Object.create(null)); row[chars[i + 1]] = (row[chars[i + 1]] || 0) + 1; }
    }
    const model = { id: randomUUID(), name: safeName(modelName), datasetId, datasetName: dataset.name, createdAt: new Date().toISOString(), trainedCharacters: chars.length, vocabularySize: vocabulary.size, contextLength: CONTEXT, kind: "character-trigram", transitions, starts };
    await this.atomicWrite(path.join(this.modelsPath, model.id + ".json"), JSON.stringify(model));
    return this.publicModel(model);
  }
  async listModels() {
    await this.initialize(); const names = (await fs.readdir(this.modelsPath)).filter(x => x.endsWith(".json")); const out = [];
    for (const name of names) { try { out.push(this.publicModel(JSON.parse(await fs.readFile(path.join(this.modelsPath, name), "utf8")))); } catch { /* Skip invalid checkpoints. */ } }
    return out.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async generate(modelId, prompt, requestedCharacters) {
    if (typeof modelId !== "string" || !idPattern.test(modelId)) throw new Error("Invalid model identifier.");
    const model = JSON.parse(await fs.readFile(path.join(this.modelsPath, modelId + ".json"), "utf8"));
    const limit = Math.min(500, Math.max(1, Math.floor(Number(requestedCharacters) || 180)));
    let output = String(prompt || "");
    if (!output) output = weightedPick(model.starts) || Object.keys(model.transitions)[0] || " ";
    for (let i = 0; i < limit; i++) {
      const chars = [...output]; const context = chars.slice(-CONTEXT).join("");
      const next = weightedPick(model.transitions[context]) || weightedPick(model.starts) || " ";
      output += next;
    }
    return output;
  }
  publicModel(m) { return { id: m.id, name: m.name, datasetName: m.datasetName, createdAt: m.createdAt, trainedCharacters: m.trainedCharacters, vocabularySize: m.vocabularySize, contextLength: m.contextLength, kind: m.kind }; }
  async atomicWrite(target, content) { const temp = target + ".tmp-" + randomUUID(); await fs.writeFile(temp, content, "utf8"); await fs.rename(temp, target); }
}
module.exports = { AiCore, weightedPick, safeName, CONTEXT, MAX_DATASET_BYTES, MAX_TRAINING_CHARS };
