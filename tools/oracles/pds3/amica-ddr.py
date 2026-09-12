#!/usr/bin/env python3
"""pvl, numpy and astropy oracle for a Hayabusa AMICA Gaskell DDR (Itokawa): the
16-band big-endian cube from the gzip, the detector FITS and the flat field;
amica-geo.mts must reproduce the geometry planes exactly and its image as
DN over flat over exposure, with the DDR's vertical reversal of the FITS array.
Usage: .local/oracles/venv/bin/python tools/oracles/pds3/amica-ddr.py
"""
import gzip, sys, warnings
from pathlib import Path
import numpy as np
import pvl
import astropy
from astropy.io import fits
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write, find, label_text
warnings.simplefilter('ignore')

source = ROOT / 'src/planets/itokawa/source/observations'
cube, label_path, original, flat = source / 'st_2402987304_v_ddr.img.gz', source / 'st_2402987304_v_ddr.lbl', source / 'st_2402987304_v.fit', source / 'flat_v.fit'
label = pvl.load(str(label_path)); image = find(label, 'IMAGE')
bands, lines, samples_per_line = int(image['BANDS']), int(image['LINES']), int(image['LINE_SAMPLES'])
data = np.frombuffer(gzip.decompress(cube.read_bytes()), dtype='>f4').reshape(bands, lines, samples_per_line)
null = np.frombuffer(bytes.fromhex('f49dc5ae'), dtype='>f4')[0]
dn = fits.open(str(original))[0].data; response = fits.open(str(flat))[0].data
exposure = float(fits.open(str(original))[0].header['EXP_0'])
names = {0: 'IMAGE', 1: 'COORDINATE_X_IMAGE', 2: 'COORDINATE_Y_IMAGE', 3: 'COORDINATE_Z_IMAGE', 6: 'DISTANCE_IMAGE', 7: 'INCIDENCE_ANGLE_IMAGE', 8: 'EMISSION_ANGLE_IMAGE', 9: 'PHASE_ANGLE_IMAGE'}
planes = {}
for band, name in names.items():
    plane = data[band].astype(np.float64); valid = plane != null
    planes[name] = {'band': band, 'samples': samples(np.where(valid, plane, np.nan), 300 + band, 48, valid), 'nullCount': int((~valid).sum())}
# The DDR image band equals the detector FITS read bottom-up: sample pixels carry the DN, the flat response and the derived value.
rng = np.random.default_rng(377); picks = np.sort(rng.choice(lines * samples_per_line, size=64, replace=False))
pairs = []
for i in picks:
    line, sample = divmod(int(i), samples_per_line); source_line = lines - 1 - line
    d, r = float(dn[source_line, sample]), float(response[source_line, sample])
    pairs.append({'index': int(i), 'ddr': float(data[0, line, sample]), 'dn': d, 'flat': r, 'radiance': (d / r / exposure) if r > 0 and np.isfinite(r) and d != 255 else None})
identity = {key: label_text(find(label, key)) for key in ['DATA_SET_ID', 'INSTRUMENT_ID', 'TARGET_NAME', 'FILTER_NAME', 'START_TIME', 'EXPOSURE_DURATION']}
write('pds3/amica-ddr.json', 'pvl', 'tools/oracles/pds3/amica-ddr.py', {'pvl': pvl.__version__, 'astropy': astropy.__version__}, [cube, label_path, original, flat],
      {'identity': identity, 'cube': {'bands': bands, 'lines': lines, 'samples': samples_per_line, 'nullHex': 'f49dc5ae'}, 'exposure': exposure, 'planes': planes, 'imagePairs': pairs})
