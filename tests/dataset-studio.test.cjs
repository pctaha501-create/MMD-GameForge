const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("Dataset Studio and trainer hardening are present", () => {
  const studio = fs.readFileSync(path.join(root, "cloud/runtime/dataset_studio.py"), "utf8");
  const trainer = fs.readFileSync(path.join(root, "cloud/runtime/train.py"), "utf8");
  assert.match(studio, /split_documents/);
  assert.match(studio, /duplicates_removed/);
  assert.match(studio, /language_counts/);
  assert.match(trainer, /at least .* are required/);
  assert.match(trainer, /tokenizer_sha256/);
});
