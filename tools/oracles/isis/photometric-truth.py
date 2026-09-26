#!/usr/bin/env python3
"""USGS ISIS3 as the oracle for @cssearth/bake/photometry: the truth files of ISIS's photometric
model unit tests, fetched at a pinned commit, parsed into parameters, geometries and the
values ISIS printed. The values come from ISIS's own implementation (Hapke.cpp and the
disk functions); nothing here recomputes them.
Usage: .local/oracles/venv/bin/python tools/oracles/isis/photometric-truth.py
"""
import re, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import write, external_record

COMMIT = '1638a583e95be76d50e16cbe70f2c8e237528132'  # ISIS tag 10.0.0_LTS
BASE = f'https://raw.githubusercontent.com/DOI-USGS/ISIS3/{COMMIT}/isis/src/base/objs'
FILES = {name: f'{BASE}/{name}/{name}.truth' for name in ['Hapke', 'LunarLambert', 'Minnaert', 'LommelSeeliger']}
# Hapke.cpp constructor defaults for keywords a block omits.
HAPKE_DEFAULTS = {'Wh': 0.5, 'B0': 0.0, 'Hh': 0.0, 'Theta': 0.0, 'Hg1': 0.0, 'Hg2': 0.0, 'Bh': 0.0, 'Ch': 0.0}
TEST = re.compile(r'Test phase=([\d.]+), incidence=([\d.]+), emission=([\d.]+) \.\.\.\s*\n\s*Albedo = ([-\d.eE+]+)')

references, texts = [], {}
for name, url in FILES.items():
    data = urllib.request.urlopen(url, timeout=60).read()
    references.append(external_record(url, data)); texts[name] = data.decode('utf8')

def unique(rows):
    """ISIS's unit tests print some parameter sets twice (set by keyword, then by setter); keep each case once."""
    kept = []
    for row in rows:
        if row not in kept: kept.append(row)
    return kept

def tests(block):
    return [{'phaseDegrees': float(p), 'incidenceDegrees': float(i), 'emissionDegrees': float(e), 'value': float(v)} for p, i, e, v in TEST.findall(block)]

hapke = []
for block in re.split(r'(?=Object = PhotometricModel)', texts['Hapke'])[1:]:
    if 'USER ERROR' in block: continue
    keywords = dict(re.findall(r'^\s*(\w+)\s*=\s*(\S+)\s*$', block.split('End_Object')[0], re.M))
    algorithm = keywords.pop('Name')
    parameters = {key: float(keywords.get(key, default)) for key, default in HAPKE_DEFAULTS.items()}
    for case in tests(block): hapke.append({'algorithm': algorithm, **parameters, **case})

def swept(text, keyword):
    cases = []
    for block in re.split(rf'(?={keyword} = )', text)[1:]:
        value = float(re.match(rf'{keyword} = ([-\d.eE+]+)', block).group(1))
        cases += [{keyword: value, **case} for case in tests(block)]
    return cases

write('isis/photometric-truth.json', 'isis3', 'tools/oracles/isis/photometric-truth.py', {'isis': '10.0.0_LTS'}, [],
      {'commit': COMMIT, 'printedSignificantDigits': 6, 'hapke': unique(hapke), 'lunarLambert': unique(swept(texts['LunarLambert'], 'PhotoL')),
       'minnaert': unique(swept(texts['Minnaert'], 'PhotoK')), 'lommelSeeliger': unique(tests(texts['LommelSeeliger']))}, references)
