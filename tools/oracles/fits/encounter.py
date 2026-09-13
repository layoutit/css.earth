#!/usr/bin/env python3
"""astropy oracle for the calibrated encounter FITS products that encounter-fits.mts
reads, one per instrument layout: Deep Impact ITS (Tempel 1), Stardust NAVCAM
(Wild 2) and Deep Impact MRI during EPOXI (Hartley 2). astropy.io.fits reads every
HDU; sampled radiances, quality flags, the header identity and the per-pixel
accept or reject counts become a fixture the decoder must reproduce. The active
detector border is the recipe's declared policy; flag 0 is good data in all three
archives.
Usage: .local/oracles/venv/bin/python tools/oracles/fits/encounter.py
"""
import json, sys, warnings
from pathlib import Path
import numpy as np
import astropy
from astropy.io import fits
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write
warnings.simplefilter('ignore')

QUALITY_PLANE = {'ITSVIS': 'FLAGS', 'MRIVIS': 'FLAGS', 'NAVCAM': 'QUALITY_MAP'}
products, inputs = {}, []
for k, body in enumerate(['comet-9p', 'comet-81p', 'comet-103p']):
    source = ROOT / 'src/planets' / body / 'source'
    frame = json.loads((source / 'preparation/terrestrial.json').read_text())['raster']['surfaceObservations'][0]['frames'][0]
    border = int(json.loads((source / frame['controlPath']).read_text())['observation']['detectorBorderPixels'])
    path = source / frame['path']; inputs.append(path)
    hdus = fits.open(str(path)); header = hdus[0].header
    primary = np.asarray(hdus[0].data, dtype=np.float64)
    quality = np.asarray(hdus[QUALITY_PLANE[header['INSTRUME']]].data)
    height, width = primary.shape
    rows, cols = np.indices((height, width))
    inside = (cols >= border) & (cols < width - border) & (rows >= border) & (rows < height - border)
    good, finite = quality == 0, np.isfinite(primary)
    products[body] = {
        'path': str(path.relative_to(ROOT)), 'detectorBorderPixels': border,
        'identity': {'instrument': str(header['INSTRUME']), 'units': str(header['BUNIT']), 'date': str(header.get('OBSDATE', header.get('DATE-OBS'))),
                     'filter': str(header.get('FILTER', header.get('FILTNAME'))), 'target': str(header['OBJECT'])},
        'hdus': [{'name': hdu.name, 'shape': list(hdu.data.shape), 'dtype': str(hdu.data.dtype)} for hdu in hdus],
        'primary': samples(primary, 700 + k, 48),
        'quality': samples(quality.astype(np.float64), 710 + k, 48, np.ones(quality.shape, dtype=bool)),
        'qualityHistogram': {str(int(v)): int(c) for v, c in zip(*np.unique(quality, return_counts=True))},
        'reasons': {'detector-overclock': int((~inside).sum()), 'detector-quality': int((inside & ~good).sum()),
                    'nonfinite-radiance': int((inside & good & ~finite).sum()), 'accepted': int((inside & good & finite).sum())}}
write('fits/encounter.json', 'astropy', 'tools/oracles/fits/encounter.py', {'astropy': astropy.__version__}, inputs, {'products': products})
