#!/usr/bin/env python3
"""numpy oracle for the .npy longitude/latitude grids of the Cambioni et al. (2022) ALMA maps of Psyche: numpy.load
reads each array; npy-lonlat-grid.mts must reproduce the shapes, the missing-node counts and sampled values, and the
node each sampled longitude and latitude falls in.
Usage: .local/oracles/venv/bin/python tools/oracles/npy/psyche-alma.py
"""
import sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write

source = ROOT / 'src/objects/psyche/source/thermal'
names = ['ThermalInertia_BestFitValue', 'DielectricConstant_BestFitValue', 'LongitudeArray', 'LatitudeArray']
paths = [source / f'{name}.npy' for name in names]
arrays = {name: np.load(path) for name, path in zip(names, paths)}
lon, lat = arrays['LongitudeArray'].astype(float), arrays['LatitudeArray'].astype(float)
cases = {'arrays': {}, 'nodes': []}
for k, name in enumerate(names):
    a = arrays[name]
    cases['arrays'][name] = {'dtype': a.dtype.str, 'shape': list(a.shape), 'missing': int(np.isnan(a).sum()) if a.dtype.kind == 'f' else 0,
                             'samples': samples(a.astype(float), 700 + k, 64)}
# Nearest-node lookups at deterministic longitudes and latitudes, with no frame transfer. Longitude is first brought into
# [-180, 180); the grid repeats that meridian as its -180 and 180 nodes, so each keeps its own half-cell.
rng = np.random.default_rng(799)
values = arrays['ThermalInertia_BestFitValue']
for longitude, latitude in zip(rng.uniform(-360, 360, 96), rng.uniform(-90, 90, 96)):
    column = int(np.argmin(np.abs(((longitude + 180) % 360 - 180) - lon)))
    row = int(np.argmin(np.abs(latitude - lat)))
    value = values[row, column]
    cases['nodes'].append({'longitude': float(longitude), 'latitude': float(latitude), 'row': row,
                           'value': None if np.isnan(value) else float(value)})
write('npy/psyche-alma.json', 'numpy', 'tools/oracles/npy/psyche-alma.py', {}, paths, cases)
