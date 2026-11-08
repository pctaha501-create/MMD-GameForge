import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"cloud"/"runtime"))
from serve import validate_payload

class LocalRuntimeTests(unittest.TestCase):
    def test_accepts_bounded_generation_request(self):
        self.assertEqual(validate_payload({"prompt":"Write a game idea","max_new_tokens":64})["max_new_tokens"],64)
    def test_rejects_empty_and_oversized_prompts(self):
        for prompt in ("", "x"*12001):
            with self.assertRaises(ValueError): validate_payload({"prompt":prompt})
    def test_rejects_out_of_range_generation_settings(self):
        for value in (0,513):
            with self.assertRaises(ValueError): validate_payload({"prompt":"hello","max_new_tokens":value})
    def test_rejects_non_object_payload(self):
        with self.assertRaises(ValueError): validate_payload(["hello"])

if __name__=="__main__":unittest.main()
