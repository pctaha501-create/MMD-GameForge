"""Prepare a licensed multilingual corpus for MMD Cloud Training."""
from __future__ import annotations
import argparse, hashlib, json, re, unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

def canonical_text(value: str) -> str:
    value = unicodedata.normalize("NFC", value).replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in value.split("\n")).strip()

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def stable_key(seed: int, text: str) -> str:
    return hashlib.sha256(f"{seed}\0{text}".encode("utf-8")).hexdigest()

def load_documents(path: Path) -> tuple[list[dict], dict]:
    if not path.is_file():
        raise FileNotFoundError(path)
    raw = path.read_bytes()
    documents, seen = [], set()
    duplicates = empty = 0
    decoded = raw.decode("utf-8-sig")
    for line_no, line in enumerate(decoded.splitlines(), 1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on line {line_no}: {exc.msg}") from exc
        if not isinstance(item, dict) or not isinstance(item.get("text"), str):
            raise ValueError(f"Line {line_no} must be an object with a string 'text' field.")
        text = canonical_text(item["text"])
        language = item.get("language")
        if not text:
            empty += 1
            continue
        if not isinstance(language, str) or not language.strip():
            raise ValueError(f"Line {line_no} is missing a language tag.")
        language = language.strip().lower()
        key = (language, text)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        documents.append({"text": text, "language": language})
    return documents, {"input_sha256": sha256_bytes(raw), "input_records": sum(1 for x in decoded.splitlines() if x.strip()), "duplicates_removed": duplicates, "empty_records_removed": empty, "malformed_records": 0}

def split_documents(documents: list[dict], seed: int) -> dict[str, list[dict]]:
    if len(documents) < 3:
        raise ValueError("At least three unique non-empty documents are required to create train/validation/test splits.")
    ordered = sorted(documents, key=lambda item: stable_key(seed, item["text"]))
    n = len(ordered)
    test_count = max(1, round(n * 0.05))
    validation_count = max(1, round(n * 0.05))
    if test_count + validation_count >= n:
        test_count = validation_count = 1
    train_end = n - validation_count - test_count
    return {"train": ordered[:train_end], "validation": ordered[train_end:n-test_count], "test": ordered[n-test_count:]}

def prepare(args: argparse.Namespace) -> dict:
    docs, stats = load_documents(Path(args.input))
    if len(docs) < 3:
        raise ValueError("Need at least three unique documents after deduplication.")
    splits = split_documents(docs, args.seed)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    corpus_parts, split_report = [], {}
    cursor = 0
    for name, records in splits.items():
        part = "\n\n".join(doc["text"] for doc in records)
        start, end = cursor, cursor + len(part)
        corpus_parts.append(part)
        split_report[name] = {
            "documents": len(records), "characters": len(part),
            "corpus_start": start, "corpus_end": end,
            "language_counts": dict(sorted(Counter(doc["language"] for doc in records).items())),
            "document_ids": [stable_key(args.seed, doc["text"])[:16] for doc in records],
        }
        cursor = end + 2
    corpus = "\n\n".join(corpus_parts).strip() + "\n"
    # Recompute exact offsets after trimming and final newline normalization.
    cursor = 0
    for index, name in enumerate(("train", "validation", "test")):
        part = corpus_parts[index]
        split_report[name]["corpus_start"] = cursor
        split_report[name]["corpus_end"] = cursor + len(part)
        cursor += len(part) + (2 if index < 2 else 0)
    (out / "corpus.txt").write_text(corpus, encoding="utf-8")
    language_counts = dict(sorted(Counter(doc["language"] for doc in docs).items()))
    provenance = {
        "source": args.source, "revision": args.revision, "license": args.license,
        "license_url": args.license_url, "collected_at": args.collected_at,
        "languages": sorted(language_counts), "preprocessing": args.preprocessing,
        "splits": {name: f"{data['documents']} documents / {data['characters']} characters" for name, data in split_report.items()},
        "dataset_studio": {
            "schema_version": "mct.dataset-report.v1", "seed": args.seed,
            "deduplication": "NFC normalization, whitespace normalization, exact text+language match",
            "input_sha256": stats["input_sha256"], "corpus_sha256": sha256_bytes(corpus.encode("utf-8")),
            "unique_documents": len(docs), "language_counts": language_counts, "split_details": split_report,
        },
    }
    (out / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"schema_version": "mct.dataset-report.v1", **stats, "unique_documents": len(docs),
        "language_counts": language_counts, "splits": split_report, "corpus_characters": len(corpus),
        "corpus_sha256": provenance["dataset_studio"]["corpus_sha256"],
        "output_files": ["corpus.txt", "provenance.json", "report.json"]}
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report

def parse_args():
    parser = argparse.ArgumentParser(description="Prepare and audit a multilingual MMD training corpus.")
    parser.add_argument("--input", required=True); parser.add_argument("--output", required=True)
    parser.add_argument("--source", required=True); parser.add_argument("--revision", required=True)
    parser.add_argument("--license", required=True); parser.add_argument("--license-url", required=True)
    parser.add_argument("--collected-at", default=date.today().isoformat())
    parser.add_argument("--preprocessing", default="UTF-8 JSONL; Unicode NFC; whitespace normalization; exact duplicate removal")
    parser.add_argument("--seed", type=int, default=20261108)
    return parser.parse_args()

if __name__ == "__main__":
    result = prepare(parse_args())
    print(json.dumps({k: result[k] for k in ("input_records", "duplicates_removed", "unique_documents", "language_counts", "splits", "corpus_characters")}, ensure_ascii=False, indent=2))
