import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud" / "runtime"))
from dataset_review import review

class DatasetSourceReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.allowlist = self.root / "allowlist.json"
        self.allowlist.write_text(json.dumps({"allowed_license_ids": ["CC-BY-4.0", "CC0-1.0"]}), encoding="utf-8")
        self.record = {
            "document_id": "doc-001", "source_url": "https://example.org/item/1",
            "source_revision": "rev-1", "language": "fa", "license_id": "CC-BY-4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "Example Author", "text_sha256": "a" * 64,
            "rights_basis": "Publisher license plus document-level review",
            "collection_method": "Manual export", "public_redistribution": True,
            "source_rights_verified": True
        }

    def tearDown(self): self.tmp.cleanup()

    def run_review(self, records, targets=None):
        source = self.root / "manifest.jsonl"
        output = self.root / "report.json"
        source.write_text("\n".join(json.dumps(x) for x in records) + "\n", encoding="utf-8")
        return review(source, output, self.allowlist, targets or ["fa", "en"])

    def test_complete_metadata_is_candidate_only_not_approved(self):
        result = self.run_review([self.record])
        self.assertTrue(result["candidate_manifest_complete"])
        self.assertEqual(result["review_status"], "needs_human_rights_approval")
        self.assertEqual(result["valid_records"], 1)
        self.assertIn("does not grant rights", result["important_notice"])

    def test_unapproved_license_and_unverified_rights_are_rejected(self):
        item = dict(self.record, license_id="UNKNOWN", source_rights_verified=False)
        result = self.run_review([item])
        self.assertFalse(result["candidate_manifest_complete"])
        self.assertTrue(any("allowlist" in issue for issue in result["records"][0]["issues"]))
        self.assertTrue(any("rights" in issue for issue in result["records"][0]["issues"]))

    def test_missing_hash_bad_url_and_non_target_language_are_rejected(self):
        item = dict(self.record, text_sha256="not-a-hash", source_url="http://example.org", language="xx")
        result = self.run_review([item])
        issues = " ".join(result["records"][0]["issues"])
        self.assertIn("SHA-256", issues)
        self.assertIn("HTTPS", issues)
        self.assertIn("outside", issues)

    def test_duplicate_document_ids_are_rejected(self):
        result = self.run_review([self.record, self.record])
        self.assertFalse(result["candidate_manifest_complete"])
        self.assertTrue(any("Duplicate document_id" in issue for issue in result["records"][1]["issues"]))

    def test_empty_allowlist_rejects_all_licenses(self):
        self.allowlist.write_text(json.dumps({"allowed_license_ids": []}), encoding="utf-8")
        result = self.run_review([self.record])
        self.assertFalse(result["candidate_manifest_complete"])

if __name__ == "__main__": unittest.main()
