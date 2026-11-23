const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, randomBytes, createHash } = require("node:crypto");

const MAX_DATASET_BYTES = 2 * 1024 * 1024;
const MAX_TRAINING_CHARS = 20_000;
const MAX_VOCABULARY = 128;
const HIDDEN_SIZE = 24;
const LEARNING_RATE = 0.06;
const DEFAULT_TRAINING_CHUNK_STEPS = 1024;
const MAX_TRAINING_CHUNK_STEPS = 4096;
const MAX_TRAINING_EPOCHS = 10;
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
function shuffledIndices(length, seed) {
  const random = seededRandom(seed);
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  return indices;
}
function createEvaluationSplits(chars, index) {
  const all = Array.from({ length: chars.length - 1 }, (_, i) => [index.get(chars[i]), index.get(chars[i + 1])]);
  const trainEnd = Math.floor(all.length * 0.8);
  const validationEnd = Math.floor(all.length * 0.9);
  const train = all.slice(0, trainEnd);
  const validation = all.slice(trainEnd, validationEnd);
  const test = all.slice(validationEnd);
  if (!train.length || !validation.length || !test.length) throw new Error("The dataset is too small for train/validation/test evaluation.");
  return { train, validation, test, method: "contiguous-80-10-10" };
}
function evaluateSamples(model, samples) {
  if (!Array.isArray(samples) || samples.length === 0) throw new Error("Evaluation requires at least one sample.");
  let loss = 0;
  let correct = 0;
  for (const [input, target] of samples) {
    const probabilities = forward(model, input, 1).probabilities;
    loss -= Math.log(Math.max(probabilities[target], 1e-12));
    let predicted = 0;
    for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[predicted]) predicted = i;
    if (predicted === target) correct++;
  }
  const crossEntropy = loss / samples.length;
  return { samples: samples.length, crossEntropy, perplexity: Math.exp(crossEntropy), accuracy: correct / samples.length };
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
  normalizeTrainingOptions(input = {}, allowEpochs = false) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid training options.");
    const maxSteps = input.maxSteps === undefined ? DEFAULT_TRAINING_CHUNK_STEPS : input.maxSteps;
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_TRAINING_CHUNK_STEPS) throw new Error(`Training chunks must contain 1–${MAX_TRAINING_CHUNK_STEPS} steps.`);
    let epochs = 1;
    if (allowEpochs) {
      epochs = input.epochs === undefined ? 1 : input.epochs;
      if (!Number.isInteger(epochs) || epochs < 1 || epochs > MAX_TRAINING_EPOCHS) throw new Error(`Training epochs must be between 1 and ${MAX_TRAINING_EPOCHS}.`);
    }
    return { maxSteps, epochs };
  }
  async train(datasetId, modelName, options = {}) {
    if (typeof datasetId !== "string" || !idPattern.test(datasetId)) throw new Error("Invalid dataset identifier.");
    const trainingOptions = this.normalizeTrainingOptions(options, true);
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
    const seed = randomBytes(4).readUInt32LE(0) || 1;
    const random = seededRandom(seed);
    const v = vocabulary.length; const hSize = HIDDEN_SIZE;
    const inputWeights = new Float64Array(v * hSize); const outputWeights = new Float64Array(hSize * v);
    const hiddenBias = new Float64Array(hSize); const outputBias = new Float64Array(v);
    const inputLimit = Math.sqrt(6 / (v + hSize)); const outputLimit = Math.sqrt(6 / (hSize + v));
    for (let i = 0; i < inputWeights.length; i++) inputWeights[i] = (random() * 2 - 1) * inputLimit;
    for (let i = 0; i < outputWeights.length; i++) outputWeights[i] = (random() * 2 - 1) * outputLimit;
    const split = createEvaluationSplits(chars, index);
    const sampleCount = split.train.length;
    const model = {
      id: randomUUID(), name: safeName(modelName), datasetId, datasetName: dataset.name, datasetSha256, datasetProvenance,
      createdAt: new Date().toISOString(), trainedCharacters: chars.length, vocabulary, vocabularySize: v, hiddenSize: hSize,
      architecture: "one-hot character → tanh hidden layer → softmax character", initialization: "Xavier uniform random initialization",
      seed, epochs: 0, learningRate: LEARNING_RATE, trainingLoss: 0, kind: "mmd-char-mlp-v1",
      inputWeights: Array.from(inputWeights), outputWeights: Array.from(outputWeights), hiddenBias: Array.from(hiddenBias), outputBias: Array.from(outputBias),
      evaluationPlan: { schemaVersion: 1, method: split.method, trainSamples: split.train.length, validationSamples: split.validation.length, testSamples: split.test.length },
      evaluation: null,
      trainingState: { schemaVersion: 2, status: "paused", targetEpochs: trainingOptions.epochs, completedEpochs: 0, sampleCursor: 0, sampleCount, completedSteps: 0, totalSteps: sampleCount * trainingOptions.epochs, lossSum: 0, epochLosses: [], updatedAt: new Date().toISOString() }
    };
    await this.atomicWrite(path.join(this.modelsPath, model.id + ".json"), JSON.stringify(model));
    return this.runTraining(model, dataset, trainingOptions.maxSteps);
  }
  async resume(modelId, options = {}) {
    if (typeof modelId !== "string" || !idPattern.test(modelId)) throw new Error("Invalid model identifier.");
    const { maxSteps } = this.normalizeTrainingOptions(options, false);
    const modelPath = path.join(this.modelsPath, modelId + ".json");
    const model = JSON.parse(await fs.readFile(modelPath, "utf8"));
    const state = model.trainingState;
    if (model.kind !== "mmd-char-mlp-v1" || !state || ![1, 2].includes(state.schemaVersion)) throw new Error("This checkpoint does not contain resumable training state.");
    if (state.status !== "paused") throw new Error("This model has no remaining training steps.");
    if (typeof model.datasetId !== "string" || !idPattern.test(model.datasetId)) throw new Error("Checkpoint dataset identifier is invalid.");
    const dataset = JSON.parse(await fs.readFile(path.join(this.datasetsPath, model.datasetId + ".json"), "utf8"));
    if (!dataset || typeof dataset.text !== "string") throw new Error("The original training dataset is unavailable.");
    const actualHash = createHash("sha256").update(dataset.text, "utf8").digest("hex");
    if (actualHash !== model.datasetSha256 || (dataset.provenance?.schemaVersion >= 1 && dataset.provenance.contentSha256 !== actualHash)) throw new Error("The original training dataset no longer matches this checkpoint.");
    return this.runTraining(model, dataset, maxSteps);
  }
  async runTraining(model, dataset, maxSteps) {
    const chars = [...dataset.text].slice(0, MAX_TRAINING_CHARS);
    const vocabulary = [...new Set(chars)];
    const state = model.trainingState;
    if (JSON.stringify(vocabulary) !== JSON.stringify(model.vocabulary) || ![1, 2].includes(state.schemaVersion)) throw new Error("The training dataset no longer matches the checkpoint vocabulary or schema.");
    const v = model.vocabulary.length; const hSize = model.hiddenSize;
    if (hSize !== HIDDEN_SIZE || model.inputWeights.length !== v * hSize || model.outputWeights.length !== hSize * v || model.hiddenBias.length !== hSize || model.outputBias.length !== v) throw new Error("Checkpoint tensor dimensions are invalid.");
    const index = new Map(model.vocabulary.map((char, i) => [char, i]));
    const split = createEvaluationSplits(chars, index);
    const allSamples = Array.from({ length: chars.length - 1 }, (_, i) => [index.get(chars[i]), index.get(chars[i + 1])]);
    const legacyTraining = state.schemaVersion === 1;
    const samples = legacyTraining ? allSamples : split.train;
    if (state.sampleCount !== samples.length) throw new Error("The training dataset no longer matches the checkpoint sample count.");
    if (!legacyTraining && (!model.evaluationPlan || model.evaluationPlan.method !== split.method || model.evaluationPlan.trainSamples !== split.train.length || model.evaluationPlan.validationSamples !== split.validation.length || model.evaluationPlan.testSamples !== split.test.length)) throw new Error("Checkpoint evaluation split metadata is invalid.");
    if (!Number.isInteger(state.targetEpochs) || state.targetEpochs < 1 || state.targetEpochs > MAX_TRAINING_EPOCHS || !Number.isInteger(state.completedEpochs) || state.completedEpochs < 0 || state.completedEpochs >= state.targetEpochs || !Number.isInteger(state.sampleCursor) || state.sampleCursor < 0 || state.sampleCursor >= state.sampleCount || state.completedSteps !== state.completedEpochs * state.sampleCount + state.sampleCursor) throw new Error("Checkpoint training progress is invalid.");
    let epoch = state.completedEpochs;
    let order = shuffledIndices(samples.length, (model.seed ^ Math.imul(epoch + 1, 0x9e3779b1)) >>> 0);
    let stepsThisCall = 0;
    while (stepsThisCall < maxSteps && state.completedEpochs < state.targetEpochs) {
      if (epoch !== state.completedEpochs) {
        epoch = state.completedEpochs;
        order = shuffledIndices(samples.length, (model.seed ^ Math.imul(epoch + 1, 0x9e3779b1)) >>> 0);
      }
      const [input, target] = samples[order[state.sampleCursor]];
      const hidden = new Float64Array(hSize);
      for (let h = 0; h < hSize; h++) hidden[h] = Math.tanh(model.hiddenBias[h] + model.inputWeights[input * hSize + h]);
      const logits = new Float64Array(v); let max = -Infinity;
      for (let k = 0; k < v; k++) { let z = model.outputBias[k]; for (let h = 0; h < hSize; h++) z += hidden[h] * model.outputWeights[h * v + k]; logits[k] = z; if (z > max) max = z; }
      const probabilities = new Float64Array(v); let sum = 0;
      for (let k = 0; k < v; k++) { probabilities[k] = Math.exp(logits[k] - max); sum += probabilities[k]; }
      for (let k = 0; k < v; k++) probabilities[k] /= sum;
      state.lossSum -= Math.log(Math.max(probabilities[target], 1e-12));
      const hiddenGradient = new Float64Array(hSize);
      for (let h = 0; h < hSize; h++) for (let k = 0; k < v; k++) hiddenGradient[h] += model.outputWeights[h * v + k] * (probabilities[k] - (k === target ? 1 : 0));
      for (let k = 0; k < v; k++) { const grad = probabilities[k] - (k === target ? 1 : 0); model.outputBias[k] -= LEARNING_RATE * grad; for (let h = 0; h < hSize; h++) model.outputWeights[h * v + k] -= LEARNING_RATE * grad * hidden[h]; }
      for (let h = 0; h < hSize; h++) { const grad = hiddenGradient[h] * (1 - hidden[h] * hidden[h]); model.inputWeights[input * hSize + h] -= LEARNING_RATE * grad; model.hiddenBias[h] -= LEARNING_RATE * grad; }
      state.sampleCursor++; state.completedSteps++; stepsThisCall++;
      if (state.sampleCursor === state.sampleCount) {
        const epochLoss = state.lossSum / state.sampleCount;
        state.epochLosses.push(epochLoss); state.completedEpochs++; state.sampleCursor = 0; state.lossSum = 0;
        model.epochs = state.completedEpochs; model.trainingLoss = epochLoss;
      }
      if (stepsThisCall % 128 === 0) {
        state.status = state.completedEpochs >= state.targetEpochs ? "completed" : "paused";
        state.updatedAt = new Date().toISOString();
        await this.atomicWrite(path.join(this.modelsPath, model.id + ".json"), JSON.stringify(model));
      }
      if (stepsThisCall % 64 === 0) await new Promise(resolve => setImmediate(resolve));
    }
    state.status = state.completedEpochs >= state.targetEpochs ? "completed" : "paused";
    model.epochs = state.completedEpochs;
    model.trainingLoss = state.epochLosses.length ? state.epochLosses[state.epochLosses.length - 1] : state.lossSum / Math.max(1, state.sampleCursor);
    if (state.status === "completed") {
      if (legacyTraining) {
        model.evaluation = { schemaVersion: 1, status: "not-evaluated", splitMethod: "none", reason: "Legacy checkpoint training included the full corpus, so a leakage-free holdout score cannot be reconstructed." };
      } else {
        model.evaluation = {
          schemaVersion: 1,
          status: "completed",
          splitMethod: split.method,
          train: evaluateSamples(model, split.train),
          validation: evaluateSamples(model, split.validation),
          test: evaluateSamples(model, split.test),
          evaluatedAt: new Date().toISOString()
        };
      }
    }
    state.updatedAt = new Date().toISOString();
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
  publicModel(m) {
    const state = m.trainingState || null;
    return { id: m.id, name: m.name, datasetName: m.datasetName, datasetSha256: m.datasetSha256 || "", datasetLicense: m.datasetProvenance?.license || "not-declared", datasetSourceReference: m.datasetProvenance?.sourceReference || "", createdAt: m.createdAt, trainedCharacters: m.trainedCharacters, vocabularySize: m.vocabularySize, hiddenSize: m.hiddenSize, architecture: m.architecture, initialization: m.initialization, seed: m.seed, epochs: m.epochs, learningRate: m.learningRate, trainingLoss: m.trainingLoss, kind: m.kind, trainingStatus: state?.status || "completed", completedSteps: state?.completedSteps ?? Math.max(0, (m.trainedCharacters || 1) - 1), totalSteps: state?.totalSteps ?? Math.max(0, (m.trainedCharacters || 1) - 1), targetEpochs: state?.targetEpochs ?? (m.epochs || 1), completedEpochs: state?.completedEpochs ?? (m.epochs || 1), sampleCursor: state?.sampleCursor ?? 0, evaluation: m.evaluation || null };
  }
  async atomicWrite(target, content) { const temp = target + ".tmp-" + randomUUID(); await fs.writeFile(temp, content, "utf8"); await fs.rename(temp, target); }
}
module.exports = { AiCore, seededRandom, forward, sample, evaluateSamples, createEvaluationSplits, safeName, MAX_DATASET_BYTES, MAX_TRAINING_CHARS, MAX_VOCABULARY, HIDDEN_SIZE, DEFAULT_TRAINING_CHUNK_STEPS, MAX_TRAINING_CHUNK_STEPS, MAX_TRAINING_EPOCHS };
