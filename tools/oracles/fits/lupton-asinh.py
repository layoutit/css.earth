#!/usr/bin/env python3
"""Astropy make_lupton_rgb bytes for tools/objects/color-transfer.mts encodeAsinhBands.
Run with the pinned oracle environment; never imports the TypeScript encoder.
The float64 band cube is tiny, checked-in test data, not a pipeline asset.
"""
import sys
from pathlib import Path
import astropy
from astropy.io import fits
from astropy.visualization import make_lupton_rgb
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

rng = np.random.default_rng(20260916)
# Red, green, blue planes in MJy/sr-like units: faint noise around zero, nebula-like
# lognormal emission, saturated knots and extreme band ratios.
bands = rng.lognormal(mean=0.0, sigma=1.6, size=(3, 12, 12)) * rng.choice([1, 1, 1, 30], size=(1, 12, 12))
bands[:, 0, :] = rng.normal(0, 0.2, size=(3, 12))
bands[:, 1, 0:4] = [[0, 0, 5, 50], [0, 3, 0, 0.5], [0, 0, 0, 500]]
bands[1, 2, 5] = np.nan
path = ROOT / 'tests/fixtures/fits/lupton-bands.fits'
fits.PrimaryHDU(bands).writeto(path, overwrite=True)

with fits.open(path, memmap=False) as hdus:
    r, g, b = (np.asarray(plane, dtype=np.float64) for plane in hdus[0].data)
valid = np.isfinite(r) & np.isfinite(g) & np.isfinite(b)
cases = {}
for name, minimum, stretch, q, planes in [
    ('default', 0.0, 5.0, 8.0, (r, g, b)),
    ('background', 0.4, 20.0, 10.0, (r, g, b)),
    ('soft', -0.1, 2.0, 0.5, (r, g, b)),
    ('monochrome', 0.2, 12.0, 6.0, (g, g, g)),
]:
    safe = [np.where(valid, p, 0.0) for p in planes]
    rgb = make_lupton_rgb(*safe, minimum=minimum, stretch=stretch, Q=q)
    cases[name] = {'minimum': minimum, 'stretch': stretch, 'softening': q, 'monochrome': name == 'monochrome',
                   'missing': [int(i) for i in np.flatnonzero(~valid)],
                   'bytes': [int(v) for v in np.where(valid[..., None], rgb, 0).reshape(-1)]}
write('fits/lupton-asinh.json', 'astropy', 'tools/oracles/fits/lupton-asinh.py', {'astropy': astropy.__version__}, [path], cases)
