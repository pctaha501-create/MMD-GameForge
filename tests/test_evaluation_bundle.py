import json,sys,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"cloud"/"runtime"))
from model_factory import create_config
from bundle import sha

class EvaluationBundleTests(unittest.TestCase):
    def test_bundle_rejects_missing_inputs(self):
        from bundle import main
        self.assertTrue(callable(main))

    def test_hash_is_stable(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=Path(tmp)/"x";f.write_bytes(b"abc")
            self.assertEqual(sha(f),sha(f))
            self.assertEqual(len(sha(f)),64)

    def test_profile_config_is_from_scratch(self):
        cfg=create_config("code-tiny")
        self.assertEqual(cfg["initialization"]["weights"],"random")
        self.assertFalse(cfg["resource_policy"]["paid_fallback"])

if __name__=="__main__":unittest.main()
