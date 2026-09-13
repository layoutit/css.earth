#!/usr/bin/env python3
"""pds4_tools oracle for the DRACO geometry cube: NASA's PDS4 reader decodes every
label-defined plane from its byte offset, and a sample of values per plane becomes
a fixture that the pds4-geometry-cube decoder must reproduce exactly. Oracles
verify; they never produce pipeline inputs.
Usage: .local/oracles/venv/bin/python tools/oracles/pds/dart-draco-cube.py
"""
import sys
from pathlib import Path
import numpy as np
import pds4_tools
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT as root, write
source = root / 'src/planets/dimorphos/source'
label = source / 'observations/dart_0401930040_12262_01_geo.xml'
fits = source / 'observations/dart_0401930040_12262_01_geo.fits'
structures = pds4_tools.read(str(label), quiet=True)
rng = np.random.default_rng(20220926)
planes = {}
for structure in structures:
    array = np.asarray(structure.data)
    if array.ndim != 2:
        continue
    height, width = array.shape
    flat = array.reshape(-1).astype(np.float64)
    # Special constants: the image plane flags with 1e10, -1e10 and 1e9; the geometry planes with -999.
    valid = np.isfinite(flat) & (np.abs(flat) < 1e8) & (flat != -999)
    on_body, flagged = np.flatnonzero(valid), np.flatnonzero(~valid)
    picks = np.sort(rng.choice(on_body, size=min(48, len(on_body)), replace=False)) if len(on_body) else np.array([], dtype=int)
    extremes = np.sort(rng.choice(flagged, size=min(8, len(flagged)), replace=False)) if len(flagged) else np.array([], dtype=int)
    planes[structure.id] = {'width': int(width), 'height': int(height), 'dataType': str(structure.data.dtype),
        'samples': [{'index': int(i), 'value': float(flat[i])} for i in np.concatenate([picks, extremes])],
        'onBodyCount': int(len(on_body)), 'sum': float(flat[on_body].sum()) if len(on_body) else 0.0}
write('pds/dart-draco-cube.json', 'pds4_tools', 'tools/oracles/pds/dart-draco-cube.py', {'pds4_tools': pds4_tools.__version__}, [fits, label], {'planes': planes})
