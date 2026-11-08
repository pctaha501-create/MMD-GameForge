"""Task-specific held-out benchmark runner for an imported MMD model bundle."""
from __future__ import annotations
import argparse,json
from collections import defaultdict
from pathlib import Path
from serve import load_bundle
from model import generate

def score_example(example:dict,output:str)->dict:
    required=example.get("expected_contains",[])
    forbidden=example.get("forbidden_contains",[])
    if not isinstance(required,list) or not all(isinstance(x,str) for x in required):raise ValueError("expected_contains must be a string array.")
    if not isinstance(forbidden,list) or not all(isinstance(x,str) for x in forbidden):raise ValueError("forbidden_contains must be a string array.")
    lowered=output.casefold()
    missing=[x for x in required if x.casefold() not in lowered]
    violations=[x for x in forbidden if x.casefold() in lowered]
    tool_ok=None
    if example.get("expected_tool"):
        try:call=json.loads(output.strip())
        except json.JSONDecodeError:call=None
        tool_ok=bool(isinstance(call,dict) and call.get("schema_version")=="mmd.tool-call.v1" and call.get("tool")==example["expected_tool"] and isinstance(call.get("arguments"),dict))
    passed=not missing and not violations and (tool_ok is not False)
    return {"passed":passed,"missing_expected":missing,"forbidden_found":violations,"tool_call_valid":tool_ok}

def main():
    p=argparse.ArgumentParser(description="Run human-reviewable task benchmarks against a verified MMD model.")
    p.add_argument("--model-dir",required=True);p.add_argument("--benchmark-jsonl",required=True)
    p.add_argument("--output",required=True);p.add_argument("--max-new-tokens",type=int,default=192)
    args=p.parse_args()
    model,tokenizer,device,family,_=load_bundle(Path(args.model_dir).resolve())
    results=[];by_task=defaultdict(list);by_language=defaultdict(list)
    for line_no,line in enumerate(Path(args.benchmark_jsonl).read_text(encoding="utf-8").splitlines(),1):
        if not line.strip():continue
        item=json.loads(line)
        if not isinstance(item,dict) or not isinstance(item.get("prompt"),str) or not item["prompt"].strip():raise ValueError(f"Invalid benchmark item on line {line_no}.")
        output=generate(model,tokenizer,item["prompt"],max_new_tokens=args.max_new_tokens,temperature=.2,top_k=20,device=device)
        score=score_example(item,output)
        row={"id":item.get("id",str(line_no)),"task":item.get("task","unspecified"),"language":item.get("language","unspecified"),"prompt":item["prompt"],"output":output,**score}
        results.append(row);by_task[row["task"]].append(score["passed"]);by_language[row["language"]].append(score["passed"])
    if not results:raise ValueError("Benchmark file contains no examples.")
    summary=lambda values:{"examples":len(values),"passed":sum(values),"pass_rate":sum(values)/len(values)}
    report={"schema_version":"mct.task-benchmark.v1","model_family":family,"device":str(device),"overall":summary([x["passed"] for x in results]),
        "by_task":{k:summary(v) for k,v in sorted(by_task.items())},"by_language":{k:summary(v) for k,v in sorted(by_language.items())},
        "human_review_required":True,"automatic_release_promotion":False,"results":results}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ("model_family","device","overall","by_task","by_language","human_review_required")},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
