#!/usr/bin/env python3
"""Astropy RICE_1 tile compression and helioprojective WCS for packages/fits/src/rice.ts and
tools/objects/observation/hmi-continuum.mts. Run with the pinned oracle environment; never imports
the TypeScript readers. The compressed images are tiny, checked-in test data, not pipeline assets.
"""
import json, sys
from pathlib import Path
import astropy
from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

rng = np.random.default_rng(20260918)
directory = ROOT / 'tests/fixtures/fits'
directory.mkdir(parents=True, exist_ok=True)
inputs, cases = [], {}

def image(dtype, low, high):
    # Rows exercise each Rice block kind: a constant run (zero-entropy blocks), a slow ramp (small
    # differences), full-range noise (the directly coded high-entropy blocks) and a mixed row.
    width = 97
    rows = [np.full(width, low + 3), np.arange(width) // 5 + low + 10,
            rng.integers(low, high, width, endpoint=True), np.concatenate([np.full(40, high), rng.integers(low, high, width - 40, endpoint=True)])]
    return np.array(rows, dtype=dtype)

for name, dtype, low, high, scaled in [('rice-int16', 'int16', -32767, 32767, True), ('rice-uint8', 'uint8', 0, 255, False), ('rice-int32', 'int32', -2**31 + 1, 2**31 - 1, False)]:
    data = image(dtype, low, high)
    path = directory / f'{name}.fits'
    if scaled:
        # JSOC's layout: raw int16 compressed under BSCALE and BZERO, with BLANK = -32768 on the compressed table.
        data[0, 5:9] = -32768
        hdu = fits.CompImageHDU(data.astype('float64') * 3.33333333333333e-05 + 1.0, compression_type='RICE_1', tile_shape=(1, data.shape[1]))
        hdu.scale('int16', bscale=3.33333333333333e-05, bzero=1.0)
        fits.HDUList([fits.PrimaryHDU(), hdu]).writeto(path, overwrite=True)
        with fits.open(path, memmap=False, disable_image_compression=True) as hdus:
            hdus[1].header['BLANK'] = -32768
            hdus.writeto(path, overwrite=True)
    else:
        fits.HDUList([fits.PrimaryHDU(), fits.CompImageHDU(data, compression_type='RICE_1', tile_shape=(1, data.shape[1]))]).writeto(path, overwrite=True)
    inputs.append(path)
    with fits.open(path, memmap=False, do_not_scale_image_data=True) as hdus:
        raw = np.asarray(hdus[1].data)
    with fits.open(path, memmap=False) as hdus:
        physical = np.asarray(hdus[1].data, dtype='float64')
    with fits.open(path, memmap=False, disable_image_compression=True) as hdus:
        table = hdus[1].header
    cases[name] = {'path': str(path.relative_to(ROOT)), 'width': int(raw.shape[1]), 'height': int(raw.shape[0]),
                   'raw': [int(v) for v in raw.reshape(-1)], 'physical': [float(v) if np.isfinite(v) else None for v in physical.reshape(-1)],
                   'bscale': float(table.get('BSCALE', 1)), 'bzero': float(table.get('BZERO', 0)), 'blank': table.get('BLANK'),
                   'bytePix': int(np.dtype(dtype).itemsize), 'zcmptype': table['ZCMPTYPE']}

# The pinned JSOC keywords of the first mosaic frame, through astropy.wcs (CROTA2 as written by JSOC).
keywords = ROOT / 'src/objects/sun/source/hmi/continuum/keywords.json'
inputs.append(keywords)
response = json.loads(keywords.read_text())
values = {entry['name']: entry['values'] for entry in response['keywords']}
record = '2026.05.13_00:00:00_TAI'
index = values['T_REC'].index(record)
header = fits.Header()
for key in ['CTYPE1', 'CTYPE2', 'CUNIT1', 'CUNIT2']: header[key] = values[key][index]
for key in ['CRPIX1', 'CRPIX2', 'CRVAL1', 'CRVAL2', 'CDELT1', 'CDELT2', 'CROTA2']: header[key] = float(values[key][index])
header['NAXIS'], header['NAXIS1'], header['NAXIS2'] = 2, 4096, 4096
wcs = WCS(header)
points = [(0.0, 0.0), (500.0, 0.0), (0.0, 500.0), (-700.0, 300.0), (900.0, -200.0), (-100.0, -940.0)]
pixels = []
for west, north in points:
    x, y = wcs.world_to_pixel_values(west / 3600, north / 3600)
    pixels.append({'west': west, 'north': north, 'x': float(x) + 1, 'y': float(y) + 1})
cases['hmi-wcs'] = {'record': record, 'pixels': pixels}

write('fits/rice.json', 'astropy', 'tools/oracles/fits/rice.py', {'astropy': astropy.__version__}, inputs, cases)
