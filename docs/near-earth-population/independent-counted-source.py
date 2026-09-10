"""Counted DAMIT input adapter for the established independent source verifier.
Only file parsing differs; closest-point plane/edge projection is imported intact.
"""
import sys, json, hashlib, importlib.util
from pathlib import Path
import numpy as np
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('source_surface_oracle', 'tools/objects/terrestrial-layers/verify-source-surface.py')
_oracle = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_oracle)
closest = _oracle.closest
hits = _oracle.hits

def read_mesh(body_id):
    root = Path('src/planets') / body_id / 'source'
    config = json.loads((root / 'preparation/terrestrial.json').read_text())
    spec = config['geometry']['radialTerrain']
    assert spec['format'] == 'pds-plate-model'
    path = root / spec['path']
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    entry = next(x for x in json.loads((root / 'manifest.json').read_text())['inputs'] if x['path'] == spec['path'])
    assert sha == entry['expectedSha256']
    lines = [line.split() for line in raw.decode().splitlines() if line.strip()]
    nv, nf = map(int, lines[0])
    assert (nv, nf) == (spec['grid']['expectedVertices'], spec['grid']['expectedFaces'])
    assert len(lines) == 1 + nv + nf
    vertices = np.asarray(lines[1:1+nv], dtype=np.float64)
    faces = np.asarray(lines[1+nv:], dtype=np.int32) - spec['grid']['indexBase']
    assert vertices.shape == (nv,3) and faces.shape == (nf,3)
    assert np.isfinite(vertices).all() and faces.min() >= 0 and faces.max() < nv
    vertices *= spec['grid']['metersPerUnit']
    return vertices, faces, config, sha
