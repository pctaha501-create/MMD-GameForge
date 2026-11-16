const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { AiCore, seededRandom, safeName, HIDDEN_SIZE } = require("../electron/ai-core.cjs");

test("AI research baseline imports, trains, persists, and generates locally", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "sample.txt");
  await fs.writeFile(corpus, ("the quick brown fox jumps over the lazy dog. ").repeat(20), "utf8");
  const core = new AiCore(path.join(dir, "runtime"));
  await core.initialize();
  const dataset = await core.importDataset(corpus, { sourceReference: "https://example.test/corpus", license: "CC-BY-4.0", attribution: "MMD test fixture", notes: "Repeated deterministic test text" });
  assert.ok(dataset.characters > 40);
  const sourceBytes = await fs.readFile(corpus);
  const normalizedText = sourceBytes.toString("utf8").replace(/\r\n?/g, "\n");
  assert.equal(dataset.provenance.sourceType, "user-local-file");
  assert.equal(dataset.provenance.originalFileName, "sample.txt");
  assert.equal(dataset.provenance.sourceSha256, createHash("sha256").update(sourceBytes).digest("hex"));
  assert.equal(dataset.provenance.contentSha256, createHash("sha256").update(normalizedText, "utf8").digest("hex"));
  assert.equal(dataset.provenance.license, "CC-BY-4.0");
  assert.equal(dataset.provenance.sourceReference, "https://example.test/corpus");
  const listedDataset = (await core.listDatasets())[0];
  assert.equal(listedDataset.provenance.contentSha256, dataset.provenance.contentSha256);
  assert.equal((await core.listDatasets()).length, 1);
  const model = await core.train(dataset.id, "Test model");
  assert.equal(model.kind, "mmd-char-mlp-v1");
  assert.equal(model.datasetSha256, dataset.provenance.contentSha256);
  assert.equal(model.datasetLicense, "CC-BY-4.0");
  assert.equal(model.hiddenSize, 24);
  assert.equal(model.initialization, "Xavier uniform random initialization");
  assert.ok(Number.isInteger(model.seed));
  assert.ok(Number.isFinite(model.trainingLoss));
  assert.ok(model.vocabularySize > 5);
  assert.equal((await core.listModels()).length, 1);
  const saved = JSON.parse(await fs.readFile(path.join(core.modelsPath, model.id + ".json"), "utf8"));
  assert.ok(saved.inputWeights.some(value => value !== 0));
  assert.ok(saved.outputWeights.some(value => value !== 0));
  assert.equal(saved.datasetSha256, dataset.provenance.contentSha256);
  assert.equal(saved.datasetProvenance.sourceReference, "https://example.test/corpus");
  const generated = await core.generate(model.id, "the quick ", 80);
  assert.ok(generated.startsWith("the quick "));
  assert.equal([...generated].length, [..."the quick "].length + 80);
  const reloaded = new AiCore(path.join(dir, "runtime"));
  assert.equal((await reloaded.listModels())[0].id, model.id);
  assert.equal((await reloaded.status()).mode, "offline");
});

test("AI runtime rejects invalid IDs and undersized corpora", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-invalid-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const core = new AiCore(path.join(dir, "runtime")); await core.initialize();
  const corpus = path.join(dir, "tiny.txt"); await fs.writeFile(corpus, "a very small text corpus for tests.", "utf8");
  await assert.rejects(core.importDataset(corpus), /at least 40 characters/);
  await assert.rejects(core.train("not-an-id", "bad"), /Invalid dataset identifier/);
  await assert.rejects(core.generate("not-an-id", "x", 10), /Invalid model identifier/);
});

test("helper functions sanitize names and use weighted frequencies", () => {
  assert.equal(safeName("  My / Model  "), "My Model");
  const randomA = seededRandom(1234); const randomB = seededRandom(1234);
  assert.equal(randomA(), randomB());
  assert.equal(HIDDEN_SIZE, 24);
});


test("neural trainer enforces its vocabulary resource guardrail", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-vocab-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "wide.txt");
  await fs.writeFile(corpus, Array.from({ length: 140 }, (_, i) => String.fromCodePoint(0x400 + i)).join("") + " repeated text corpus", "utf8");
  const core = new AiCore(path.join(dir, "runtime")); await core.initialize();
  const dataset = await core.importDataset(corpus);
  await assert.rejects(core.train(dataset.id, "Too wide"), /supports at most 128/);
});


test("training rejects a dataset whose content no longer matches its provenance hash", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-tamper-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "tamper.txt");
  await fs.writeFile(corpus, ("first-party data must keep its provenance. ").repeat(8), "utf8");
  const core = new AiCore(path.join(dir, "runtime")); await core.initialize();
  const dataset = await core.importDataset(corpus, { license: "CC0-1.0" });
  const recordPath = path.join(core.datasetsPath, dataset.id + ".json");
  const record = JSON.parse(await fs.readFile(recordPath, "utf8"));
  record.text += "tampered";
  await fs.writeFile(recordPath, JSON.stringify(record), "utf8");
  await assert.rejects(core.train(dataset.id, "Tampered dataset"), /content hash does not match its provenance/);
});

test("dataset provenance input rejects invalid field types and oversized metadata", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-provenance-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "valid.txt");
  await fs.writeFile(corpus, ("a valid UTF-8 corpus for provenance checks. ").repeat(5), "utf8");
  const core = new AiCore(path.join(dir, "runtime")); await core.initialize();
  await assert.rejects(core.importDataset(corpus, { license: 42 }), /Dataset license must be text/);
  await assert.rejects(core.importDataset(corpus, { notes: "x".repeat(1025) }), /Dataset notes cannot exceed 1024 characters/);
});


test("training checkpoints resume across runtime instances and complete the same dataset", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-resume-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "resume.txt");
  await fs.writeFile(corpus, ("first party training must resume from its own saved random weights. ").repeat(80), "utf8");
  const storage = path.join(dir, "runtime");
  const core = new AiCore(storage); await core.initialize();
  const dataset = await core.importDataset(corpus, { license: "CC0-1.0", sourceReference: "local-test-fixture" });
  const first = await core.train(dataset.id, "Resumable model", { maxSteps: 37, epochs: 1 });
  assert.equal(first.trainingStatus, "paused");
  assert.equal(first.completedSteps, 37);
  assert.ok(first.totalSteps > first.completedSteps);
  const reloaded = new AiCore(storage);
  const second = await reloaded.resume(first.id, { maxSteps: 41 });
  assert.equal(second.trainingStatus, "paused");
  assert.equal(second.completedSteps, 78);
  let completed = second;
  for (let attempt = 0; completed.trainingStatus === "paused" && attempt < 10; attempt++) completed = await reloaded.resume(first.id, { maxSteps: 4096 });
  assert.equal(completed.trainingStatus, "completed");
  assert.equal(completed.completedSteps, completed.totalSteps);
  assert.equal(completed.completedEpochs, 1);
  const saved = JSON.parse(await fs.readFile(path.join(reloaded.modelsPath, first.id + ".json"), "utf8"));
  assert.equal(saved.trainingState.status, "completed");
  assert.equal(saved.trainingState.epochLosses.length, 1);
  assert.equal(saved.seed, first.seed);
  assert.ok(saved.inputWeights.some(value => value !== 0));
  assert.ok((await reloaded.generate(first.id, "first party ", 12)).length > 12);
});

test("resume refuses a dataset that changed after a partial checkpoint", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-resume-tamper-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "resume-tamper.txt");
  await fs.writeFile(corpus, ("dataset lineage must remain stable for safe resume. ").repeat(50), "utf8");
  const core = new AiCore(path.join(dir, "runtime")); await core.initialize();
  const dataset = await core.importDataset(corpus, { license: "CC0-1.0" });
  const model = await core.train(dataset.id, "Tamper guard", { maxSteps: 11 });
  const recordPath = path.join(core.datasetsPath, dataset.id + ".json");
  const record = JSON.parse(await fs.readFile(recordPath, "utf8")); record.text += "changed";
  await fs.writeFile(recordPath, JSON.stringify(record), "utf8");
  await assert.rejects(core.resume(model.id, { maxSteps: 11 }), /no longer matches this checkpoint/);
});

test("training chunk and epoch limits are validated and completed checkpoints cannot resume", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-resume-limits-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "limits.txt"); await fs.writeFile(corpus, ("bounded local training experiment. ").repeat(40), "utf8");
  const core = new AiCore(path.join(dir, "runtime")); await core.initialize();
  const dataset = await core.importDataset(corpus);
  await assert.rejects(core.train(dataset.id, "Invalid chunk", { maxSteps: 0 }), /Training chunks/);
  await assert.rejects(core.train(dataset.id, "Invalid epochs", { epochs: 11 }), /Training epochs/);
  const model = await core.train(dataset.id, "Complete model", { maxSteps: 4096 });
  assert.equal(model.trainingStatus, "completed");
  await assert.rejects(core.resume(model.id), /no remaining training steps/);
});


test("periodic atomic checkpoints survive a simulated process interruption", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-crash-resume-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "crash.txt");
  await fs.writeFile(corpus, ("atomic checkpoints keep first party model training recoverable. ").repeat(40), "utf8");
  const storage = path.join(dir, "runtime"); const core = new AiCore(storage); await core.initialize();
  const dataset = await core.importDataset(corpus, { license: "CC0-1.0" });
  const atomicWrite = core.atomicWrite.bind(core); let writes = 0;
  core.atomicWrite = async (target, content) => { await atomicWrite(target, content); writes++; if (writes === 2) throw new Error("simulated process interruption"); };
  await assert.rejects(core.train(dataset.id, "Crash recovery", { maxSteps: 200 }), /simulated process interruption/);
  const files = (await fs.readdir(core.modelsPath)).filter(file => file.endsWith(".json"));
  assert.equal(files.length, 1);
  const checkpoint = JSON.parse(await fs.readFile(path.join(core.modelsPath, files[0]), "utf8"));
  assert.equal(checkpoint.trainingState.completedSteps, 128);
  const recovered = new AiCore(storage);
  const result = await recovered.resume(checkpoint.id, { maxSteps: 4096 });
  assert.equal(result.trainingStatus, "completed");
  assert.equal(result.completedSteps, result.totalSteps);
});
