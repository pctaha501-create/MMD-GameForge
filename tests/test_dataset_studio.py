import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud" / "runtime"))
from dataset_studio import canonical_text, load_documents, split_documents, prepare

class DatasetStudioTests(unittest.TestCase):
    def make_docs(self, count=40):
        return [{"text": f"Document {i} " + ("multilingual training content " * 20), "language": "en" if i % 2 else "fa"} for i in range(count)]

    def test_unicode_and_whitespace_normalization(self):
        self.assertEqual(canonical_text("  cafe\u0301  \r\n  text  "), "café\ntext")

    def test_exact_duplicates_removed_and_language_counted_separately(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.jsonl"
            source.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in [
                {"text": "same document", "language": "en"},
                {"text": " same   document ", "language": "en"},
                {"text": "same document", "language": "fa"},
            ]), encoding="utf-8")
            docs, stats = load_documents(source)
            self.assertEqual(len(docs), 2)
            self.assertEqual(stats["duplicates_removed"], 1)

    def test_splits_are_disjoint_and_reproducible(self):
        docs = self.make_docs()
        first = split_documents(docs, 99)
        second = split_documents(docs, 99)
        self.assertEqual([[x["text"] for x in first[k]] for k in first], [[x["text"] for x in second[k]] for k in second])
        sets = [{x["text"] for x in first[k]} for k in first]
        self.assertFalse(sets[0] & sets[1])
        self.assertFalse(sets[0] & sets[2])
        self.assertFalse(sets[1] & sets[2])
        self.assertEqual(sum(map(len, sets)), len(docs))

    def test_prepare_writes_corpus_provenance_and_language_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "input.jsonl"
            source.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in self.make_docs()), encoding="utf-8")
            args = type("Args", (), {
                "input": str(source), "output": str(root / "out"), "source": "test-corpus",
                "revision": "r1", "license": "CC-BY-4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
                "collected_at": "2026-11-08", "preprocessing": "NFC", "seed": 123,
            })()
            report = prepare(args)
            out = root / "out"
            self.assertTrue((out / "corpus.txt").exists())
            provenance = json.loads((out / "provenance.json").read_text(encoding="utf-8"))
            self.assertEqual(set(provenance["splits"]), {"train", "validation", "test"})
            details = provenance["dataset_studio"]["split_details"]
            corpus = (out / "corpus.txt").read_text(encoding="utf-8")
            for name in ("train", "validation", "test"):
                start, end = details[name]["corpus_start"], details[name]["corpus_end"]
                self.assertGreater(end, start)
                self.assertLessEqual(end, len(corpus))
            self.assertLessEqual(details["train"]["corpus_end"], details["validation"]["corpus_start"])
            self.assertLessEqual(details["validation"]["corpus_end"], details["test"]["corpus_start"])
            self.assertEqual(provenance["dataset_studio"]["unique_documents"], 40)
            self.assertIn("fa", report["language_counts"])
            self.assertTrue((out / "report.json").exists())

    def test_language_stratification_keeps_both_languages_in_all_splits(self):
        docs = self.make_docs(60)
        splits = split_documents(docs, 2026)
        for split in splits.values():
            self.assertEqual({item["language"] for item in split}, {"fa", "en"})

    def test_too_few_unique_documents_fail(self):
        with self.assertRaisesRegex(ValueError, "three unique"):
            split_documents(self.make_docs(2), 1)

if __name__ == "__main__":
    unittest.main()
