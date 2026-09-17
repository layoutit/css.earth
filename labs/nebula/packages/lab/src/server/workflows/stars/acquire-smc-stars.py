#!/usr/bin/env python3
"""Acquire the small, byte-pinned Bonanos et al. (2010) SMC catalogue files; never query the all-sky archive."""
import hashlib
import json
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[6] / 'models/smc/stars/source'
manifest = json.loads((root / 'catalogue.json').read_text())
for entry in manifest['files']:
    path = root / entry['path']
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']:
        print('Verified', path.name)
        continue
    if not entry['url'].startswith('https://cdsarc.cds.unistra.fr/ftp/J/AJ/140/416/'):
        raise RuntimeError('Unexpected catalogue URL: ' + entry['url'])
    with urllib.request.urlopen(entry['url'], timeout=20) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000 or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise RuntimeError('Downloaded source does not match pin: ' + entry['path'])
    path.write_bytes(data)
    print('Acquired', path.name, len(data))
