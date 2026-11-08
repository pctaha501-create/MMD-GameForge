const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { AiCore, weightedPick, safeName, CONTEXT } = require("../electron/ai-core.cjs");

test("AI research baseline imports, trains, persists, and generates locally", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mmd-ai-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corpus = path.join(dir, "sample.txt");
  await fs.writeFile(corpus, ("the quick brown fox jumps over the lazy dog. ").repeat(20), "utf8");
  const core = new AiCore(path.join(dir, "runtime"));
  await core.initialize();
  const dataset = await core.importDataset(corpus);
  assert.ok(dataset.characters > 40);
  assert.equal((await core.listDatasets()).length, 1);
  const model = await core.train(dataset.id, "Test model");
  assert.equal(model.kind, "character-trigram");
  assert.equal(model.contextLength, CONTEXT);
  assert.ok(model.vocabularySize > 5);
  assert.equal((await core.listModels()).length, 1);
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
  assert.equal(weightedPick({ only: 3 }, () => 0.5), "only");
  assert.equal(weightedPick({}), undefined);
});
