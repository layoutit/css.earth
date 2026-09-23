#!/usr/bin/env python3
"""SpiceyPy oracle for the New Horizons approach directions the default cameras of Pluto and Charon face: the reference
SPICE toolkit finds each closest approach from the pinned new-horizons kernel bank and writes the reverse inbound velocity in
the body-fixed frame at that instant; tools/spice/approach.test.mts compares tools/spice/approach.mts against it.
Usage: .local/oracles/venv/bin/python tools/oracles/spice/new-horizons-approach.py
"""
import json, sys
from pathlib import Path
import spiceypy as spice

root = Path(__file__).resolve().parents[3]
bank = root / 'src/spice/new-horizons'
cases = {}
for body in ('pluto', 'charon'):
    recipe = json.loads((root / 'src/objects' / body / 'source/preparation/approach.json').read_text())
    spice.kclear()
    for kernel in recipe['kernels']:
        spice.furnsh(str(bank / kernel))
    spacecraft, target, frame = str(recipe['spacecraft']), str(recipe['body']), recipe['frame']
    low, high = (spice.str2et(t.rstrip('Z')) for t in recipe['searchWindowUtc'])
    rng = lambda et: spice.vnorm(spice.spkezr(spacecraft, et, 'J2000', 'NONE', target)[0][:3])
    while high - low > 1e-3:
        a, b = low + (high - low) / 3, high - (high - low) / 3
        if rng(a) < rng(b): high = b
        else: low = a
    ca = (low + high) / 2
    inbound = spice.spkezr(spacecraft, ca - recipe['inboundHours'] * 3600, 'J2000', 'NONE', target)[0][3:]
    toward = spice.mxv(spice.pxform('J2000', frame, ca), [-v for v in inbound])
    radius, longitude, latitude = spice.reclat(toward)
    cases[body] = {'closestApproachEt': ca, 'closestApproachUtc': spice.et2utc(ca, 'ISOC', 3) + 'Z', 'rangeKm': rng(ca),
                   'direction': [float(v) / radius for v in toward], 'longitudeDeg': float(spice.dpr() * longitude), 'latitudeDeg': float(spice.dpr() * latitude)}
kernels = json.loads((root / 'src/objects/pluto/source/preparation/approach.json').read_text())['kernels']

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import write
write('spice/new-horizons-approach.json', 'spiceypy', 'tools/oracles/spice/new-horizons-approach.py',
      {'spiceypy': spice.__version__, 'cspice': spice.tkvrsn('TOOLKIT')}, [bank / kernel for kernel in kernels], cases)
