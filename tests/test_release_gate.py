import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud" / "runtime"))
from release_gate import evaluate

class ReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.bundle = self.root / "bundle"; self.bundle.mkdir()
        artifact = self.bundle / "checkpoint.pt"; artifact.write_bytes(b"random-init-checkpoint-fixture")
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        (self.bundle / "bundle-manifest.json").write_text(json.dumps({
            "schema_version":"mct.model-bundle.v1","model_family":"MMD-Test",
            "initialization":{"weights":"random"},
            "files":[{"path":"checkpoint.pt","sha256":digest}]
        }), encoding="utf-8")
        self.evaluation = self.root / "evaluation.json"
        self.evaluation.write_text(json.dumps({"schema_version":"mct.evaluation.v1","model_family":"MMD-Test","test_loss":1.2,"perplexity":3.3}),encoding="utf-8")
        self.benchmark = self.root / "benchmark.json"
        self.benchmark.write_text(json.dumps({
            "schema_version":"mct.task-benchmark.v1","model_family":"MMD-Test",
            "overall":{"examples":60,"pass_rate":0.9},
            "by_task":{"unreal_cpp":{"examples":10,"pass_rate":0.9}},
            "by_language":{"en":{"examples":10,"pass_rate":0.9}}
        }),encoding="utf-8")
        self.review = self.root / "review.json"
        self.review.write_text(json.dumps({
            "review_id":"review-001","reviewer":"Human reviewer","reviewed_at":"2026-11-08T18:00:00Z",
            "data_rights_reviewed":True,"outputs_reviewed":True,"safety_reviewed":True,
            "unreal_build_verified":True,"unreal_build_log_sha256":"b"*64,
            "evidence":["manual-review.md","unreal-build.log"],"limitations":["Tiny synthetic fixture."]
        }),encoding="utf-8")
        self.policy = self.root / "policy.json"
        self.policy.write_text(json.dumps({
            "max_test_loss":2.0,"max_perplexity":10,"min_benchmark_examples":50,
            "min_overall_pass_rate":0.85,"min_group_examples":5,"min_group_pass_rate":0.75,
            "required_by_task":["unreal_cpp"],"required_by_language":["en"]
        }),encoding="utf-8")

    def tearDown(self): self.tmp.cleanup()

    def run_gate(self):
        return evaluate(self.bundle,self.evaluation,self.benchmark,self.review,self.policy,self.root/"result.json")

    def test_pass_is_only_eligible_for_separate_owner_decision(self):
        result=self.run_gate()
        self.assertTrue(result["candidate_for_release_owner_review"])
        self.assertEqual(result["status"],"awaiting_release_owner_decision")
        self.assertFalse(result["automatic_promotion"])

    def test_modified_bundle_artifact_blocks_candidate(self):
        (self.bundle/"checkpoint.pt").write_bytes(b"tampered")
        result=self.run_gate()
        self.assertFalse(result["candidate_for_release_owner_review"])
        self.assertTrue(any("hash mismatch" in issue for issue in result["issues"]))

    def test_missing_human_approval_blocks_candidate(self):
        review=json.loads(self.review.read_text());review["safety_reviewed"]=False
        self.review.write_text(json.dumps(review))
        result=self.run_gate()
        self.assertTrue(any("safety_reviewed" in issue for issue in result["issues"]))

    def test_low_benchmark_score_blocks_candidate(self):
        benchmark=json.loads(self.benchmark.read_text());benchmark["overall"]["pass_rate"]=0.1
        self.benchmark.write_text(json.dumps(benchmark))
        result=self.run_gate()
        self.assertTrue(any("Overall benchmark" in issue for issue in result["issues"]))

    def test_pretrained_bundle_is_rejected(self):
        manifest=json.loads((self.bundle/"bundle-manifest.json").read_text());manifest["initialization"]["weights"]="pretrained"
        (self.bundle/"bundle-manifest.json").write_text(json.dumps(manifest))
        result=self.run_gate()
        self.assertTrue(any("random-initialized" in issue for issue in result["issues"]))

if __name__=="__main__": unittest.main()
