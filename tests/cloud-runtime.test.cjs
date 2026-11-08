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
    assert.match(source, /manually|manual/i);
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

for (const name of ["kaggle-instruction-sft.ipynb", "colab-instruction-sft.ipynb"]) {
  test(name + " starts a from-scratch instruction training session", () => {
    const notebook = JSON.parse(fs.readFileSync(path.join(root, "cloud/notebooks", name), "utf8"));
    assert.equal(notebook.nbformat, 4);
    const source = notebook.cells.flatMap(cell => cell.source || []).join("");
    assert.match(source, /train_instructions\.py/);
    assert.match(source, /model_factory\.py/);
    assert.match(source, /provenance\.json/);
    assert.match(source, /random weights|random initialization/i);
  });
}

for (const name of ["kaggle-multilingual.ipynb", "colab-multilingual.ipynb"]) {
  test(name + " resumes incomplete checkpoints and creates only verified completed bundles", () => {
    const notebook = JSON.parse(fs.readFileSync(path.join(root, "cloud/notebooks", name), "utf8"));
    const source = notebook.cells.flatMap(cell => cell.source || []).join("");
    assert.match(source, /training_complete/);
    assert.match(source, /mmd-cloud-resume/);
    assert.match(source, /evaluate\.py/);
    assert.match(source, /bundle\.py/);
    assert.match(source, /24 GiB/);
  });
}
