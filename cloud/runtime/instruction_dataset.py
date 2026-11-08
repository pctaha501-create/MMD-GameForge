"""Prepare licensed prompt/response instruction data for from-scratch MMD SFT."""
from __future__ import annotations
import argparse,hashlib,json,re,unicodedata
from collections import Counter
from pathlib import Path

def normalize(value:str)->str:
    value=unicodedata.normalize("NFC",value).replace("\r\n","\n").replace("\r","\n")
    return "\n".join(re.sub(r"[ \t]+"," ",line).strip() for line in value.split("\n")).strip()

def key(seed:int,item:dict)->str:
    raw="\0".join((str(seed),item["language"],item["task"],item["prompt"],item["response"]))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def load(path:Path):
    raw=path.read_bytes(); docs=[]; seen=set(); duplicates=0
    for number,line in enumerate(raw.decode("utf-8-sig").splitlines(),1):
        if not line.strip():continue
        try:item=json.loads(line)
        except json.JSONDecodeError as exc:raise ValueError(f"Invalid JSON on line {number}: {exc.msg}") from exc
        if not isinstance(item,dict):raise ValueError(f"Line {number} must be a JSON object.")
        for field in ("prompt","response","language","task"):
            if not isinstance(item.get(field),str) or not item[field].strip():raise ValueError(f"Line {number} requires non-empty string field '{field}'.")
        doc={field:normalize(item[field]) for field in ("prompt","response","language","task")}
        doc["language"]=doc["language"].lower()
        signature=(doc["language"],doc["task"],doc["prompt"],doc["response"])
        if signature in seen:duplicates+=1;continue
        seen.add(signature);docs.append(doc)
    return docs,{"input_sha256":hashlib.sha256(raw).hexdigest(),"input_records":sum(bool(x.strip()) for x in raw.decode("utf-8-sig").splitlines()),"duplicates_removed":duplicates}

def split(docs:list[dict],seed:int):
    if len(docs)<3:raise ValueError("At least three unique instruction examples are required.")
    ordered=sorted(docs,key=lambda x:key(seed,x));n=len(ordered)
    test=max(1,round(n*.05));val=max(1,round(n*.05))
    if test+val>=n:test=val=1
    return {"train":ordered[:n-test-val],"validation":ordered[n-test-val:n-test],"test":ordered[n-test:]}

def main():
    p=argparse.ArgumentParser(description="Normalize, deduplicate and split instruction examples.")
    p.add_argument("--input",required=True);p.add_argument("--output",required=True)
    p.add_argument("--source",required=True);p.add_argument("--revision",required=True)
    p.add_argument("--license",required=True);p.add_argument("--license-url",required=True)
    p.add_argument("--collected-at",required=True);p.add_argument("--seed",type=int,default=20261108)
    args=p.parse_args();docs,stats=load(Path(args.input));splits=split(docs,args.seed)
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    counts={};task_counts=Counter();lang_counts=Counter()
    for name,items in splits.items():
        path=out/f"{name}.jsonl"
        path.write_text("".join(json.dumps({**x,"example_id":key(args.seed,x)[:20]},ensure_ascii=False)+"\n" for x in items),encoding="utf-8")
        counts[name]=len(items)
        task_counts.update(x["task"] for x in items);lang_counts.update(x["language"] for x in items)
    provenance={"source":args.source,"revision":args.revision,"license":args.license,"license_url":args.license_url,
        "collected_at":args.collected_at,"languages":sorted(lang_counts),"preprocessing":"UTF-8 JSONL; NFC; whitespace normalization; exact prompt+response+task+language deduplication",
        "splits":{k:f"{v} instruction examples" for k,v in counts.items()},
        "instruction_dataset":{"schema_version":"mct.instruction-dataset.v1","seed":args.seed,"examples":len(docs),
        "language_counts":dict(sorted(lang_counts.items())),"task_counts":dict(sorted(task_counts.items())),
        "files":{name:hashlib.sha256((out/f"{name}.jsonl").read_bytes()).hexdigest() for name in counts}}}
    (out/"provenance.json").write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    report={**stats,"unique_examples":len(docs),"split_counts":counts,"language_counts":dict(sorted(lang_counts.items())),"task_counts":dict(sorted(task_counts.items()))}
    (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":main()
