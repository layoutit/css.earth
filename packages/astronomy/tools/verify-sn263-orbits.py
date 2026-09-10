#!/usr/bin/env python3
"""Independent plane-basis checks of retained SN263 display orbit snapshots.

Uses only Python's standard library. These checks establish arithmetic, units and
coordinate consistency, not a prediction of the moons' current orbital phases.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def plane_basis_state(parameters, epoch):
    """Bisection Kepler solve and explicit in-plane basis, independent of JS rotations."""
    a, e = parameters['semiMajorAxisKm'], parameters['eccentricity']
    days = epoch - parameters['epochJd']
    mean = math.radians((parameters['meanAnomalyDegrees'] +
                         parameters['meanMotionDegreesPerDay'] * days) % 360)
    lo, hi = 0.0, 2 * math.pi
    for _ in range(64):
        middle = (lo + hi) / 2
        if middle - e * math.sin(middle) < mean:
            lo = middle
        else:
            hi = middle
    eccentric = (lo + hi) / 2
    inc, node, peri = (math.radians(parameters[key]) for key in
                       ['inclinationDegrees', 'ascendingNodeDegrees', 'argumentPeriapsisDegrees'])
    along_node = [math.cos(node), math.sin(node), 0]
    across_node = [-math.sin(node) * math.cos(inc),
                   math.cos(node) * math.cos(inc), math.sin(inc)]
    p = [math.cos(peri) * x + math.sin(peri) * y for x, y in zip(along_node, across_node)]
    q = [-math.sin(peri) * x + math.cos(peri) * y for x, y in zip(along_node, across_node)]
    x, y = a * (math.cos(eccentric) - e), a * math.sqrt(1 - e * e) * math.sin(eccentric)
    rate = math.radians(parameters['meanMotionDegreesPerDay']) / (1 - e * math.cos(eccentric))
    vx, vy = -a * math.sin(eccentric) * rate, a * math.sqrt(1 - e * e) * math.cos(eccentric) * rate
    assert parameters['referenceFrame'] == 'EQJ2000'
    assert parameters['quadraticMeanAnomalyDegreesPerYear2'] == 0
    return {'positionKm': [x * u + y * v for u, v in zip(p, q)],
            'velocityKmPerDay': [vx * u + vy * v for u, v in zip(p, q)]}


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def verify():
    normals = []
    maximum = 0.0
    for body in ['sn263-beta', 'sn263-gamma']:
        root = ROOT / 'src/planets' / body
        parameters = json.loads((root / 'source/orbit/published-parameters.json').read_text())
        record = json.loads((root / 'source/validation/epoch-state.json').read_text())
        for epoch, expected in [(parameters['epochJd'], record['validation']['sourceEpochState']),
                                (record['epochJdTt'], record)]:
            actual = plane_basis_state(parameters, epoch)
            for key in ['positionKm', 'velocityKmPerDay']:
                difference = max(abs(a - b) for a, b in zip(actual[key], expected[key]))
                maximum = max(maximum, difference)
                assert difference < 1e-7, (body, epoch, key, difference)
            # Energy and angular momentum provide checks independent of the stored state components.
            r, v = actual['positionKm'], actual['velocityKmPerDay']
            mu = record['gravitationalParametersKm3PerS2']['combined'] * 86400 ** 2
            energy = sum(x*x for x in v) / 2 - mu / math.hypot(*r)
            assert abs(energy / (-mu / (2 * parameters['semiMajorAxisKm'])) - 1) < 1e-10
        angular_momentum = cross(actual['positionKm'], actual['velocityKmPerDay'])
        length = math.hypot(*angular_momentum)
        normals.append([x / length for x in angular_momentum])
        # Check the independent catalogue transcription by a/e, not its unnamed row order.
        api = json.loads((root / 'source/orbit/jpl-satellites.txt').read_text())
        orbit = next(row['orbit'] for row in api['data']
                     if float(row['orbit']['a']) == parameters['semiMajorAxisKm'])
        for key, field in [('eccentricity', 'e'), ('inclinationDegrees', 'i'),
                           ('ascendingNodeDegrees', 'om'), ('argumentPeriapsisDegrees', 'w'),
                           ('meanAnomalyDegrees', 'ma'), ('epochJd', 'epoch')]:
            assert parameters[key] == float(orbit[field]), (body, key)
        assert record['validation']['scientificPrecisionQualified'] is False
    mutual = math.degrees(math.acos(sum(a * b for a, b in zip(*normals))))
    # Fang et al. section 3.1 reports approximately 14 degrees, independently of our rotations.
    assert abs(mutual - 14) < 1, mutual
    print(json.dumps({'bodies': 2, 'epochsPerBody': 2,
                      'maximumStateComponentDifference': maximum,
                      'mutualInclinationDegrees': mutual,
                      'currentOrbitalPhaseQualified': False}, indent=2))


if __name__ == '__main__':
    verify()
