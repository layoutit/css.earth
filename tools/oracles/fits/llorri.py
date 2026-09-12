#!/usr/bin/env python3
"""astropy oracle for the Lucy L'LORRI product (Donaldjohanson): the three FITS
HDUs read by astropy.io.fits, and the TAN-SIP distortion evaluated by
astropy.wcs for sampled pixels, which llorri-geo.mts must reproduce.
Usage: .local/oracles/venv/bin/python tools/oracles/fits/llorri.py
"""
import sys, warnings
from pathlib import Path
import numpy as np
import astropy
from astropy.io import fits
from astropy.wcs import WCS
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write
warnings.simplefilter('ignore')

path = ROOT / 'src/planets/donaldjohanson/source/observations/lor_0798443290_04598_00035_1x1_sci_03.fit'
hdus = fits.open(str(path)); header = hdus[0].header
planes = {f'hdu{i}': {'name': hdu.name, 'shape': list(hdu.data.shape), 'dtype': str(hdu.data.dtype), 'samples': samples(hdu.data, 98 + i, 48)} for i, hdu in enumerate(hdus)}
w = WCS(header)
rng = np.random.default_rng(98)
pixels = np.vstack([np.column_stack([rng.uniform(0, 1023, 60), rng.uniform(0, 1023, 60)]), [[0, 0], [1023, 1023], [511.5, 511.5], [1023, 0], [0, 1023]]])
# With origin 0, astropy also subtracts one from the focal output, which is already relative to CRPIX
# (sip_pix2foc at the 0-based CRPIX returns -1, -1). Evaluate in the FITS 1-based convention instead.
foc = w.sip_pix2foc(pixels + 1, 1)
assert abs(w.sip_pix2foc([[w.wcs.crpix[0], w.wcs.crpix[1]]], 1)).max() == 0, 'focal coordinates are relative to CRPIX'
sip = {'crpix': [float(v) for v in w.wcs.crpix], 'aOrder': int(header['A_ORDER']), 'bOrder': int(header['B_ORDER']),
       'a': {k: float(header[k]) for k in header if k.startswith('A_') and k != 'A_ORDER'}, 'b': {k: float(header[k]) for k in header if k.startswith('B_') and k != 'B_ORDER'},
       'pixelOrigin': 0, 'focalRelativeTo': 'CRPIX', 'pixels': [[float(x), float(y)] for x, y in pixels], 'focal': [[float(x), float(y)] for x, y in foc]}
cards = {k: (float(header[k]) if isinstance(header[k], (int, float)) else str(header[k])) for k in ['EXPTIME', 'STARTUTC', 'CTYPE1', 'CTYPE2', 'CRPIX1', 'CRPIX2', 'TRGFOV1', 'TRGFOVN', 'BIASCORR', 'SMEARCOR', 'FLATCORR', 'AVSCORR']}
write('fits/llorri.json', 'astropy', 'tools/oracles/fits/llorri.py', {'astropy': astropy.__version__}, [path], {'cards': cards, 'planes': planes, 'sip': sip})
