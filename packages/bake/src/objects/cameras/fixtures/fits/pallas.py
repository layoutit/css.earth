#!/usr/bin/env python3
"""Released Pallas SPHERE bytes: Astropy header counts and primary image layout, no camera fit."""
import json, sys
from pathlib import Path
import astropy
from astropy.io import fits
import numpy as np
sys.path.insert(0, str(next(parent for parent in Path(__file__).resolve().parents if (parent / "pnpm-workspace.yaml").is_file()) / "packages/core/src/node/oracle"))
from fixture import ROOT, write

record = json.loads((ROOT / 'packages/fits/src/node/fixtures/fits/archive-inputs.json').read_text())
inputs, cases = [], {}
for pin in record['inputs']:
    path = ROOT / pin['path']
    if not path.exists():
        raise FileNotFoundError(f'pallas: missing FITS reference input {path}; run pnpm test:fits --restore')
    if path.stat().st_size != pin['bytes']:
        raise ValueError(f"pallas: {pin['path']} holds {path.stat().st_size} bytes; archive-inputs.json records {pin['bytes']}")
    inputs.append(path)
    with fits.open(path, memmap=False) as hdus:
        hdu = hdus[0]
        hierarchy = {card.keyword: card.value for card in hdu.header.cards if card.keyword.startswith('ESO ')}
        cases[pin['path']] = {'shape': list(hdu.data.shape), 'hduCount': len(hdus),
            'hierarchyCount': len(hierarchy),
            'nonfinite': int((~np.isfinite(hdu.data)).sum())}
write('packages/bake/src/objects/layers/observation/fixtures/fits/pallas.json', 'astropy', 'packages/bake/src/objects/cameras/fixtures/fits/pallas.py', {'astropy': astropy.__version__}, inputs, cases)
