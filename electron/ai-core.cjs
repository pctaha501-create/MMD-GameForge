const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, randomBytes, createHash } = require("node:crypto");

const MAX_DATASET_BYTES = 2 * 1024 * 1024;
const MAX_TRAINING_CHARS = 20_000;
const MAX_VOCABULARY = 128;
const HIDDEN_SIZE = 24;
const LEARNING_RATE = 0.06;
const idPattern = /^[a-f0-9-]{36}$/i;

function safeName(value) {
  return String(value || "").trim().replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").slice(0, 64) || "Untitled";
}
function seededRandom(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function forward(model, inputIndex, temperature = 1) {
  const v = model.vocabulary.length; const hSize = model.hiddenSize;
  const hidden = new Float64Array(hSize); const logits = new Float64Array(v);
  for (let h = 0; h < hSize; h++) hidden[h] = Math.tanh(model.hiddenBias[h] + model.inputWeights[inputIndex * hSize + h]);
  let max = -Infinity;
  for (let k = 0; k < v; k++) { let value = model.outputBias[k]; for (let h = 0; h < hSize; h++) value += hidden[h] * model.outputWeights[h * v + k]; logits[k] = value / temperature; if (logits[k] > max) max = logits[k]; }
  let total = 0; const probabilities = new Float64Array(v);
  for (let k = 0; k < v; k++) { probabilities[k] = Math.exp(logits[k] - max); total += probabilities[k]; }
  for (let k = 0; k < v; k++) probabilities[k] /= total;
  return { hidden, probabilities };
}
function sample(probabilities, random = Math.random) {
  let value = random();
  for (let i = 0; i < probabilities.length; i++) { value -= probabilities[i]; if (value <= 0) return i; }
  return probabilities.length - 1;
}

class AiCore {
  constructor(storagePath) { this.storagePath = storagePath; this.datasetsPath = path.join(storagePath, "datasets"); this.modelsPath = path.join(storagePath, "models"); }
  async initialize() { await fs.mkdir(this.datasetsPath, { recursive: true }); await fs.mkdir(this.modelsPath, { recursive: true }); }
  async status() {
    await this.initialize();
    const [datasets, models] = await Promise.all([fs.readdir(this.datasetsPath), fs.readdir(this.modelsPath)]);
    return { runtime: "MMD Local Neural Research Runtime", mode: "offline", datasets: datasets.filter(x => x.endsWith(".json")).length, models: models.filter(x => x.endsWith(".json")).length, storagePath: this.storagePath, modelKind: "character MLP · 24 hidden units", limitations: ["This is a tiny character-level neural model, not a general-purpose assistant or GPT-class system.", "It predicts one character from the previous character; it does not understand game design or semantics.", "Training is CPU-only and capped at 20,000 characters and 128 unique characters for predictable resource use.", "No pretrained weights, cloud API, external model service, or network connection is used."] };
  }
  async importDataset(sourcePath, provenanceInput = {}) {
    const info = await fs.stat(sourcePath);
    if (!info.isFile() || info.size < 32 || info.size > MAX_DATASET_BYTES) throw new Error("Choose a UTF-8 text file between 32 bytes and 2 MB.");
    const sourceBytes = await fs.readFile(sourcePath);
    if (sourceBytes.byteLength !== info.size) throw new Error("The dataset changed while it was being imported.");
    let decoded;
    try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes); }
    catch { throw new Error("The selected dataset is not valid UTF-8 text."); }
    const text = decoded.replace(/\r\n?/g, "\n");
    if (!text.trim()) throw new Error("The selected dataset is empty.");
    if ([...text].length < 40) throw new Error("The dataset needs at least 40 characters.");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const provenance = this.normalizeDatasetProvenance(provenanceInput, path.basename(sourcePath), sourceBytes, text, createdAt);
    const doc = { id, name: safeName(path.basename(sourcePath, path.extname(sourcePath))), createdAt, characters: [...text].length, text, provenance };
    await this.atomicWrite(path.join(this.datasetsPath, id + ".json"), JSON.stringify(doc));
    return { id, name: doc.name, bytes: sourceBytes.byteLength, characters: doc.characters, createdAt, provenance };
  }
  normalizeDatasetProvenance(input, originalFileName, sourceBytes, text, importedAt) {
    if (input == null) input = {};
    if (typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid dataset provenance metadata.");
    const readText = (key, fallback, maxLength) => {
      const value = input[key] === undefined ? fallback : input[key];
      if (typeof value !== "string") throw new Error(`Dataset ${key} must be text.`);
      const normalized = value.trim();
      if (normalized.length > maxLength) throw new Error(`Dataset ${key} cannot exceed ${maxLength} characters.`);
      return normalized;
    };
    return {
      schemaVersion: 1,
      sourceType: "user-local-file",
      originalFileName: path.basename(originalFileName),
      importedAt,
      encoding: "utf-8",
      normalization: "CRLF/CR converted to LF",
      sourceReference: readText("sourceReference", "", 512),
      license: readText("license", "not-declared", 128) || "not-declared",
      attribution: readText("attribution", "", 512),
      notes: readText("notes", "", 1024),
      sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
      contentSha256: createHash("sha256").update(text, "utf8").digest("hex")
    };
  }
  async listDatasets() {
    await this.initialize(); const names = (await fs.readdir(this.datasetsPath)).filter(x => x.endsWith(".json")); const out = [];
    for (const name of names) {
      try {
        const d = JSON.parse(await fs.readFile(path.join(this.datasetsPath, name), "utf8"));
        const contentSha256 = createHash("sha256").update(String(d.text || ""), "utf8").digest("hex");
        const provenance = d.provenance || { schemaVersion: 0, sourceType: "legacy-local-import", originalFileName: `${d.name || "dataset"}.txt`, importedAt: d.createdAt, encoding: "unknown", normalization: "unknown", sourceReference: "", license: "not-declared", attribution: "", notes: "Legacy record: source details were not captured.", sourceSha256: "", contentSha256 };
        out.push({ id: d.id, name: d.name, bytes: Buffer.byteLength(d.text), characters: d.characters, createdAt: d.createdAt, provenance });
      } catch { /* Skip invalid records. */ }
    }
    return out.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async train(datasetId, modelName) {
    if (typeof datasetId !== "string" || !idPattern.test(datasetId)) throw new Error("Invalid dataset identifier.");
    const dataset = JSON.parse(await fs.readFile(path.join(this.datasetsPath, datasetId + ".json"), "utf8"));
    if (!dataset || typeof dataset.text !== "string") throw new Error("Dataset record is invalid.");
    const datasetSha256 = createHash("sha256").update(dataset.text, "utf8").digest("hex");
    if (dataset.provenance?.schemaVersion >= 1 && dataset.provenance.contentSha256 !== datasetSha256) throw new Error("Dataset content hash does not match its provenance record.");
    const datasetProvenance = dataset.provenance || { schemaVersion: 0, sourceType: "legacy-local-import", originalFileName: `${dataset.name || "dataset"}.txt`, importedAt: dataset.createdAt, encoding: "unknown", normalization: "unknown", sourceReference: "", license: "not-declared", attribution: "", notes: "Legacy record: source details were not captured.", sourceSha256: "", contentSha256: datasetSha256 };
    const chars = [...dataset.text].slice(0, MAX_TRAINING_CHARS);
    if (chars.length < 40) throw new Error("Dataset is too small to train.");
    const vocabulary = [...new Set(chars)];
    if (vocabulary.length > MAX_VOCABULARY) throw new Error(`Dataset has ${vocabulary.length} unique characters; this CPU model supports at most ${MAX_VOCABULARY}.`);
    const index = new Map(vocabulary.map((char, i) => [char, i]));
    const seed = randomBytes(4).readUInt32LE(0) || 1; const random = seededRandom(seed);
    const v = vocabulary.length; const hSize = HIDDEN_SIZE;
    const inputWeights = new Float64Array(v * hSize); const outputWeights = new Float64Array(hSize * v);
    const hiddenBias = new Float64Array(hSize); const outputBias = new Float64Array(v);
    const inputLimit = Math.sqrt(6 / (v + hSize)); const outputLimit = Math.sqrt(6 / (hSize + v));
    for (let i = 0; i < inputWeights.length; i++) inputWeights[i] = (random() * 2 - 1) * inputLimit;
    for (let i = 0; i < outputWeights.length; i++) outputWeights[i] = (random() * 2 - 1) * outputLimit;
    const samples = [];
    for (let i = 0; i + 1 < chars.length; i++) samples.push([index.get(chars[i]), index.get(chars[i + 1])]);
    for (let i = samples.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [samples[i], samples[j]] = [samples[j], samples[i]]; }
    let totalLoss = 0;
    for (const [input, target] of samples) {
      const hidden = new Float64Array(hSize);
      for (let h = 0; h < hSize; h++) hidden[h] = Math.tanh(hiddenBias[h] + inputWeights[input * hSize + h]);
      const logits = new Float64Array(v); let max = -Infinity;
      for (let k = 0; k < v; k++) { let z = outputBias[k]; for (let h = 0; h < hSize; h++) z += hidden[h] * outputWeights[h * v + k]; logits[k] = z; if (z > max) max = z; }
      const probabilities = new Float64Array(v); let sum = 0;
      for (let k = 0; k < v; k++) { probabilities[k] = Math.exp(logits[k] - max); sum += probabilities[k]; }
      for (let k = 0; k < v; k++) probabilities[k] /= sum;
      totalLoss -= Math.log(Math.max(probabilities[target], 1e-12));
      const hiddenGradient = new Float64Array(hSize);
      for (let h = 0; h < hSize; h++) for (let k = 0; k < v; k++) hiddenGradient[h] += outputWeights[h * v + k] * (probabilities[k] - (k === target ? 1 : 0));
      for (let k = 0; k < v; k++) { const grad = probabilities[k] - (k === target ? 1 : 0); outputBias[k] -= LEARNING_RATE * grad; for (let h = 0; h < hSize; h++) outputWeights[h * v + k] -= LEARNING_RATE * grad * hidden[h]; }
      for (let h = 0; h < hSize; h++) { const grad = hiddenGradient[h] * (1 - hidden[h] * hidden[h]); inputWeights[input * hSize + h] -= LEARNING_RATE * grad; hiddenBias[h] -= LEARNING_RATE * grad; }
    }
    const model = { id: randomUUID(), name: safeName(modelName), datasetId, datasetName: dataset.name, datasetSha256, datasetProvenance, createdAt: new Date().toISOString(), trainedCharacters: chars.length, vocabulary, vocabularySize: v, hiddenSize: hSize, architecture: "one-hot character → tanh hidden layer → softmax character", initialization: "Xavier uniform random initialization", seed, epochs: 1, learningRate: LEARNING_RATE, trainingLoss: totalLoss / samples.length, kind: "mmd-char-mlp-v1", inputWeights: Array.from(inputWeights), outputWeights: Array.from(outputWeights), hiddenBias: Array.from(hiddenBias), outputBias: Array.from(outputBias) };
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
    let output = String(prompt || ""); const lookup = new Map(model.vocabulary.map((char, i) => [char, i]));
    let inputIndex = -1; for (const char of [...output].reverse()) { if (lookup.has(char)) { inputIndex = lookup.get(char); break; } }
    if (inputIndex < 0) inputIndex = 0;
    const random = Math.random;
    for (let i = 0; i < limit; i++) { const result = forward(model, inputIndex, 0.85); inputIndex = sample(result.probabilities, random); output += model.vocabulary[inputIndex]; }
    return output;
  }
  publicModel(m) { return { id: m.id, name: m.name, datasetName: m.datasetName, datasetSha256: m.datasetSha256 || "", datasetLicense: m.datasetProvenance?.license || "not-declared", datasetSourceReference: m.datasetProvenance?.sourceReference || "", createdAt: m.createdAt, trainedCharacters: m.trainedCharacters, vocabularySize: m.vocabularySize, hiddenSize: m.hiddenSize, architecture: m.architecture, initialization: m.initialization, seed: m.seed, epochs: m.epochs, learningRate: m.learningRate, trainingLoss: m.trainingLoss, kind: m.kind }; }
  async atomicWrite(target, content) { const temp = target + ".tmp-" + randomUUID(); await fs.writeFile(temp, content, "utf8"); await fs.rename(temp, target); }
}
module.exports = { AiCore, seededRandom, forward, sample, safeName, MAX_DATASET_BYTES, MAX_TRAINING_CHARS, MAX_VOCABULARY, HIDDEN_SIZE };
