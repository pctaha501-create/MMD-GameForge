"""Supervised instruction training from random initialization (no pretrained checkpoint)."""
from __future__ import annotations
import argparse,hashlib,json,math,os,random,time
from pathlib import Path
import torch
import torch.nn.functional as F
from tokenizers import ByteLevelBPETokenizer
from model import build_model
from validate import read_json,validate_config,validate_provenance

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def read_rows(path:Path)->list[dict]:
    rows=[]
    for n,line in enumerate(path.read_text(encoding="utf-8").splitlines(),1):
        if not line.strip():continue
        item=json.loads(line)
        if not isinstance(item,dict) or not all(isinstance(item.get(k),str) and item[k].strip() for k in ("prompt","response","language","task")):
            raise ValueError(f"Invalid instruction example at {path}:{n}")
        rows.append(item)
    if not rows:raise ValueError(f"Instruction split is empty: {path}")
    return rows

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--config",required=True);p.add_argument("--dataset-dir",required=True)
    p.add_argument("--output",required=True);p.add_argument("--max-steps",type=int)
    p.add_argument("--source-commit",default=os.environ.get("GITHUB_SHA","local-unpinned"))
    args=p.parse_args()
    config_path=Path(args.config);root=Path(args.dataset_dir);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    config=read_json(config_path);validate_config(config)
    provenance=read_json(root/"provenance.json");validate_provenance(provenance)
    if provenance.get("instruction_dataset",{}).get("schema_version")!="mct.instruction-dataset.v1":raise ValueError("Unsupported instruction dataset schema.")
    rows={name:read_rows(root/f"{name}.jsonl") for name in ("train","validation","test")}
    for name in rows:
        expected=provenance["instruction_dataset"]["files"].get(name)
        if not expected or sha(root/f"{name}.jsonl")!=expected:raise ValueError(f"{name} instruction split hash does not match provenance.")
    train_cfg=config["training"];arch=config["architecture"];seq=int(arch["max_sequence_length"])
    max_steps=args.max_steps or int(train_cfg["max_steps"])
    if max_steps<1:raise ValueError("max_steps must be positive.")
    seed=int(config["initialization"]["seed"]);random.seed(seed);torch.manual_seed(seed)
    if torch.cuda.is_available():torch.cuda.manual_seed_all(seed)
    device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer_path=out/"tokenizer.json";tokenizer=ByteLevelBPETokenizer()
    def formatted(row):return "<|user|>\n"+row["prompt"]+"\n<|assistant|>\n"+row["response"]+" <|endoftext|>"
    tokenizer.train_from_iterator((formatted(row) for row in rows["train"]),vocab_size=int(config["tokenizer"]["target_vocab_size"]),min_frequency=2,special_tokens=["<|user|>","<|assistant|>","<|endoftext|>"])
    tokenizer.save(str(tokenizer_path))
    if tokenizer.get_vocab_size()>int(arch["vocab_size"]):raise ValueError("Tokenizer vocabulary exceeds architecture vocab_size.")
    eos=tokenizer.token_to_id("<|endoftext|>")
    if eos is None:raise ValueError("Tokenizer is missing the end-of-text token.")
    pad=eos
    def encode(row):
        prompt=tokenizer.encode("<|user|>\n"+row["prompt"]+"\n<|assistant|>\n").ids
        response=tokenizer.encode(row["response"]).ids+[eos]
        if len(prompt)>=seq:prompt=prompt[-(seq-2):]
        response=response[:seq-len(prompt)]
        if not response:raise ValueError("Instruction response is empty after sequence-length truncation.")
        joined=prompt+response
        x=joined[:-1];labels=[-100]*max(0,len(prompt)-1)+response
        labels=labels[:len(x)]
        x=x[:seq-1]
        labels=labels[:seq-1]
        x+= [pad]*((seq-1)-len(x));labels+= [-100]*((seq-1)-len(labels))
        if all(v==-100 for v in labels):raise ValueError("Instruction example has no response tokens to train on.")
        return x,labels
    encoded={name:[encode(row) for row in items] for name,items in rows.items()}
    model=build_model(config).to(device)
    optimizer=torch.optim.AdamW(model.parameters(),lr=train_cfg["learning_rate"],weight_decay=train_cfg["weight_decay"])
    warmup=max(1,int(train_cfg.get("warmup_steps",1)))
    def lr_factor(step):
        if step<warmup:return (step+1)/warmup
        progress=min(1.0,(step-warmup)/max(1,max_steps-warmup));return .5*(1+math.cos(math.pi*progress))
    scheduler=torch.optim.lr_scheduler.LambdaLR(optimizer,lr_factor)
    precision=train_cfg.get("precision","auto");amp=device.type=="cuda" and precision!="fp32"
    dtype=torch.bfloat16 if precision=="bf16" or (precision=="auto" and device.type=="cuda" and torch.cuda.is_bf16_supported()) else torch.float16
    scaler=torch.amp.GradScaler("cuda",enabled=amp and dtype==torch.float16)
    config_hash=sha(config_path);checkpoint=out/"checkpoint.pt";manifest_path=out/"checkpoint-manifest.json"
    start=0
    if train_cfg.get("resume_from_checkpoint",True) and checkpoint.exists():
        state=torch.load(checkpoint,map_location=device,weights_only=True)
        if state.get("config_sha256")!=config_hash or state.get("dataset_revision")!=provenance["revision"] or state.get("tokenizer_sha256")!=sha(tokenizer_path):
            raise ValueError("Checkpoint lineage does not match current config/dataset/tokenizer.")
        model.load_state_dict(state["model"]);optimizer.load_state_dict(state["optimizer"]);scheduler.load_state_dict(state["scheduler"]);scaler.load_state_dict(state.get("scaler",{}));start=int(state["global_step"])
    else:print(f"Initialized {sum(x.numel() for x in model.parameters()):,} parameters from random weights.")
    def batch(split):
        chosen=random.choices(encoded[split],k=int(train_cfg["micro_batch_size"]))
        x=torch.tensor([a for a,_ in chosen],dtype=torch.long,device=device)
        y=torch.tensor([b for _,b in chosen],dtype=torch.long,device=device)
        return x,y
    @torch.no_grad()
    def evaluate(split):
        model.eval();losses=[]
        for _ in range(min(16,max(1,len(encoded[split])))):
            x,y=batch(split)
            with torch.autocast(device_type=device.type,enabled=amp,dtype=dtype):
                logits=model(x);loss=F.cross_entropy(logits.reshape(-1,logits.size(-1)),y.reshape(-1),ignore_index=-100)
            losses.append(float(loss.cpu()))
        model.train();return sum(losses)/len(losses)
    def save(step,val_loss,status="not_run"):
        temp=checkpoint.with_suffix(".pt.tmp")
        torch.save({"model":model.state_dict(),"optimizer":optimizer.state_dict(),"scheduler":scheduler.state_dict(),"scaler":scaler.state_dict(),
            "global_step":step,"config_sha256":config_hash,"dataset_revision":provenance["revision"],"tokenizer_sha256":sha(tokenizer_path),"seed":seed},temp)
        os.replace(temp,checkpoint)
        artifacts=[{"path":p.name,"sha256":sha(p),"size_bytes":p.stat().st_size} for p in (checkpoint,tokenizer_path)]
        manifest={"schema_version":"mct.checkpoint.v1","model_family":config["model_family"],"architecture_revision":"mmd-transformer-v1",
            "initialization":{"method":"architecture_defined","seed":seed,"weights_origin":"random_initialization"},
            "training_state":{"global_step":step,"epoch":0.0,"optimizer_state_included":True,"scheduler_state_included":True},
            "lineage":{"source_commit":args.source_commit if len(args.source_commit)>=7 else "local-unpinned","config_sha256":config_hash,
                "dataset_revision":provenance["revision"],"tokenizer_revision":sha(tokenizer_path)},
            "artifacts":artifacts,"evaluation":{"status":status,"validation_loss":val_loss}}
        tmp=manifest_path.with_suffix(".json.tmp");tmp.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8");os.replace(tmp,manifest_path)
    model.train();accum=int(train_cfg["gradient_accumulation_steps"]);interval=int(train_cfg["checkpoint_interval_steps"])
    began=time.monotonic();budget=int(os.environ.get("MMD_MAX_RUNTIME_SECONDS","0") or 0);last_val=float("nan");step_no=start
    for step in range(start,max_steps):
        optimizer.zero_grad(set_to_none=True)
        for _ in range(accum):
            x,y=batch("train")
            with torch.autocast(device_type=device.type,enabled=amp,dtype=dtype):
                logits=model(x);loss=F.cross_entropy(logits.reshape(-1,logits.size(-1)),y.reshape(-1),ignore_index=-100)/accum
            scaler.scale(loss).backward()
        scaler.unscale_(optimizer);torch.nn.utils.clip_grad_norm_(model.parameters(),train_cfg.get("gradient_clipping",1.0))
        scaler.step(optimizer);scaler.update();scheduler.step()
        step_no=step+1
        if step_no%int(train_cfg.get("evaluation_interval_steps",interval))==0 or step_no==max_steps:
            last_val=evaluate("validation");print(f"step={step_no} validation_loss={last_val:.4f}")
        if step_no%interval==0 or step_no==max_steps:save(step_no,last_val)
        if budget and time.monotonic()-began>=budget:
            save(step_no,last_val);print("Runtime budget reached; checkpoint saved.");break
    test_loss=evaluate("test");save(step_no,last_val,"passed" if math.isfinite(test_loss) else "failed")
    result={"schema_version":"mct.instruction-evaluation.v1","model_family":config["model_family"],"global_step":step_no,
        "validation_loss":last_val,"test_loss":test_loss,"perplexity":math.exp(min(test_loss,20)),
        "instruction_examples":{"train":len(rows["train"]),"validation":len(rows["validation"]),"test":len(rows["test"])},
        "dataset_revision":provenance["revision"],"config_sha256":config_hash,"checkpoint_sha256":sha(checkpoint),"tokenizer_sha256":sha(tokenizer_path)}
    (out/"instruction-evaluation.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2))

if __name__=="__main__":main()
