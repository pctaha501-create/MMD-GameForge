import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud" / "runtime"))

from model_factory import create_config, estimate_parameters
from validate import validate_config, validate_job


class BilingualBaseTests(unittest.TestCase):
    def test_base_profile_is_exactly_one_billion_class_and_bilingual(self):
        config = create_config("bilingual-base-1b", 20261108)
        validate_config(config)
        estimate = estimate_parameters(config)
        self.assertEqual(config["model_family"], "MMD-Base-1B-Bilingual")
        self.assertEqual(config["tokenizer"]["languages"], ["fa", "en"])
        self.assertEqual(estimate["total_parameters"], 1_022_871_552)
        self.assertTrue(config["resource_policy"]["require_cuda"])
        self.assertGreaterEqual(config["resource_policy"]["minimum_gpu_memory_gib"], 14)

    def test_job_requires_both_supported_languages_and_rejects_others(self):
        config = create_config("bilingual-base-1b", 20261108)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config_path = root / "config.json"
            dataset_path = root / "corpus.txt"
            provenance_path = root / "provenance.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            dataset_path.write_text(("English sample text. متن نمونه فارسی. " * 100), encoding="utf-8")
            provenance = {
                "source": "user-supplied licensed corpus",
                "revision": "test-revision-1",
                "license": "CC0-1.0",
                "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                "collected_at": "2026-11-08",
                "languages": ["fa", "en"],
                "preprocessing": "UTF-8; Unicode NFC; document deduplication",
                "splits": {"train": "train", "validation": "validation", "test": "test"},
            }
            provenance_path.write_text(json.dumps(provenance), encoding="utf-8")
            result = validate_job(config_path, dataset_path, provenance_path)
            self.assertEqual(set(result["config"]["tokenizer"]["languages"]), {"fa", "en"})

            provenance["languages"] = ["fa", "en", "de"]
            provenance_path.write_text(json.dumps(provenance), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "outside the model's configured language set"):
                validate_job(config_path, dataset_path, provenance_path)

            provenance["languages"] = ["en"]
            provenance_path.write_text(json.dumps(provenance), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must include both Persian"):
                validate_job(config_path, dataset_path, provenance_path)


if __name__ == "__main__":
    unittest.main()
