#!/usr/bin/env python3
"""Astropy WCS pixel mapping for tools/objects/observation/wise-atlas-mosaic.mts atlasToGridPixel.
Run with the pinned oracle environment; never imports the TypeScript mosaic.
The tiny FITS inputs carry AllWISE-atlas-like SIN tile headers and hips2fits-convention TAN grids.
"""
import math, sys
from pathlib import Path
import astropy
from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

directory = ROOT / 'tests/fixtures/fits'
inputs, cases = [], {}
def tile_header(ra, dec):
    h = fits.Header()
    h['CTYPE1'], h['CTYPE2'] = 'RA---SIN', 'DEC--SIN'
    h['CRPIX1'] = h['CRPIX2'] = 2048.0
    h['CDELT1'], h['CDELT2'] = -0.0003819444391411, 0.0003819444391411
    h['CRVAL1'], h['CRVAL2'], h['CROTA2'], h['EQUINOX'] = ra, dec, 0.0, 2000.0
    return h
def grid_header(ra, dec, width, height, fov):
    scale = math.degrees(2 * math.tan(math.radians(fov / 2))) / width
    h = fits.Header()
    h['CTYPE1'], h['CTYPE2'], h['RADESYS'] = 'RA---TAN', 'DEC--TAN', 'ICRS'
    h['CRPIX1'], h['CRPIX2'] = width / 2, height / 2
    h['CDELT1'], h['CDELT2'] = -scale, scale
    h['CRVAL1'], h['CRVAL2'] = ra, dec
    return h
rng = np.random.default_rng(20260916)
for name, tile, grid in [
    ('pleiades-tile', (54.495406, 24.231111), (56.477089, 24.170254, 4007, 3061, 182.98632880788097 / 60)),
    ('lmc-far-corner', (120.5, -78.9), (78.76, -69.19, 6000, 6000, 24.0)),
    ('lmc-centre', (79.1, -69.4), (78.76, -69.19, 6000, 6000, 24.0)),
]:
    path = directory / f'wise-atlas-{name}.fits'
    hdul = fits.HDUList([fits.PrimaryHDU(np.zeros((2, 2), dtype='float32'), header=tile_header(*tile)),
                         fits.ImageHDU(np.zeros((2, 2), dtype='float32'), header=grid_header(*grid), name='GRID')])
    hdul.writeto(path, overwrite=True)
    inputs.append(path)
    with fits.open(path) as opened:
        tile_wcs, grid_wcs = WCS(opened[0].header), WCS(opened[1].header)
        tile_pixels = np.vstack([[1, 1], [4095, 4095], [2048, 2048], [1, 4095], rng.uniform(1, 4095, size=(12, 2))])
        world = tile_wcs.all_pix2world(tile_pixels, 1)
        grid_pixels = grid_wcs.all_world2pix(world, 1)
        cases[name] = {'path': str(path.relative_to(ROOT)), 'tile': list(tile), 'grid': list(grid),
                       'tilePixels': tile_pixels.tolist(), 'gridPixels': grid_pixels.tolist()}
write('fits/wise-atlas-projection.json', 'astropy', 'tools/oracles/fits/wise-atlas-projection.py', {'astropy': astropy.__version__}, inputs, cases)
