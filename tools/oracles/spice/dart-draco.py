#!/usr/bin/env python3
"""SpiceyPy oracle for the DART DRACO geometry: the reference SPICE toolkit computes
times, states, frames and the apparent directions of archived surface intercepts
from the same pinned kernels that tools/spice/ reads, and writes a fixture that
tools/spice/oracle.test.mts compares against. The intercepts are read from the
cube with NASA's pds4_tools, not with the pipeline's own decoder, so no pipeline
code stands between the archive and the oracle.
Usage: node tools/assets/restore-source-inputs.mts --object=dimorphos
       .local/oracles/venv/bin/python tools/oracles/spice/dart-draco.py
"""
import hashlib, json, platform, sys
from pathlib import Path
import numpy as np
import spiceypy as spice

root = Path(__file__).resolve().parents[3]
source = root / 'src/objects/dimorphos/source'
manifest = json.loads((source / 'manifest.json').read_text())
kernels = [entry['path'] for entry in manifest['inputs'] if entry['path'].startswith('spice/')]
order = ['lsk/', 'pck/pck00010', 'pck/didymos', 'fk/dart', 'fk/didymos', 'ik/', 'sclk/', 'spk/de430', 'spk/didymos_barycenter', 'spk/didymos_system', 'spk/dart_struct',
         'spk/dart_2022_231', 'spk/dart_2022_269_2022_269_rec', 'spk/dart_2022_269_2022_269_spc', 'ck/']
kernels.sort(key=lambda path: next(i for i, prefix in enumerate(order) if path.startswith('spice/' + prefix)))
for path in kernels:
    spice.furnsh(str(source / path))

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
import pds4_tools
cube_label = source / 'observations/dart_0401930040_12262_01_geo.xml'
structures = {structure.id: np.asarray(structure.data, dtype=np.float64) for structure in pds4_tools.read(str(cube_label), quiet=True) if structure.id in ('xcoord', 'ycoord', 'zcoord')}
width = structures['xcoord'].shape[1]
flat = {axis: structures[axis].reshape(-1) for axis in structures}
cube_points = []
for i in range(0, flat['xcoord'].size, 4001):
    xyz = [flat['xcoord'][i], flat['ycoord'][i], flat['zcoord'][i]]
    # Off-body pixels inside the readout window carry -999; pixels outside the window carry -1e10.
    if all(np.isfinite(v) and v != -999 and abs(v) < 1e8 for v in xyz):
        cube_points.append({'pixel': [i % width, i // width], 'xyz': [float(v) for v in xyz]})
surface = []
for point in cube_points:
    state, lt = spice.spkcpt(point['xyz'], 'DIMORPHOS', 'DIMORPHOS_FIXED', et0, 'DART_DRACO', 'OBSERVER', 'LT+S', 'DART')
    direction = np.array(state[:3]); direction /= np.linalg.norm(direction)
    surface.append({'pixel': point['pixel'], 'xyz': point['xyz'], 'directionInDraco': vec(direction), 'rangeKm': float(np.linalg.norm(state[:3])), 'lightTime': float(lt)})

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import write
write('spice/dart-draco.json', 'spiceypy', 'tools/oracles/spice/dart-draco.py',
      {'spiceypy': spice.__version__, 'cspice': spice.tkvrsn('TOOLKIT'), 'pds4_tools': pds4_tools.__version__},
      [source / path for path in kernels] + [source / 'observations/dart_0401930040_12262_01_geo.fits', cube_label],
      {'exposure': {'sclk': exposure_sclk, 'et': et0, 'utc': utc0}, 'times': times, 'states': states, 'frames': frames, 'surface': surface})
