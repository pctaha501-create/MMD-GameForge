const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
for (const name of ["kaggle-multilingual.ipynb", "colab-multilingual.ipynb"]) {
  test(name + " is a valid, user-started notebook wired to the shared trainer", () => {
    const notebook = JSON.parse(fs.readFileSync(path.join(root, "cloud/notebooks", name), "utf8"));
    assert.equal(notebook.nbformat, 4);
    const source = notebook.cells.flatMap(cell => cell.source || []).join("");
    assert.match(source, /feat\/mmd-cloud-training-mct-02/);
    assert.match(source, /cloud\/runtime\/train.py/);
    assert.match(source, /provenance\.json/);
    assert.doesNotMatch(source, /pretrained|fine.?tuned/i);
  });
}

test("MCT-02 trainer and dependency-free validator are present", () => {
  const trainer = fs.readFileSync(path.join(root, "cloud/runtime/train.py"), "utf8");
  const validator = fs.readFileSync(path.join(root, "cloud/runtime/validate.py"), "utf8");
  assert.match(trainer, /random weights/);
  assert.match(trainer, /checkpoint-manifest\.json/);
  assert.match(trainer, /optimizer/);
  assert.match(trainer, /dataset_revision/);
  assert.match(validator, /validate_provenance/);
  assert.match(validator, /paid_fallback/);
});
