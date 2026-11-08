"""Verify and package a portable MMD model bundle."""
from __future__ import annotations
import argparse, hashlib, json, shutil, zipfile
from pathlib import Path

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description="Package a verified MMD checkpoint, tokenizer, config and evaluation report.")
    p.add_argument("--checkpoint-dir",required=True);p.add_argument("--config",required=True)
    p.add_argument("--evaluation",required=True);p.add_argument("--output",required=True)
    args=p.parse_args()
    source=Path(args.checkpoint_dir); config=Path(args.config); evaluation=Path(args.evaluation)
    required=[source/"checkpoint.pt",source/"tokenizer.json",source/"checkpoint-manifest.json",config,evaluation]
    missing=[str(x) for x in required if not x.is_file()]
    if missing: raise FileNotFoundError("Missing required model bundle files: "+", ".join(missing))
    manifest=json.loads((source/"checkpoint-manifest.json").read_text(encoding="utf-8"))
    report=json.loads(evaluation.read_text(encoding="utf-8"))
    if report.get("config_sha256")!=sha(config): raise ValueError("Evaluation report does not match the selected model config.")
    if report.get("checkpoint_sha256")!=sha(source/"checkpoint.pt"): raise ValueError("Evaluation report does not match checkpoint bytes.")
    if report.get("tokenizer_sha256")!=sha(source/"tokenizer.json"): raise ValueError("Evaluation report does not match tokenizer bytes.")
    if manifest.get("lineage",{}).get("dataset_revision")!=report.get("dataset_revision"): raise ValueError("Evaluation and checkpoint dataset revisions differ.")
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    files=[source/"checkpoint.pt",source/"tokenizer.json",source/"checkpoint-manifest.json",config,evaluation]
    bundle_manifest={"schema_version":"mct.model-bundle.v1","model_family":manifest.get("model_family"),
        "initialization":manifest.get("initialization"),"lineage":manifest.get("lineage"),
        "evaluation":{"test_loss":report.get("test_loss"),"perplexity":report.get("perplexity")},
        "files":[{"path":f.name,"sha256":sha(f),"size_bytes":f.stat().st_size} for f in files]}
    with zipfile.ZipFile(output,"w",compression=zipfile.ZIP_DEFLATED) as archive:
        for file in files: archive.write(file,arcname=file.name)
        archive.writestr("bundle-manifest.json",json.dumps(bundle_manifest,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"bundle":str(output),"sha256":sha(output),"files":len(files)+1,"model_family":bundle_manifest["model_family"]},indent=2))

if __name__=="__main__":main()
