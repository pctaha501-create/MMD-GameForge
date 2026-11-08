import json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"cloud"/"runtime"))
from instruction_dataset import load,split,key

class InstructionDatasetTests(unittest.TestCase):
    def rows(self,n=40):
        return [{"prompt":f"Create mechanic {i}","response":f"Mechanic details {i}","language":"en" if i%2 else "fa","task":"game_design"} for i in range(n)]
    def test_normalizes_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=Path(tmp)/"data.jsonl"
            f.write_text("\n".join(json.dumps(x,ensure_ascii=False) for x in [
                {"prompt":" hello ","response":" world ","language":"EN","task":"coding"},
                {"prompt":"hello","response":"world","language":"en","task":"coding"}]),encoding="utf-8")
            rows,stats=load(f);self.assertEqual(len(rows),1);self.assertEqual(stats["duplicates_removed"],1)
    def test_deterministic_disjoint_splits(self):
        rows=self.rows();a=split(rows,42);b=split(rows,42)
        self.assertEqual({k:[key(42,x) for x in v] for k,v in a.items()},{k:[key(42,x) for x in v] for k,v in b.items()})
        ids=[{key(42,x) for x in a[k]} for k in a]
        self.assertFalse(ids[0]&ids[1]);self.assertFalse(ids[0]&ids[2]);self.assertFalse(ids[1]&ids[2])
    def test_requires_three_examples(self):
        with self.assertRaisesRegex(ValueError,"three unique"):split(self.rows(2),1)
    def test_rejects_missing_response(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=Path(tmp)/"data.jsonl";f.write_text(json.dumps({"prompt":"x","language":"en","task":"code"}),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"response"):load(f)

if __name__=="__main__":unittest.main()
