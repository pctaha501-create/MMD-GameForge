const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("dataset source review CLI is dependency-free and documents human approval gate", () => {
  const script = path.join(__dirname, "../cloud/runtime/dataset_review.py");
  const result = spawnSync("python", [script, "--help"], { encoding: "utf8" });
  if (result.error && result.error.code === "ENOENT") return;
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--allowlist/);
  assert.match(result.stdout, /never downloads or ingests/);
});
