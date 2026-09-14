#!/usr/bin/env python3
"""Independent samples of all current Sun FITS maps and two HST/OPAL maps."""
import json, sys, warnings
from pathlib import Path
import numpy as np
import astropy
from astropy.io import fits
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write
warnings.simplefilter('ignore')
inputs, products = [], {}
for body in ['sun', 'jupiter']:
    source = ROOT / 'src/objects' / body / 'source'
    manifest = json.loads((source / 'manifest.json').read_text())
    for entry in manifest['inputs']:
        if not entry['path'].endswith('.fits'): continue
        path = source / entry['path']; inputs.append(path)
        with fits.open(path, memmap=False) as hdus:
            data = hdus[0].data
            products[str(path.relative_to(ROOT))] = {
                'shape': list(data.shape), 'samples': samples(data, 918, 24),
                'nonfinite': int((~np.isfinite(data)).sum()),
                'negative': int((data < 0).sum()), 'zero': int((data == 0).sum())}
write('fits/synoptic.json', 'astropy', 'tools/oracles/fits/synoptic.py', {'astropy': astropy.__version__}, inputs, {'products': products})
