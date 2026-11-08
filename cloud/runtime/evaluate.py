"""Evaluate a trained MMD checkpoint without changing its weights."""
from __future__ import annotations
import argparse, hashlib, json, math, time
from pathlib import Path
import torch
import torch.nn.functional as F
from tokenizers import Tokenizer
from model import build_model, generate
from validate import read_json, validate_job

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description="Evaluate an MMD from-scratch checkpoint.")
    p.add_argument("--config",required=True); p.add_argument("--dataset",required=True)
    p.add_argument("--provenance",required=True); p.add_argument("--checkpoint",required=True)
    p.add_argument("--tokenizer",required=True); p.add_argument("--output",required=True)
    p.add_argument("--max-batches",type=int,default=32); p.add_argument("--benchmark-jsonl")
    p.add_argument("--max-new-tokens",type=int,default=96)
    args=p.parse_args()
    job=validate_job(args.config,args.dataset,args.provenance)
    config=job["config"]; provenance=read_json(args.provenance)
    config_path, dataset_path, checkpoint_path, tokenizer_path=map(Path,(args.config,args.dataset,args.checkpoint,args.tokenizer))
    state=torch.load(checkpoint_path,map_location="cpu",weights_only=True)
    config_hash=sha256(config_path)
    if state.get("config_sha256")!=config_hash: raise ValueError("Checkpoint config hash does not match.")
    if state.get("dataset_revision")!=provenance["revision"]: raise ValueError("Checkpoint dataset revision does not match.")
    if state.get("tokenizer_sha256")!=sha256(tokenizer_path): raise ValueError("Tokenizer hash does not match checkpoint.")
    manifest_path=checkpoint_path.parent/"checkpoint-manifest.json"
    manifest=read_json(manifest_path)
    if manifest.get("lineage",{}).get("config_sha256")!=config_hash: raise ValueError("Checkpoint manifest lineage mismatch.")
    if manifest.get("lineage",{}).get("dataset_revision")!=provenance["revision"]: raise ValueError("Manifest dataset revision mismatch.")
    text=dataset_path.read_text(encoding="utf-8")
    details=provenance.get("dataset_studio",{}).get("split_details",{})
    if "test" in details:
        test_text=text[details["test"]["corpus_start"]:details["test"]["corpus_end"]]
    else:
        test_text=text[int(len(text)*0.95):]
    tokenizer=Tokenizer.from_file(str(tokenizer_path))
    ids=tokenizer.encode(test_text).ids
    seq=int(config["architecture"]["max_sequence_length"])
    if len(ids)<seq+2: raise ValueError(f"Test split requires at least {seq+2} tokens; found {len(ids)}.")
    device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model=build_model(config).to(device); model.load_state_dict(state["model"]); model.eval()
    batches=min(args.max_batches,max(1,(len(ids)-seq-1)//1))
    losses=[]
    with torch.no_grad():
        for index in range(batches):
            start=(index*seq)%(len(ids)-seq-1)
            x=torch.tensor([ids[start:start+seq]],device=device)
            y=torch.tensor([ids[start+1:start+seq+1]],device=device)
            losses.append(float(F.cross_entropy(model(x).reshape(-1,model.head.out_features),y.reshape(-1)).cpu()))
    test_loss=sum(losses)/len(losses)
    result={"schema_version":"mct.evaluation.v1","model_family":config["model_family"],
        "global_step":state["global_step"],"test_loss":test_loss,
        "perplexity":math.exp(min(test_loss,20)),"test_batches":batches,
        "device":str(device),"config_sha256":config_hash,"dataset_revision":provenance["revision"],
        "checkpoint_sha256":sha256(checkpoint_path),"tokenizer_sha256":sha256(tokenizer_path),
        "benchmark_examples":[],"evaluated_at_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}
    if args.benchmark_jsonl:
        examples=[]
        for line_no,line in enumerate(Path(args.benchmark_jsonl).read_text(encoding="utf-8").splitlines(),1):
            if not line.strip(): continue
            item=json.loads(line)
            if not isinstance(item,dict) or not isinstance(item.get("prompt"),str): raise ValueError(f"Invalid benchmark JSONL line {line_no}.")
            output=generate(model,tokenizer,item["prompt"],max_new_tokens=args.max_new_tokens,device=device)
            examples.append({"id":item.get("id",str(line_no)),"task":item.get("task","unspecified"),"language":item.get("language","unspecified"),"prompt":item["prompt"],"generated":output,"reference":item.get("reference")})
        result["benchmark_examples"]=examples
        result["benchmark_count"]=len(examples)
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:result[k] for k in ("model_family","global_step","test_loss","perplexity","test_batches","device","benchmark_count") if k in result},indent=2))

if __name__=="__main__": main()
