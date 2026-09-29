#!/usr/bin/env python3
"""Acquire the small Bonanos et al. (2010) SMC catalogue files named in the catalogue manifest; never query the all-sky archive."""
import json
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[6] / 'models/smc/stars/source'
manifest = json.loads((root / 'catalogue.json').read_text())
for entry in manifest['files']:
    path = root / entry['path']
    if path.exists():
        print('Present', path.name)
        continue
    if not entry['url'].startswith('https://cdsarc.cds.unistra.fr/ftp/J/AJ/140/416/'):
        raise RuntimeError('Unexpected catalogue URL: ' + entry['url'])
    with urllib.request.urlopen(entry['url'], timeout=20) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise RuntimeError('Downloaded catalogue file is larger than the 2 MB CDS table it names: ' + entry['path'])
    path.write_bytes(data)
    print('Acquired', path.name, len(data))
