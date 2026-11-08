import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud" / "runtime"))
from validate import validate_config, validate_provenance, validate_job

class CloudRuntimeValidationTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / "cloud/configs/mmd-multilingual-pilot.json").read_text(encoding="utf-8"))
        self.provenance = {
            "source": "user-provided-corpus", "revision": "dataset-rev-1",
            "license": "CC-BY-4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "collected_at": "2026-11-08", "languages": ["fa", "en"],
            "preprocessing": "UTF-8, NFC, deduplicated",
            "splits": {"train": "90%", "validation": "5%", "test": "5%"}
        }

    def test_base_1b_config_is_bilingual_and_cuda_only(self):
        base = json.loads((ROOT / "cloud/configs/mmd-base-1b-bilingual.json").read_text(encoding="utf-8"))
        validate_config(base)
        self.assertEqual(set(base["tokenizer"]["languages"]), {"fa", "en"})
        bad = json.loads(json.dumps(base))
        bad["tokenizer"]["languages"].append("de")
        with self.assertRaisesRegex(ValueError, "only Persian"):
            validate_config(bad)

    def test_pilot_config_is_random_init_and_paid_fallback_disabled(self):
        validate_config(self.config)
        bad = json.loads(json.dumps(self.config))
        bad["initialization"]["weights"] = "pretrained"
        with self.assertRaisesRegex(ValueError, "random weights"):
            validate_config(bad)

    def test_invalid_attention_dimensions_are_rejected(self):
        bad = json.loads(json.dumps(self.config))
        bad["architecture"]["hidden_size"] = 383
        with self.assertRaisesRegex(ValueError, "divisible"):
            validate_config(bad)

    def test_incomplete_provenance_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "provenance is incomplete"):
            validate_provenance({"source": "dataset"})

    def test_dataset_and_job_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            dataset = Path(tmp) / "corpus.txt"
            provenance = Path(tmp) / "provenance.json"
            config = Path(tmp) / "config.json"
            dataset.write_text("multilingual training corpus " * 100, encoding="utf-8")
            provenance.write_text(json.dumps(self.provenance), encoding="utf-8")
            config.write_text(json.dumps(self.config), encoding="utf-8")
            result = validate_job(config, dataset, provenance)
            self.assertGreater(result["dataset_characters"], 1000)
            self.assertEqual(result["dataset_revision"], "dataset-rev-1")

if __name__ == "__main__":
    unittest.main()
