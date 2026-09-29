"""Shared fixture writing for the Python oracles: inputs with their sizes, tool versions, deterministic value samples."""
import json, platform, sys
from pathlib import Path
import numpy as np

ROOT = next(parent for parent in Path(__file__).resolve().parents if (parent / "pnpm-workspace.yaml").is_file())

def input_record(path):
    path = Path(path)
    return {'path': str(path.resolve().relative_to(ROOT)), 'bytes': path.stat().st_size}

def samples(array, seed, count=48, valid=None):
    """Deterministic sample of flat indices and values; `valid` masks which pixels count as data."""
    flat = np.asarray(array).reshape(-1)
    mask = np.isfinite(flat) if valid is None else valid.reshape(-1)
    rng = np.random.default_rng(seed)
    picks = np.flatnonzero(mask)
    chosen = np.sort(rng.choice(picks, size=min(count, len(picks)), replace=False)) if len(picks) else np.array([], dtype=int)
    return [{'index': int(i), 'value': float(flat[i])} for i in chosen]

def external_record(url, data):
    """A reference outside the repository, named by a commit in its URL and by its size."""
    return {'url': url, 'bytes': len(data)}

def write(name, oracle, generated_by, tool, inputs, cases, references=()):
    fixture = {'schema': 'cssearth-oracle-fixture@1', 'oracle': oracle, 'generatedBy': generated_by,
               'tool': {**tool, 'python': platform.python_version(), 'numpy': np.__version__},
               'inputs': [input_record(p) for p in inputs], **({'references': list(references)} if references else {}), 'cases': cases}
    relocated = {'sbmt/projection.json': 'packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.json', 'spice/dart-draco.json': 'packages/bake/src/astronomy/fixtures/dart-draco.json', 'spice/new-horizons-approach.json': 'packages/bake/src/objects/default-view/fixtures/new-horizons-approach.json', 'eclipse-map/numerics.json': 'packages/bake/src/objects/raster/eclipse-map/fixtures/numerics.json', 'eclipse-map/theresa-eigenbasis.json': 'packages/bake/src/objects/raster/eclipse-map/fixtures/theresa-eigenbasis.json', 'fits/binary-table.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/binary-table.json', 'fits/charon-leisa.json': 'packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.json', 'fits/core.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/core.json', 'fits/encounter.json': 'packages/bake/src/objects/layers/terrestrial/missions/encounter.json', 'fits/llorri.json': 'packages/bake/src/objects/layers/terrestrial/missions/llorri.json', 'fits/lupton-asinh.json': 'packages/bake/src/objects/color/fixtures/lupton-asinh.json', 'fits/pallas.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/pallas.json', 'fits/rice.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/rice.json', 'fits/sky-orientation.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/sky-orientation.json', 'fits/sky-projection.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/sky-projection.json', 'fits/synoptic.json': 'packages/bake/src/objects/layers/observation/fixtures/fits/synoptic.json', 'fits/wise-atlas-projection.json': 'packages/bake/src/objects/raster/fixtures/wise-atlas-projection.json'}
    out = ROOT / relocated.get(name, "tests/oracles/" + name)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fixture, indent=1) + '\n')
    print(json.dumps({'written': str(out.relative_to(ROOT)), 'cases': {k: (len(v) if hasattr(v, '__len__') else v) for k, v in cases.items()}}))
    return out

def find(node, key):
    """The unique value of `key` anywhere in a nested PVL label, as the pipeline's line-based readers see it."""
    hits = []
    def walk(n):
        for k, v in n.items():
            if k == key: hits.append(v)
            if hasattr(v, 'items'): walk(v)
    walk(node)
    if len(hits) != 1: raise KeyError(f'{key}: {len(hits)} occurrences')
    return hits[0]

def label_text(value):
    """A label value as its label text: pvl parses dates into datetimes, which the pipeline's readers keep as text."""
    import datetime, re
    if isinstance(value, datetime.datetime):
        text = value.replace(tzinfo=None).isoformat()
        return re.sub(r'\.(\d*?)0+$', lambda m: '.' + m.group(1) if m.group(1) else '', text)
    return str(value)
