#!/usr/bin/env python3
"""Released Pallas SPHERE bytes: Astropy headers and all primary pixels, no camera fit."""
import hashlib, json, struct, sys
from pathlib import Path
import astropy
from astropy.io import fits
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, sha256, write

record = json.loads((ROOT / 'tests/fixtures/fits/archive-inputs.json').read_text())
inputs, cases = [], {}
for pin in record['inputs']:
    path = ROOT / pin['path']
    if path.stat().st_size != pin['bytes'] or sha256(path) != pin['sha256']:
        raise ValueError(f'Changed Pallas source: {path}')
    inputs.append(path)
    with fits.open(path, memmap=False) as hdus:
        hdu = hdus[0]
        hierarchy = {card.keyword: card.value for card in hdu.header.cards if card.keyword.startswith('ESO ')}
        digest = hashlib.sha256()
        for key, value in sorted(hierarchy.items()):
            digest.update(key.encode('ascii') + b'\0')
            if value is None: digest.update(b'U')
            elif isinstance(value, bool): digest.update(b'T' if value else b'F')
            elif isinstance(value, (int, float)): digest.update(b'N' + struct.pack('>d', value))
            elif isinstance(value, str): digest.update(b'S' + value.encode('ascii') + b'\0')
            else: raise ValueError(f'Unsupported reference value: {key}')
        cases[pin['path']] = {'shape': list(hdu.data.shape), 'hduCount': len(hdus),
            'hierarchyCount': len(hierarchy), 'hierarchySha256': digest.hexdigest(),
            'pixelsFloat64BeSha256': hashlib.sha256(np.asarray(hdu.data, dtype='>f8').tobytes()).hexdigest(),
            'nonfinite': int((~np.isfinite(hdu.data)).sum())}
write('fits/pallas.json', 'astropy', 'tools/oracles/fits/pallas.py', {'astropy': astropy.__version__}, inputs, cases)
