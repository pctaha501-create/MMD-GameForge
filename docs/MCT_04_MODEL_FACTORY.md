# MCT-04 — Model Factory and Experiment Registry

Create reproducible first-party model configurations and measure their parameter and lower-bound optimizer memory costs before requesting a GPU.

## Create a profile

```bash
python cloud/runtime/model_factory.py create --profile multilingual-tiny --output cloud/configs/mmd-multilingual-tiny.json
python cloud/runtime/model_factory.py estimate --config cloud/configs/mmd-multilingual-tiny.json
```

Profiles: multilingual-tiny, multilingual-pilot, code-tiny, game-design-tiny. Every generated profile starts from random weights and disables paid fallback. Domain profiles are architecture/configuration starting points, not trained specialist models.

Memory output is a lower bound: activations, CUDA workspace, allocator fragmentation, and framework overhead are additional. It must not be treated as a VRAM fit guarantee.

## Register an experiment

```bash
python cloud/runtime/experiment_registry.py --db mmd-experiments.sqlite3 register --name multilingual-pilot-r1 --config cloud/configs/mmd-multilingual-pilot.json --provenance /path/to/provenance.json --commit abcdef012345 --status completed --artifact /path/to/checkpoint.pt --metric validation:loss:2.31:500
python cloud/runtime/experiment_registry.py --db mmd-experiments.sqlite3 list
```

SQLite stores config hash, dataset revision, source commit, status, metrics and artifact SHA-256 hashes. It does not mark a model production-ready. Release promotion requires a separate benchmark and safety review; no automatic promotion is implemented.
