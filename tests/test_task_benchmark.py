import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"cloud"/"runtime"))
from benchmark import score_example

class TaskBenchmarkTests(unittest.TestCase):
    def test_scores_required_and_forbidden_text(self):
        result=score_example({"expected_contains":["class A","public:"],"forbidden_contains":["TODO"]},"class A { public: int x; };")
        self.assertTrue(result["passed"])
        self.assertEqual(result["missing_expected"],[])
    def test_detects_missing_and_forbidden(self):
        result=score_example({"expected_contains":["UCLASS"],"forbidden_contains":["TODO"]},"// TODO implement")
        self.assertFalse(result["passed"])
        self.assertIn("UCLASS",result["missing_expected"])
    def test_checks_expected_tool_call(self):
        good='{"schema_version":"mmd.tool-call.v1","tool":"project.create_file","arguments":{"path":"Source/A.cpp","content":"//"}}'
        self.assertTrue(score_example({"expected_tool":"project.create_file"},good)["passed"])
        self.assertFalse(score_example({"expected_tool":"project.write_file"},good)["passed"])

if __name__=="__main__":unittest.main()
