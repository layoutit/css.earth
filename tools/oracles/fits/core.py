#!/usr/bin/env python3
"""Independent Astropy FITS conformance inputs and decoded expectations.
Run with the pinned oracle environment; never imports the TypeScript reader.
Generated binary inputs are tiny, checked-in test data, not pipeline assets.
"""
import sys
from pathlib import Path
import astropy
from astropy.io import fits
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

directory = ROOT / 'tests/fixtures/fits'
directory.mkdir(parents=True, exist_ok=True)
inputs, cases = [], {}
for name, dtype, raw in [
    ('byte', 'uint8', [0, 128, 255, 1]),
    ('scaled-blank', 'int16', [-32768, 0, 1, -2]),
    ('signed-int32', 'int32', [-2147483648, -1, 0, 2147483647]),
    ('float32', 'float32', [-1.25, 0, 2.5, np.nan]),
    ('float64', 'float64', [-1e100, 0, 2.5e-100, np.nan]),
    ('cube', 'float32', list(range(12))),
    ('eso-hierarchy', 'float64', [1, -2, 0, 7.5]),
    ('long-string', 'float32', [3.5, -0.25, np.nan, 0]),
]:
    data = np.array(raw, dtype=dtype).reshape((3, 2, 2) if name == 'cube' else (2, 2))
    hdu = fits.PrimaryHDU(data)
    hdu.header['BUNIT'] = 'W/(m^2*sr*um)'
    hdu.header['OBSERVER'] = "O'Brien / field"
    hdu.header['UNUSED'] = None
    if name == 'eso-hierarchy':
        hdu.header['HIERARCH ESO OBS AIRM'] = 2.0
        hdu.header['HIERARCH ESO INS NAME'] = "O'Brien / field"
        hdu.header['HIERARCH ESO DET ACTIVE'] = True
    if name == 'long-string':
        # Astropy writes values longer than one card with the CONTINUE convention.
        hdu.header['CPYRIGHT'] = "IPAC/NASA - http://wise2.ipac.caltech.edu/docs/release/allwise/expsup/sec1_6b.html & O'Brien / field"
    if name == 'scaled-blank':
        hdu.header['BSCALE'] = 2
        hdu.header['BZERO'] = -2
        hdu.header['BLANK'] = -32768
    path = directory / f'{name}.fits'
    hdu.writeto(path, overwrite=True)
    inputs.append(path)
    with fits.open(path, memmap=False) as hdus:
        values = hdus[0].data.reshape(-1)
        cases[name] = {'path': str(path.relative_to(ROOT)), 'dimensions': list(reversed(hdus[0].data.shape)),
                       'values': [float(v) if np.isfinite(v) else None for v in values],
                       'units': hdus[0].header['BUNIT'], 'observer': hdus[0].header['OBSERVER']}
        if name == 'long-string':
            cases[name]['longString'] = hdus[0].header['CPYRIGHT']
        if name == 'eso-hierarchy':
            cases[name]['hierarchy'] = {card.keyword: card.value for card in hdus[0].header.cards if card.keyword.startswith('ESO ')}

# Empty primary + a named scaled IMAGE extension is a different, supported HDU layout.
path = directory / 'extensions.fits'
image = fits.ImageHDU(np.array([[-32768, -1], [0, 32767]], dtype='int16'), name='QUALITY')
image.header['BZERO'] = 32768
fits.HDUList([fits.PrimaryHDU(), image]).writeto(path, overwrite=True)
inputs.append(path)
with fits.open(path, memmap=False) as hdus:
    cases['extensions'] = {'path': str(path.relative_to(ROOT)), 'dimensions': [2, 2],
                           'values': [int(v) for v in hdus[1].data.reshape(-1)], 'extension': 1}
write('fits/core.json', 'astropy', 'tools/oracles/fits/core.py', {'astropy': astropy.__version__}, inputs, cases)
