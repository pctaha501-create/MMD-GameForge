import json, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"cloud"/"runtime"))
from model_factory import create_config, estimate_parameters
from experiment_registry import connect, register

class ModelFactoryTests(unittest.TestCase):
    def test_profiles_are_random_init_and_no_paid_fallback(self):
        for profile in ("multilingual-tiny","multilingual-pilot","code-tiny","game-design-tiny","game-agent-tiny","bilingual-base-1b"):
            config=create_config(profile,123)
            self.assertEqual(config["initialization"]["weights"],"random")
            self.assertFalse(config["resource_policy"]["paid_fallback"])
            self.assertEqual(config["initialization"]["seed"],123)

    def test_estimator_counts_tied_and_untied_head(self):
        config=create_config("multilingual-tiny")
        tied=estimate_parameters(config)["total_parameters"]
        config["architecture"]["tie_word_embeddings"]=False
        untied=estimate_parameters(config)["total_parameters"]
        self.assertEqual(untied-tied,config["architecture"]["vocab_size"]*config["architecture"]["hidden_size"]+config["architecture"]["vocab_size"])
        self.assertGreater(tied,0)

    def test_bilingual_base_profile_is_about_one_billion_parameters(self):
        config=create_config("bilingual-base-1b",123)
        estimate=estimate_parameters(config)
        self.assertEqual(config["model_family"],"MMD-Base-1B-Bilingual")
        self.assertEqual(config["tokenizer"]["languages"],["fa","en"])
        self.assertGreaterEqual(estimate["total_parameters"],1_000_000_000)
        self.assertLess(estimate["total_parameters"],1_050_000_000)
        self.assertEqual(estimate["total_parameters"],1_022_871_552)
        self.assertTrue(config["resource_policy"]["require_cuda"])
        self.assertEqual(config["resource_policy"]["minimum_gpu_memory_gib"],24)

    def test_registry_records_experiment_metrics_and_artifact_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); cfg=root/"config.json"; prov=root/"provenance.json"; artifact=root/"weights.bin"
            cfg.write_text(json.dumps(create_config("multilingual-tiny")),encoding="utf-8")
            prov.write_text(json.dumps({"source":"test","revision":"r1","license":"CC0","license_url":"https://example.org/license","collected_at":"2026-11-08","languages":["en"],"preprocessing":"NFC","splits":{"train":"a","validation":"b","test":"c"}}),encoding="utf-8")
            artifact.write_bytes(b"test-weights")
            args=type("Args",(),{"name":"unit-run","config":str(cfg),"provenance":str(prov),"commit":"abcdef012345","status":"completed","notes":"","artifact":[str(artifact)],"metric":["validation:loss:2.3:10"]})()
            db=connect(str(root/"registry.sqlite"))
            run_id=register(db,args)
            self.assertEqual(run_id,1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM metrics").fetchone()[0],1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0],1)
            db.close()

if __name__=="__main__": unittest.main()
