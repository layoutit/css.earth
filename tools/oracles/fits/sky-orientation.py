#!/usr/bin/env python3
"""Astropy world coordinates for packages/fits/src/sky.ts skyImageAxes and skyDisplayRaster.
Run with the pinned oracle environment; never imports the TypeScript helper.
Each case is a WCS header for a 3 x 2 image. Astropy's pixel-to-world transform at the reference pixel says which way right ascension and
declination run along columns and rows; the expected display raster puts the northern row first and the eastern column first.
A case whose RA changes along rows, or Dec along columns, is rotated and must be refused. Headers marked `from` copy the WCS cards
of that input verbatim; the rest are written for this oracle. Every case is a header-only IMAGE extension of
tests/fixtures/fits/sky-orientation.fits, and the expectations come from the headers read back from that file.
"""
import math, sys, warnings
from pathlib import Path
import astropy
from astropy.io import fits
from astropy.wcs import WCS, FITSFixedWarning
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

WIDTH, HEIGHT = 3, 2
CASES = [
    ('squeeze-reconstruction', 'src/objects/betelgeuse/source/observations/betelgeuse-matisse-2020-02-continuum-squeeze.fits',
     {'CTYPE1': 'RA', 'CTYPE2': 'DEC', 'CDELT1': -0.78, 'CDELT2': 0.78, 'CRVAL1': 0.0, 'CRVAL2': 0.0, 'CRPIX1': 65, 'CRPIX2': 65}),
    ('hips2fits-tan', 'M8 Spitzer IRAC band from CDS hips2fits (cached by sha256 under .local/nebula-lab/sky-bands/hips2fits)',
     {'CRPIX1': 878.5, 'CRPIX2': 708.5, 'CDELT1': -0.00033889304998681, 'CDELT2': 0.00033889304998682, 'CUNIT1': 'deg', 'CUNIT2': 'deg', 'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRVAL1': 270.92629672565, 'CRVAL2': -24.373393603218, 'LONPOLE': 180.0, 'RADESYS': 'ICRS'}),
    ('zimpol-cd-tan', 'src/objects/psyche/source/observations/d16Psyche_2018-04-28T07_51_11.013_zpl_science_imaging_cam1.fits',
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 512.0, 'CRPIX2': 512.0, 'CRVAL1': 230.50211, 'CRVAL2': -14.02336, 'CD1_1': -1.00833333333333e-06, 'CD2_1': 0.0, 'CD1_2': 0.0, 'CD2_2': 1.00833333333333e-06, 'CUNIT1': 'deg', 'CUNIT2': 'deg', 'EQUINOX': 2000.0}),
    ('linear-east-right', None,
     {'CTYPE1': 'RA', 'CTYPE2': 'DEC', 'CDELT1': 0.5, 'CDELT2': 0.5, 'CRVAL1': 0.0, 'CRVAL2': 0.0, 'CRPIX1': 2, 'CRPIX2': 1.5}),
    ('linear-north-down', None,
     {'CTYPE1': 'RA', 'CTYPE2': 'DEC', 'CDELT1': -0.5, 'CDELT2': -0.5, 'CRVAL1': 0.0, 'CRVAL2': 0.0, 'CRPIX1': 2, 'CRPIX2': 1.5}),
    ('cd-east-right-north-down', None,
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CD1_1': 0.0002, 'CD1_2': 0.0, 'CD2_1': 0.0, 'CD2_2': -0.0003, 'CUNIT1': 'deg', 'CUNIT2': 'deg'}),
    ('pc-negative-diagonal', None,
     {'CTYPE1': 'RA---SIN', 'CTYPE2': 'DEC--SIN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 10.7, 'CRVAL2': 41.3, 'CDELT1': 0.001, 'CDELT2': 0.001, 'PC1_1': -1.0, 'PC1_2': 0.0, 'PC2_1': 0.0, 'PC2_2': 1.0}),
    ('crota2-half-turn', None,
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 201.4, 'CRVAL2': -43.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'CROTA2': 180.0}),
    ('wise-atlas-sin-north', None,
     {'CTYPE1': 'RA---SIN', 'CTYPE2': 'DEC--SIN', 'CRPIX1': 2048.0, 'CRPIX2': 2048.0, 'CRVAL1': 56.477, 'CRVAL2': 64.17, 'CDELT1': -0.0003819444391411, 'CDELT2': 0.0003819444391411, 'CROTA2': 0.0, 'EQUINOX': 2000.0}),
    ('zea-far-south', None,
     {'CTYPE1': 'RA---ZEA', 'CTYPE2': 'DEC--ZEA', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 78.76, 'CRVAL2': -89.2, 'CDELT1': -0.01, 'CDELT2': 0.01}),
    ('tan-across-ra-zero', None,
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 359.99995, 'CRVAL2': 5.0, 'CDELT1': -0.0001, 'CDELT2': 0.0001}),
    ('crota2-thirty', None,
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 201.4, 'CRVAL2': -43.0, 'CDELT1': -0.0002, 'CDELT2': 0.0002, 'CROTA2': 30.0}),
    ('cd-small-skew', None,
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CD1_1': -0.0002, 'CD1_2': 2e-08, 'CD2_1': 0.0, 'CD2_2': 0.0002}),
    ('pc-quarter-turn', None,
     {'CTYPE1': 'RA---TAN', 'CTYPE2': 'DEC--TAN', 'CRPIX1': 2, 'CRPIX2': 1.5, 'CRVAL1': 83.8, 'CRVAL2': 22.0, 'CDELT1': 0.0002, 'CDELT2': 0.0002, 'PC1_1': 0.0, 'PC1_2': -1.0, 'PC2_1': 1.0, 'PC2_2': 0.0}),
]

def angle(a, b):
    """Degrees from a to b, wrapped to (-180, 180]."""
    return (b - a + 180.0) % 360.0 - 180.0

path = ROOT / 'tests/fixtures/fits/sky-orientation.fits'
extensions = []
for name, source, cards in CASES:
    written = fits.Header()
    for key, value in cards.items(): written[key] = value
    written['EXTNAME'] = name
    extensions.append(fits.ImageHDU(header=written))
fits.HDUList([fits.PrimaryHDU(), *extensions]).writeto(path, overwrite=True)

cases = {}
hdus = fits.open(path, memmap=False)
for name, source, cards in CASES:
    header = hdus[name].header
    # The extensions hold headers only; Astropy notes that a two-axis WCS describes no stored pixels, which is intended.
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', FITSFixedWarning)
        wcs = WCS(header)
    celestial = wcs.wcs.lng >= 0
    x0, y0 = header['CRPIX1'] - 1, header['CRPIX2'] - 1
    def world(x, y):
        ra, dec = wcs.all_pix2world([[x, y]], 0)[0]
        return float(ra), float(dec)
    ra0, dec0 = world(x0, y0)
    # Central differences at the reference pixel, per pixel. On the sky an RA step is foreshortened by cos(Dec); linear axes are not.
    shrink = math.cos(math.radians(dec0)) if celestial else 1.0
    # Steps of about 5e-5 degrees: small enough that a projection's curvature near the pole stays below a part in 10^8, large
    # enough that rounding in coordinates of a few hundred degrees stays below one in 10^9 even on ZIMPOL's 3.6 mas pixels.
    coarse = max(abs(angle(ra0, world(x0 + 1, y0)[0])), abs(world(x0, y0 + 1)[1] - dec0), abs(angle(ra0, world(x0, y0 + 1)[0])), abs(world(x0 + 1, y0)[1] - dec0))
    h = min(1000.0, max(0.005, 5e-5 / coarse))
    east_x = angle(world(x0 - h, y0)[0], world(x0 + h, y0)[0]) * shrink / (2 * h)
    north_x = (world(x0 + h, y0)[1] - world(x0 - h, y0)[1]) / (2 * h)
    east_y = angle(world(x0, y0 - h)[0], world(x0, y0 + h)[0]) * shrink / (2 * h)
    north_y = (world(x0, y0 + h)[1] - world(x0, y0 - h)[1]) / (2 * h)
    size = min(abs(east_x), abs(north_y))
    entry = {**({'from': source} if source else {}), 'derivatives': [east_x, north_x, east_y, north_y]}
    if size == 0 or abs(north_x) > 1e-6 * size or abs(east_y) > 1e-6 * size:
        entry['refused'] = True
    else:
        values = np.arange(1, WIDTH * HEIGHT + 1, dtype=np.float64).reshape(HEIGHT, WIDTH)  # FITS order, first stored row first
        display = values[::-1] if north_y > 0 else values
        display = display[:, ::-1] if east_x > 0 else display
        entry.update({'eastRight': bool(east_x > 0), 'northUp': bool(north_y > 0), 'scale': [abs(east_x), abs(north_y)],
                      'values': [float(v) for v in values.reshape(-1)], 'display': [float(v) for v in display.reshape(-1)]})
    cases[name] = entry
write('fits/sky-orientation.json', 'astropy', 'tools/oracles/fits/sky-orientation.py', {'astropy': astropy.__version__}, [path], cases)
