const test = require("node:test");
const assert = require("node:assert/strict");
const { validateProjectName } = require("../src/shared/project-name.cjs");

test("trims surrounding whitespace", () => {
  assert.equal(validateProjectName("  Neon Horizon  "), "Neon Horizon");
});

test("accepts common readable project names", () => {
  assert.equal(validateProjectName("MMD AAA Open World"), "MMD AAA Open World");
  assert.equal(validateProjectName("Project_2049-v2"), "Project_2049-v2");
});

test("rejects missing, non-string, and empty names", () => {
  for (const value of [undefined, null, 42, "", "   "]) {
    assert.throws(() => validateProjectName(value), /project name/i);
  }
});

test("rejects names longer than 64 characters", () => {
  assert.throws(() => validateProjectName("x".repeat(65)), /1–64 characters/);
});

test("rejects filesystem-reserved characters and control characters", () => {
  for (const value of ["bad/name", "bad\\name", "bad:name", "bad*name", "bad?name", "bad|name", "bad<name", "bad\u0001name"]) {
    assert.throws(() => validateProjectName(value), /filesystem-reserved/);
  }
});

test("rejects dot path segments", () => {
  assert.throws(() => validateProjectName("."), /filesystem-reserved/);
  assert.throws(() => validateProjectName(".."), /filesystem-reserved/);
});
