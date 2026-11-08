"""SQLite experiment and model artifact registry (Python standard library only)."""
from __future__ import annotations
import argparse, hashlib, json, sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS experiments (
 id INTEGER PRIMARY KEY, run_name TEXT NOT NULL UNIQUE, model_family TEXT NOT NULL,
 config_path TEXT NOT NULL, config_sha256 TEXT NOT NULL, dataset_revision TEXT NOT NULL,
 source_commit TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('created','running','completed','failed')),
 created_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS metrics (
 id INTEGER PRIMARY KEY, experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
 step INTEGER NOT NULL, name TEXT NOT NULL, value REAL NOT NULL, split TEXT NOT NULL,
 recorded_at TEXT NOT NULL, UNIQUE(experiment_id,step,name,split)
);
CREATE TABLE IF NOT EXISTS artifacts (
 id INTEGER PRIMARY KEY, experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL,
 registered_at TEXT NOT NULL, UNIQUE(experiment_id,kind,path)
);
CREATE TABLE IF NOT EXISTS model_releases (
 id INTEGER PRIMARY KEY, experiment_id INTEGER NOT NULL REFERENCES experiments(id),
 release_name TEXT NOT NULL UNIQUE, evaluation_summary TEXT NOT NULL,
 released_at TEXT NOT NULL
);
"""

def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def connect(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    return db

def register(db: sqlite3.Connection, args) -> int:
    cfg_path = Path(args.config)
    config = json.loads(cfg_path.read_text(encoding="utf-8"))
    provenance = json.loads(Path(args.provenance).read_text(encoding="utf-8"))
    required = ("source", "revision", "license", "license_url", "collected_at", "languages", "preprocessing", "splits")
    missing = [key for key in required if provenance.get(key) in (None, "", [], {})]
    if missing:
        raise ValueError("Incomplete provenance: " + ", ".join(missing))
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.execute(
        "INSERT INTO experiments(run_name,model_family,config_path,config_sha256,dataset_revision,source_commit,status,created_at,notes) VALUES(?,?,?,?,?,?,?,?,?)",
        (args.name, config["model_family"], str(cfg_path), digest(cfg_path), provenance["revision"], args.commit, args.status, now, args.notes)
    )
    experiment_id = cursor.lastrowid
    for item in args.artifact:
        path = Path(item)
        if not path.is_file():
            raise FileNotFoundError(path)
        db.execute("INSERT INTO artifacts(experiment_id,kind,path,sha256,size_bytes,registered_at) VALUES(?,?,?,?,?,?)",
                   (experiment_id, path.suffix.lstrip(".") or "file", str(path), digest(path), path.stat().st_size, now))
    for metric in args.metric:
        split, name, raw_value, raw_step = metric.split(":", 3)
        db.execute("INSERT INTO metrics(experiment_id,step,name,value,split,recorded_at) VALUES(?,?,?,?,?,?)",
                   (experiment_id, int(raw_step), name, float(raw_value), split, now))
    db.commit()
    return int(experiment_id)

def main():
    parser = argparse.ArgumentParser(description="Track MMD training experiments and verified model artifacts.")
    parser.add_argument("--db", default="mmd-experiments.sqlite3")
    sub = parser.add_subparsers(dest="command", required=True)
    reg = sub.add_parser("register")
    reg.add_argument("--name", required=True); reg.add_argument("--config", required=True)
    reg.add_argument("--provenance", required=True); reg.add_argument("--commit", required=True)
    reg.add_argument("--status", choices=["created","running","completed","failed"], default="created")
    reg.add_argument("--notes", default=""); reg.add_argument("--artifact", action="append", default=[])
    reg.add_argument("--metric", action="append", default=[], help="split:name:value:step, e.g. validation:loss:2.31:500")
    sub.add_parser("list")
    args = parser.parse_args()
    db = connect(args.db)
    if args.command == "register":
        print(json.dumps({"experiment_id": register(db, args), "database": args.db}))
    else:
        rows = db.execute("SELECT id,run_name,model_family,dataset_revision,status,created_at FROM experiments ORDER BY id DESC").fetchall()
        print(json.dumps([dict(zip(("id","run_name","model_family","dataset_revision","status","created_at"), row)) for row in rows], indent=2))
    db.close()

if __name__ == "__main__":
    main()
