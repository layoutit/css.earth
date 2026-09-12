#!/usr/bin/env python3
"""pvl and numpy oracle for the OSIRIS level-5 geometry product and its level-4
quality companion (67P): the PDS3 label is parsed by pvl, every plane is read
from its record pointer with numpy, and a sample of values per plane becomes a
fixture that osiris-geo.mts must reproduce exactly.
Usage: .local/oracles/venv/bin/python tools/oracles/pds3/osiris-geo.py
"""
import sys
from pathlib import Path
import numpy as np
import pvl
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write, find, label_text

source = ROOT / 'src/planets/comet-67p/source/observations'
geo, quality = source / 'n20140805t194314611id50f22.IMG', source / 'n20140805t194314611id40f22.IMG'
DTYPES = {'PC_REAL': '<f4', 'LSB_INTEGER': '<i4', 'LSB_UNSIGNED_INTEGER': 'u1'}

def planes_of(path, names, seed):
    label = pvl.load(str(path)); record = int(find(label, 'RECORD_BYTES'))
    raw = np.fromfile(str(path), dtype='u1')
    out = {}
    for i, name in enumerate(names):
        obj = find(label, name); width, height = int(obj['LINE_SAMPLES']), int(obj['LINES'])
        dtype = DTYPES[str(obj['SAMPLE_TYPE'])]; offset = (int(find(label, '^' + name)) - 1) * record
        array = raw[offset: offset + width * height * np.dtype(dtype).itemsize].view(dtype)
        out[name] = {'width': width, 'height': height, 'sampleType': str(obj['SAMPLE_TYPE']), 'unit': str(obj.get('UNIT')), 'samples': samples(array, seed + i, 48)}
    return label, out

geo_label, geo_planes = planes_of(geo, ['IMAGE', 'DISTANCE_IMAGE', 'EMISSION_ANGLE_IMAGE', 'INCIDENCE_ANGLE_IMAGE', 'PHASE_ANGLE_IMAGE', 'FACET_INDEX_IMAGE', 'COORDINATE_X_IMAGE', 'COORDINATE_Y_IMAGE', 'COORDINATE_Z_IMAGE'], 67)
quality_label, quality_planes = planes_of(quality, ['IMAGE', 'SIGMA_MAP_IMAGE', 'QUALITY_MAP_IMAGE'], 167)
record = int(find(quality_label, 'RECORD_BYTES')); obj = find(quality_label, 'QUALITY_MAP_IMAGE')
flags = np.fromfile(str(quality), dtype='u1')[(int(find(quality_label, '^QUALITY_MAP_IMAGE')) - 1) * record:][: int(obj['LINE_SAMPLES']) * int(obj['LINES'])]
histogram = {str(int(v)): int(c) for v, c in zip(*np.unique(flags, return_counts=True))}
sigma_object = find(quality_label, 'SIGMA_MAP_IMAGE')
sigma = np.fromfile(str(quality), dtype='u1')[(int(find(quality_label, '^SIGMA_MAP_IMAGE')) - 1) * record:][: int(sigma_object['LINE_SAMPLES']) * int(sigma_object['LINES']) * 4].view('<f4')
finite_sigma = int(np.isfinite(sigma).sum())
identity = {key: label_text(find(geo_label, key)) for key in ['INSTRUMENT_ID', 'START_TIME', 'FILTER_NAME', 'TARGET_NAME', 'PRODUCT_ID']}
write('pds3/osiris-geo.json', 'pvl', 'tools/oracles/pds3/osiris-geo.py', {'pvl': pvl.__version__}, [geo, quality],
      {'identity': identity, 'geometry': geo_planes, 'quality': quality_planes, 'qualityHistogram': histogram, 'finiteSigmaPixels': finite_sigma})
