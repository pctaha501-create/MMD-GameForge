const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("MCT release acceptance gate exposes human review inputs and no auto promotion", () => {
  const script = path.join(__dirname, "../cloud/runtime/release_gate.py");
  const result = spawnSync("python", [script, "--help"], { encoding: "utf8" });
  if (result.error && result.error.code === "ENOENT") return;
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--human-review/);
  assert.match(result.stdout, /never auto-promotes/);
});
