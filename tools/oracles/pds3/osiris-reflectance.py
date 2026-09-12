#!/usr/bin/env python3
"""pvl and numpy oracle for an OSIRIS level-4 reflectance product (Steins, WAC):
image, sigma and quality planes read from their record pointers; the OSIRIS
reflectance decoder in archived-camera.mts must reproduce the samples.
Usage: .local/oracles/venv/bin/python tools/oracles/pds3/osiris-reflectance.py
"""
import sys
from pathlib import Path
import numpy as np
import pvl
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write, find, label_text

path = ROOT / 'src/planets/steins/source/observations/w20080905t183606461id4df17.img'
DTYPES = {'PC_REAL': '<f4', 'LSB_UNSIGNED_INTEGER': 'u1'}
label = pvl.load(str(path)); record = int(find(label, 'RECORD_BYTES')); raw = np.fromfile(str(path), dtype='u1')
planes = {}
for i, name in enumerate(['IMAGE', 'SIGMA_MAP_IMAGE', 'QUALITY_MAP_IMAGE']):
    obj = find(label, name); width, height = int(obj['LINE_SAMPLES']), int(obj['LINES']); dtype = DTYPES[str(obj['SAMPLE_TYPE'])]
    offset = (int(find(label, '^' + name)) - 1) * record
    array = raw[offset: offset + width * height * np.dtype(dtype).itemsize].view(dtype)
    planes[name] = {'width': width, 'height': height, 'sampleType': str(obj['SAMPLE_TYPE']), 'firstLine': int(obj['FIRST_LINE']), 'firstSample': int(obj['FIRST_LINE_SAMPLE']), 'samples': samples(array, 217 + i, 48)}
quality = raw[(int(label['^QUALITY_MAP_IMAGE']) - 1) * record:][: planes['QUALITY_MAP_IMAGE']['width'] * planes['QUALITY_MAP_IMAGE']['height']]
histogram = {str(int(v)): int(c) for v, c in zip(*np.unique(quality, return_counts=True))}
identity = {key: label_text(find(label, key)) for key in ['INSTRUMENT_ID', 'START_TIME', 'FILTER_NAME', 'TARGET_NAME', 'DATA_QUALITY_ID']}
write('pds3/osiris-reflectance.json', 'pvl', 'tools/oracles/pds3/osiris-reflectance.py', {'pvl': pvl.__version__}, [path], {'identity': identity, 'planes': planes, 'qualityHistogram': histogram})
