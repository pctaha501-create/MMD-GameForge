"""Authenticated loopback inference server for imported MMD model bundles.

Requires a user-installed Python environment with PyTorch and tokenizers. The
server binds only to 127.0.0.1 and requires a per-process bearer token.
"""
from __future__ import annotations
import argparse, hashlib, json, os, secrets, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from model import build_model, generate
from validate import read_json

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def validate_payload(value):
    if not isinstance(value,dict): raise ValueError("Request body must be a JSON object.")
    prompt=value.get("prompt")
    if not isinstance(prompt,str) or not prompt.strip() or len(prompt)>12000: raise ValueError("prompt must contain 1–12,000 characters.")
    max_new=int(value.get("max_new_tokens",128))
    temperature=float(value.get("temperature",0.8))
    top_k=int(value.get("top_k",40))
    if not 1<=max_new<=512: raise ValueError("max_new_tokens must be between 1 and 512.")
    if not 0.05<=temperature<=2: raise ValueError("temperature must be between 0.05 and 2.")
    if not 1<=top_k<=512: raise ValueError("top_k must be between 1 and 512.")
    return {"prompt":prompt,"max_new_tokens":max_new,"temperature":temperature,"top_k":top_k}

def load_bundle(folder:Path):
    import torch
    from tokenizers import Tokenizer
    manifest=read_json(folder/"bundle-manifest.json")
    if manifest.get("schema_version")!="mct.model-bundle.v1": raise ValueError("Unsupported model bundle.")
    if manifest.get("initialization",{}).get("weights_origin")!="random_initialization": raise ValueError("Bundle is not an MMD from-scratch model.")
    config_item=next((x for x in manifest.get("files",[]) if x.get("sha256")==manifest.get("lineage",{}).get("config_sha256")),None)
    if not config_item: raise ValueError("Model config is missing from bundle.")
    config_path=folder/config_item["path"]
    if sha(config_path)!=config_item["sha256"]: raise ValueError("Config hash mismatch.")
    config=read_json(config_path)
    checkpoint_path=folder/"checkpoint.pt"; tokenizer_path=folder/"tokenizer.json"
    for item in manifest["files"]:
        file=folder/item["path"]
        if not file.is_file() or file.stat().st_size!=item["size_bytes"] or sha(file)!=item["sha256"]:
            raise ValueError("Bundle artifact integrity check failed: "+item["path"])
    state=torch.load(checkpoint_path,map_location="cpu",weights_only=True)
    if state.get("config_sha256")!=sha(config_path): raise ValueError("Checkpoint/config lineage mismatch.")
    if state.get("tokenizer_sha256")!=sha(tokenizer_path): raise ValueError("Checkpoint/tokenizer lineage mismatch.")
    if state.get("dataset_revision")!=manifest.get("lineage",{}).get("dataset_revision"): raise ValueError("Dataset lineage mismatch.")
    device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model=build_model(config).to(device); model.load_state_dict(state["model"]); model.eval()
    tokenizer=Tokenizer.from_file(str(tokenizer_path))
    return model,tokenizer,device,config["model_family"],int(config["architecture"]["max_sequence_length"])

def make_handler(model,tokenizer,device,family,seq_len,token):
    from model import generate
    lock=threading.Lock()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,format,*args): return
        def send_json(self,status,value):
            raw=json.dumps(value,ensure_ascii=False).encode("utf-8")
            self.send_response(status);self.send_header("Content-Type","application/json; charset=utf-8")
            self.send_header("Content-Length",str(len(raw)));self.send_header("Cache-Control","no-store")
            self.end_headers();self.wfile.write(raw)
        def authorized(self):
            return secrets.compare_digest(self.headers.get("Authorization",""),"Bearer "+token)
        def do_GET(self):
            if urlparse(self.path).path!="/health": self.send_json(404,{"error":"Not found"});return
            if not self.authorized(): self.send_json(401,{"error":"Unauthorized"});return
            self.send_json(200,{"status":"ready","model_family":family,"device":str(device),"context_length":seq_len})
        def do_POST(self):
            if urlparse(self.path).path!="/generate": self.send_json(404,{"error":"Not found"});return
            if not self.authorized(): self.send_json(401,{"error":"Unauthorized"});return
            try:
                length=int(self.headers.get("Content-Length","0"))
                if length<1 or length>32768: raise ValueError("Request body must be between 1 and 32 KB.")
                payload=validate_payload(json.loads(self.rfile.read(length).decode("utf-8")))
                with lock:
                    output=generate(model,tokenizer,payload["prompt"],max_new_tokens=payload["max_new_tokens"],temperature=payload["temperature"],top_k=payload["top_k"],device=device)
                self.send_json(200,{"model_family":family,"output":output})
            except (ValueError,TypeError,json.JSONDecodeError,UnicodeDecodeError) as exc:
                self.send_json(400,{"error":str(exc)})
            except Exception:
                self.send_json(500,{"error":"Generation failed. Check the local runtime log."})
    return Handler

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--model-dir",required=True);parser.add_argument("--host",default="127.0.0.1")
    parser.add_argument("--port",type=int,required=True)
    args=parser.parse_args()
    if args.host!="127.0.0.1": raise ValueError("The MMD runtime may only bind to 127.0.0.1.")
    if not 1024<=args.port<=65535: raise ValueError("Port must be between 1024 and 65535.")
    token=os.environ.get("MMD_RUNTIME_TOKEN","")
    if len(token)<32: raise ValueError("MMD_RUNTIME_TOKEN must be a random token of at least 32 characters.")
    model,tokenizer,device,family,seq_len=load_bundle(Path(args.model_dir).resolve())
    server=ThreadingHTTPServer((args.host,args.port),make_handler(model,tokenizer,device,family,seq_len,token))
    server.daemon_threads=True
    print(json.dumps({"event":"MMD_RUNTIME_READY","host":args.host,"port":args.port,"model_family":family,"device":str(device)}),flush=True)
    try: server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=="__main__":main()
