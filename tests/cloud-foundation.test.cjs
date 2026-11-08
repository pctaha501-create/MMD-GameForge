const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

test("MCT training job contract is versioned and rejects implicit paid fallback", () => {
  const schema = readJson("cloud/contracts/training-job.schema.json");
  assert.equal(schema.properties.schema_version.const, "mct.training-job.v1");
  assert.deepEqual(schema.properties.provider_policy.properties.allow_paid_fallback, { const: false });
  assert.deepEqual(schema.properties.provider_policy.properties.user_started, { const: true });
  assert.equal(schema.properties.model.properties.initialization.const, "random");
});

test("MCT checkpoint contract records random initialization and artifact hashes", () => {
  const schema = readJson("cloud/contracts/checkpoint.schema.json");
  assert.equal(schema.properties.schema_version.const, "mct.checkpoint.v1");
  assert.equal(schema.properties.initialization.properties.weights_origin.const, "random_initialization");
  assert.match(schema.properties.lineage.properties.config_sha256.pattern, /64/);
  assert.ok(schema.required.includes("lineage"));
  assert.ok(schema.required.includes("evaluation"));
});

test("multilingual pilot config starts from random weights and has bounded pilot resources", () => {
  const config = readJson("cloud/configs/mmd-multilingual-pilot.json");
  assert.equal(config.model_family, "MMD-Multilingual-Base");
  assert.equal(config.initialization.weights, "random");
  assert.equal(config.tokenizer.training_from_scratch, true);
  assert.ok(config.tokenizer.languages.includes("fa"));
  assert.ok(config.tokenizer.languages.includes("en"));
  assert.ok(config.architecture.hidden_size > 0);
  assert.ok(config.architecture.num_layers > 0);
  assert.equal(config.resource_policy.paid_fallback, false);
  assert.equal(config.resource_policy.user_started_sessions_only, true);
});

test("cloud security policy and provider policy exist", () => {
  const provider = fs.readFileSync(path.join(root, "cloud/providers/README.md"), "utf8");
  const security = fs.readFileSync(path.join(root, "cloud/security/README.md"), "utf8");
  assert.match(provider, /Do not turn a free Colab runtime into an unattended service/);
  assert.match(security, /Never commit/);
  assert.match(security, /license/);
});
