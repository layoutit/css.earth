#!/usr/bin/env python3
"""SpiceyPy oracle for the DART DRACO geometry: the reference SPICE toolkit computes
times, states, frames and surface-point directions from the same pinned kernels that
tools/spice/ reads, and writes them as a fixture that tools/spice/oracle.test.mts
compares against. Oracles verify; they never produce pipeline inputs.
Usage: .local/oracles/venv/bin/python tools/oracles/spice/dart-draco.py
"""
import hashlib, json, platform, sys
from pathlib import Path
import numpy as np
import spiceypy as spice

root = Path(__file__).resolve().parents[3]
source = root / 'src/planets/dimorphos/source'
manifest = json.loads((source / 'manifest.json').read_text())
kernels = [entry['path'] for entry in manifest['inputs'] if entry['path'].startswith('spice/')]
order = ['lsk/', 'pck/pck00010', 'pck/didymos', 'fk/dart', 'fk/didymos', 'ik/', 'sclk/', 'spk/de430', 'spk/didymos_barycenter', 'spk/didymos_system', 'spk/dart_struct',
         'spk/dart_2022_231', 'spk/dart_2022_269_2022_269_rec', 'spk/dart_2022_269_2022_269_spc', 'ck/']
kernels.sort(key=lambda path: next(i for i, prefix in enumerate(order) if path.startswith('spice/' + prefix)))
inputs = []
for path in kernels:
    full = source / path
    inputs.append({'path': f'src/planets/dimorphos/source/{path}', 'sha256': hashlib.sha256(full.read_bytes()).hexdigest(), 'bytes': full.stat().st_size})
    spice.furnsh(str(full))

DART, DIMORPHOS, DIDYMOS, BARYCENTER, SUN = -135, 120065803, 920065803, 20065803, 10
exposure_sclk = '1/0401930040:07327'
et0 = spice.scs2e(DART, exposure_sclk)
utc0 = spice.et2utc(et0, 'ISOC', 3) + 'Z'

def vec(v): return [float(x) for x in v]

times = []
for offset in [-600.0, -60.0, -1.0, 0.0, 0.5, 11.0]:
    et = et0 + offset
    times.append({'et': et, 'utc': spice.et2utc(et, 'ISOC', 6) + 'Z', 'sclk': spice.sce2s(DART, et), 'sclkEt': spice.scs2e(DART, spice.sce2s(DART, et)), 'tdbMinusTdt': float(et - spice.unitim(et, 'TDB', 'TDT'))})
# Leap second boundary: 2016-12-31T23:59:60 was inserted; check the day before and after.
for utc in ['2016-12-31T00:00:00.000', '2017-01-01T00:00:00.000', '2022-09-26T23:14:12.737']:
    et = spice.str2et(utc)
    times.append({'et': et, 'utc': spice.et2utc(et, 'ISOC', 6) + 'Z', 'sclk': None, 'sclkEt': None, 'tdbMinusTdt': float(et - spice.unitim(et, 'TDB', 'TDT'))})

states = []
epochs = [et0 - 86400 * 20, et0 - 3600, et0 - 30, et0, et0 + 11]
for et in epochs:
    for target, observer in [(DART, DIMORPHOS), (DART, SUN), (DIMORPHOS, BARYCENTER), (DIDYMOS, BARYCENTER), (BARYCENTER, SUN), (SUN, 0), (399, 0), (DIMORPHOS, DART)]:
        for correction in ['NONE', 'LT', 'LT+S', 'CN', 'CN+S']:
            try:
                state, lt = spice.spkezr(str(target), et, 'J2000', correction, str(observer))
            except spice.utils.exceptions.SpiceyError as error:
                continue
            states.append({'target': target, 'observer': observer, 'et': et, 'frame': 'J2000', 'correction': correction, 'position': vec(state[:3]), 'velocity': vec(state[3:]), 'lightTime': float(lt)})
# States in the body-fixed frame at the exposure.
for correction in ['NONE', 'LT+S']:
    state, lt = spice.spkezr('DART', et0, 'DIMORPHOS_FIXED', correction, str(DIMORPHOS))
    states.append({'target': DART, 'observer': DIMORPHOS, 'et': et0, 'frame': 'DIMORPHOS_FIXED', 'correction': correction, 'position': vec(state[:3]), 'velocity': vec(state[3:]), 'lightTime': float(lt)})
    state, lt = spice.spkezr('SUN', et0, 'DIMORPHOS_FIXED', correction, str(DIMORPHOS))
    states.append({'target': SUN, 'observer': DIMORPHOS, 'et': et0, 'frame': 'DIMORPHOS_FIXED', 'correction': correction, 'position': vec(state[:3]), 'velocity': vec(state[3:]), 'lightTime': float(lt)})

frames = []
for et in [et0 - 30, et0, et0 + 11]:
    for frame in ['DIMORPHOS_FIXED', 'IAU_DIMORPHOS', 'DART_SPACECRAFT', 'DART_DRACO', 'DART_DRACO_TERMINAL', 'DIDYMOS_FIXED', 'ECLIPJ2000']:
        try:
            matrix = spice.pxform('J2000', frame, et)
        except spice.utils.exceptions.SpiceyError:
            continue
        frames.append({'frame': frame, 'et': et, 'matrix': [vec(row) for row in matrix]})

# Apparent directions of archived DRACO intercepts in the DART_DRACO frame: spkcpt handles a constant body-fixed point with LT+S.
cube_points = json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else []
surface = []
for point in cube_points:
    state, lt = spice.spkcpt(point['xyz'], 'DIMORPHOS', 'DIMORPHOS_FIXED', et0, 'DART_DRACO', 'OBSERVER', 'LT+S', 'DART')
    direction = np.array(state[:3]); direction /= np.linalg.norm(direction)
    surface.append({'pixel': point['pixel'], 'xyz': point['xyz'], 'directionInDraco': vec(direction), 'rangeKm': float(np.linalg.norm(state[:3])), 'lightTime': float(lt)})

fixture = {
    'schema': 'cssearth-oracle-fixture@1', 'oracle': 'spiceypy', 'generatedBy': 'tools/oracles/spice/dart-draco.py',
    'tool': {'spiceypy': spice.__version__, 'cspice': spice.tkvrsn('TOOLKIT'), 'python': platform.python_version(), 'numpy': np.__version__},
    'inputs': inputs,
    'exposure': {'sclk': exposure_sclk, 'et': et0, 'utc': utc0},
    'cases': {'times': times, 'states': states, 'frames': frames, 'surface': surface},
}
out = root / 'tests/oracles/spice/dart-draco.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(fixture, indent=1) + '\n')
print(json.dumps({'written': str(out.relative_to(root)), 'times': len(times), 'states': len(states), 'frames': len(frames), 'surface': len(surface), 'cspice': spice.tkvrsn('TOOLKIT')}))
