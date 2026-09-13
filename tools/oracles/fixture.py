"""Shared fixture writing for the Python oracles: inputs with sha256, tool versions, deterministic value samples."""
import hashlib, json, platform, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()

def input_record(path):
    path = Path(path)
    return {'path': str(path.resolve().relative_to(ROOT)), 'sha256': sha256(path), 'bytes': path.stat().st_size}

def samples(array, seed, count=48, valid=None):
    """Deterministic sample of flat indices and values; `valid` masks which pixels count as data."""
    flat = np.asarray(array).reshape(-1)
    mask = np.isfinite(flat) if valid is None else valid.reshape(-1)
    rng = np.random.default_rng(seed)
    picks = np.flatnonzero(mask)
    chosen = np.sort(rng.choice(picks, size=min(count, len(picks)), replace=False)) if len(picks) else np.array([], dtype=int)
    return [{'index': int(i), 'value': float(flat[i])} for i in chosen]

def external_record(url, data):
    """A reference outside the repository, pinned by a commit in its URL and by its bytes."""
    return {'url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}

def write(name, oracle, generated_by, tool, inputs, cases, references=()):
    fixture = {'schema': 'cssearth-oracle-fixture@1', 'oracle': oracle, 'generatedBy': generated_by,
               'tool': {**tool, 'python': platform.python_version(), 'numpy': np.__version__},
               'inputs': [input_record(p) for p in inputs], **({'references': list(references)} if references else {}), 'cases': cases}
    out = ROOT / 'tests/oracles' / name
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
