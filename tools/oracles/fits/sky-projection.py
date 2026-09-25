#!/usr/bin/env python3
"""Astropy pixel <-> world for packages/fits/src/sky.ts skyProjection, and region values for packages/fits/src/node/file.ts readFitsFileRegion.
Run with the pinned oracle environment; never imports the TypeScript helper.
Each case is a TAN or plain SIN header, rotated or not. For deterministic sky points near the reference, Astropy's all_world2pix (origin 0)
gives the expected zero-based pixels, and all_pix2world the expected directions of deterministic pixels. Headers marked `from`
copy the WCS cards of that product verbatim; the rest are written for this oracle. Cases with distortion, a slant SIN or another projection
are refused by the helper and only recorded. Every case is an IMAGE extension of tests/fixtures/fits/sky-projection.fits; the
`sci` extension also carries a small float32 image whose region values the file reader must return.
"""
import sys
from pathlib import Path
import astropy
from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

JWST_F187N = ('JWST NIRCam F187N level-3 mosaic of NGC 3132, programme 2733 (jw02733-o001_t001_nircam_clear-f187n_i2d.fits, SCI extension)',
    {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CUNIT1': 'deg', 'CUNIT2': 'deg', 'RADESYS': 'ICRS',
     'CRPIX1': 2466.1226697446295, 'CRPIX2': 2430.6515446961416, 'CRVAL1': 151.75703008261107, 'CRVAL2': -40.43664687371786,
     'CDELT1': 8.53979982278119e-06, 'CDELT2': 8.53979982278119e-06,
     'PC1_1': 0.3800667721687736, 'PC1_2': 0.9249590524413551, 'PC2_1': 0.9249590524413551, 'PC2_2': -0.3800667721687736})
ALMA_SIN = ('ALMA pipeline continuum image of PDS 70, project 2018.A.00030.S (member.uid___A001_X13b4_Xb1.PDS_70_sci.spw19_23_25_27.cont.I.pbcor.fits, primary HDU, celestial axes)',
    {'CTYPE1': 'RA---SIN', 'CTYPE2': 'DEC--SIN', 'CUNIT1': 'deg', 'CUNIT2': 'deg', 'RADESYS': 'ICRS', 'LONPOLE': 180.0, 'LATPOLE': -41.39806682174,
     'CRPIX1': 769.0, 'CRPIX2': 769.0, 'CRVAL1': 212.0420926751, 'CRVAL2': -41.39806682174,
     'CDELT1': -2.416666669157e-06, 'CDELT2': 2.416666669157e-06, 'PC1_1': 1.0, 'PC1_2': 0.0, 'PC2_1': 0.0, 'PC2_2': 1.0, 'PV2_1': 0.0, 'PV2_2': 0.0})
CASES = [
    ('jwst-nircam-rotated', JWST_F187N[0], JWST_F187N[1]),
    ('crota2-thirty', None, {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 50.5, 'CRPIX2': 40.5, 'CRVAL1': 201.4, 'CRVAL2': -43.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'CROTA2': 30.0}),
    ('cd-skewed', None, {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 10.0, 'CRPIX2': -5.0, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CD1_1': -0.0002, 'CD1_2': 0.00003, 'CD2_1': -0.00001, 'CD2_2': 0.00021}),
    ('pc-quarter-turn-east-right', None, {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': 0.0002, 'CDELT2': 0.0002, 'PC1_1': 0.0, 'PC1_2': -1.0, 'PC2_1': 1.0, 'PC2_2': 0.0}),
    ('tan-across-ra-zero', None, {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 359.99995, 'CRVAL2': 5.0, 'CDELT1': -0.0001, 'CDELT2': 0.0001}),
    ('alma-pipeline-sin', ALMA_SIN[0], ALMA_SIN[1]),
    ('sin-rotated-wide', None, {'CTYPE1': 'RA---SIN', 'CTYPE2': 'DEC--SIN', 'CRPIX1': 50.5, 'CRPIX2': 40.5, 'CRVAL1': 201.4, 'CRVAL2': -43.0, 'CDELT1': -0.002, 'CDELT2': 0.002, 'CROTA2': 30.0}),
    ('tan-near-pole-wide', None, {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 500, 'CRPIX2': 500, 'CRVAL1': 37.95, 'CRVAL2': 88.9, 'CDELT1': -0.001, 'CDELT2': 0.001, 'PC1_1': 0.8, 'PC1_2': -0.6, 'PC2_1': 0.6, 'PC2_2': 0.8}),
]
REFUSED = [
    ('sip-distortion', {'CTYPE1': 'RA---TAN-SIP', 'CTYPE2': 'DEC--TAN-SIP', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'A_ORDER': 2, 'B_ORDER': 2, 'A_2_0': 1e-6, 'B_0_2': 1e-6}),
    ('tpv-distortion', {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'PV1_1': 1.0, 'PV2_1': 1.0}),
    ('sin-slant', {'CTYPE1': 'RA---SIN', 'CTYPE2': 'DEC--SIN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'PV2_1': 0.1, 'PV2_2': 0.0}),
    ('arc-projection', {'CTYPE1': 'RA---ARC', 'CTYPE2': 'DEC--ARC', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002}),
    ('fk4-frame', {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'RADESYS': 'FK4', 'EQUINOX': 1950.0}),
]
SCI_WIDTH, SCI_HEIGHT = 7, 5
REGION = {'x0': 2, 'y0': 1, 'width': 4, 'height': 3}

path = ROOT / 'tests/fixtures/fits/sky-projection.fits'
extensions = []
for name, source, cards in CASES + [(n, None, c) for n, c in REFUSED]:
    header = fits.Header()
    for key, value in cards.items(): header[key] = value
    header['EXTNAME'] = name
    extensions.append(fits.ImageHDU(header=header))
# A small science image behind an unrelated extension, as in a JWST product: the reader must seek past the others.
rng = np.random.default_rng(3132)
sci = rng.normal(10, 3, size=(SCI_HEIGHT, SCI_WIDTH)).astype('>f4')
sci[2, 3] = np.nan
sci_header = fits.Header()
for key, value in JWST_F187N[1].items(): sci_header[key] = value
sci_header['BUNIT'] = 'MJy/sr'
extensions.append(fits.ImageHDU(data=sci, header=sci_header, name='SCI'))
extensions.append(fits.ImageHDU(data=np.ones((2, 2), dtype='>i2'), name='CON'))
fits.HDUList([fits.PrimaryHDU(), *extensions]).writeto(path, overwrite=True)

cases, refused = {}, []
hdus = fits.open(path, memmap=False)
rng = np.random.default_rng(7)
for name, source, _ in CASES:
    wcs = WCS(hdus[name].header)
    x0, y0 = hdus[name].header['CRPIX1'] - 1, hdus[name].header['CRPIX2'] - 1
    # Pixels around the reference, out to a few thousand pixels, and the sky directions Astropy gives them; then sky points
    # offset from those directions, and the pixels Astropy gives back.
    pixels = np.column_stack([x0 + rng.uniform(-2500, 2500, 12), y0 + rng.uniform(-2500, 2500, 12)])
    if name == 'tan-near-pole-wide': pixels = np.column_stack([x0 + rng.uniform(-400, 400, 12), y0 + rng.uniform(-400, 400, 12)])
    world = wcs.all_pix2world(pixels, 0)
    shifted = world + np.column_stack([rng.uniform(-1e-3, 1e-3, 12), rng.uniform(-1e-3, 1e-3, 12)])
    shifted[:, 0] %= 360.0
    back = wcs.all_world2pix(shifted, 0, tolerance=1e-12)
    cases[name] = {**({'from': source} if source else {}),
                   'pixelToSky': [{'pixel': [float(p[0]), float(p[1])], 'sky': [float(w[0]), float(w[1])]} for p, w in zip(pixels, world)],
                   'skyToPixel': [{'sky': [float(w[0]), float(w[1])], 'pixel': [float(p[0]), float(p[1])]} for w, p in zip(shifted, back)],
                   'scaleArcsec': float(np.sqrt(abs(np.linalg.det(wcs.pixel_scale_matrix))) * 3600)}
for name, _ in REFUSED: refused.append(name)
values = hdus['SCI'].data.astype(np.float64)
r = REGION
region = values[r['y0']:r['y0'] + r['height'], r['x0']:r['x0'] + r['width']]
cases['region'] = {**r, 'extension': 'SCI', 'values': [None if np.isnan(v) else float(v) for v in region.reshape(-1)]}
cases['refused'] = refused
write('fits/sky-projection.json', 'astropy', 'tools/oracles/fits/sky-projection.py', {'astropy': astropy.__version__}, [path], cases)
