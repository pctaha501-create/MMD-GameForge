# MCT-09 — Task-specific benchmark runner

MCT-09 provides a held-out benchmark harness for code, Unreal, game-design and structured tool-use tasks. It runs against an imported, hash-verified model bundle and records each prompt/output for human review.

## Benchmark JSONL

Each line is one held-out example with fields such as id, task, language, prompt, expected_contains, forbidden_contains, and optional expected_tool.

Example:
    {"id":"ue-cpp-001","task":"unreal_cpp","language":"cpp","prompt":"Create an Unreal Actor declaration.","expected_contains":["UCLASS","AActor","UPROPERTY"],"forbidden_contains":["TODO"]}
    {"id":"tool-001","task":"project_tools","language":"en","prompt":"Create Source/HealthComponent.cpp.","expected_tool":"project.create_file"}

Keep benchmark examples separate from training and instruction datasets. Record their source/license and avoid copying held-out examples into training.

## Run

    python cloud/runtime/benchmark.py --model-dir /path/to/extracted-model-bundle --benchmark-jsonl /path/to/held-out-benchmark.jsonl --output /path/to/benchmark-report.json

The report includes overall, task and language pass rates, plus generated samples and reasons for simple rule-based failures. This scoring is a smoke-test only: keyword checks do not prove code correctness, compilability, security, design quality or Unreal compatibility. Human review and actual project builds remain mandatory. There is no automatic model promotion.
