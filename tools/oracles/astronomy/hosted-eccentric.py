"""CSPICE N0067 oracle for eccentric hosted-orbit states in the observer-local frame.

`conics_c` performs the propagation. This script only maps the documented transit
epoch convention into CSPICE elements and applies the proper rotation Rz(pi) from
CSPICE's node frame to the hosted-orbit local frame.
"""
import json
import math
import sys
import urllib.request
from pathlib import Path

import spiceypy as spice

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, external_record, write


CSPICE_COMMIT = '26c72936fb7ff6f366803a1419b7cc3c61e0b6e5'
REFERENCE_URLS = [
    f'https://raw.githubusercontent.com/ChristopherRabotin/cspice/{CSPICE_COMMIT}/src/cspice/conics_c.c',
    f'https://raw.githubusercontent.com/ChristopherRabotin/cspice/{CSPICE_COMMIT}/src/cspice/conics.c',
]
ORBITS = [
    {'id': 'low-eccentricity', 'periodDays': 2.1, 'semiMajorAxisStellarRadii': 8.0,
     'stellarRadiusKm': 500000.0, 'eccentricity': 0.05, 'inclinationDegrees': 73.0,
     'argumentOfPeriapsisDegrees': 0.0, 'rightAscensionDegrees': 15.0,
     'declinationDegrees': -20.0, 'nodePositionAngleDegrees': 5.0},
    {'id': 'moderate-eccentricity', 'periodDays': 7.5, 'semiMajorAxisStellarRadii': 6.0,
     'stellarRadiusKm': 610000.0, 'eccentricity': 0.5, 'inclinationDegrees': 88.5,
     'argumentOfPeriapsisDegrees': 137.0, 'rightAscensionDegrees': 211.0,
     'declinationDegrees': 44.0, 'nodePositionAngleDegrees': 123.0},
    {'id': 'high-eccentricity', 'periodDays': 31.0, 'semiMajorAxisStellarRadii': 30.0,
     'stellarRadiusKm': 350000.0, 'eccentricity': 0.9, 'inclinationDegrees': 93.0,
     'argumentOfPeriapsisDegrees': 319.0, 'rightAscensionDegrees': 359.5,
     'declinationDegrees': 78.0, 'nodePositionAngleDegrees': 301.0},
]
SOURCE = ROOT / 'tests/fixtures/hosted-orbits/trappist-1f-agol2021/qualification.json'
published = json.loads(SOURCE.read_text())
ORBITS.append({**published['orbit'], 'id': published['id'], 'stellarRadiusKm': 1.0,
               'rightAscensionDegrees': 0.0, 'declinationDegrees': 0.0,
               'nodePositionAngleDegrees': published['orbit']['ascendingNodePositionAngleDegrees']})


def mean_anomaly_at_true_anomaly(true_anomaly, eccentricity):
    beta = math.sqrt(1 - eccentricity * eccentricity)
    eccentric_anomaly = math.atan2(beta * math.sin(true_anomaly), eccentricity + math.cos(true_anomaly))
    return eccentric_anomaly - eccentricity * math.sin(eccentric_anomaly)


def orbit_case(config):
    period_seconds = config['periodDays'] * 86400
    semimajor_km = config['semiMajorAxisStellarRadii'] * config['stellarRadiusKm']
    eccentricity = config['eccentricity']
    inclination = math.radians(config['inclinationDegrees'])
    periapsis = math.radians(config['argumentOfPeriapsisDegrees'])
    rate = 2 * math.pi / period_seconds
    mu = rate * rate * semimajor_km ** 3
    transit_mean_anomaly = mean_anomaly_at_true_anomaly(math.pi / 2 - periapsis, eccentricity)
    behind_mean_anomaly = mean_anomaly_at_true_anomaly(3 * math.pi / 2 - periapsis, eccentricity)
    behind_delta = (behind_mean_anomaly - transit_mean_anomaly) % (2 * math.pi) / rate
    periapsis_delta = (-transit_mean_anomaly % (2 * math.pi)) / rate
    elements = [semimajor_km * (1 - eccentricity), eccentricity, inclination, 0.0,
                periapsis, transit_mean_anomaly, 0.0, mu]
    times = [
        ('transit', 0.0),
        ('sample-0.11-period', 0.11 * period_seconds),
        ('behind', behind_delta),
        ('sample-0.77-period', 0.77 * period_seconds),
        ('periapsis', periapsis_delta),
        ('next-transit', period_seconds),
    ]
    states = []
    transit_epoch_bmjd = config.get('transitTimeBmjdTdb', 60000.25)
    for label, seconds in times:
        # Compare the same representable BMJD input, including its rounding,
        # rather than an exact offset against a rounded absolute timestamp.
        epoch_bmjd = transit_epoch_bmjd + seconds / 86400
        elapsed_seconds = (epoch_bmjd - transit_epoch_bmjd) * 86400
        state = spice.conics(elements, elapsed_seconds)
        # With node=0 CSPICE returns [X, Y cos(i), Y sin(i)]. Rz(pi) is a
        # proper rotation and produces hosted local [-X, -Y cos(i), Y sin(i)].
        position = [-float(state[0]), -float(state[1]), float(state[2])]
        velocity = [-float(state[3]) * 86400, -float(state[4]) * 86400, float(state[5]) * 86400]
        states.append({'label': label, 'epochBmjdTdb': epoch_bmjd,
                       'observerLocalPositionKm': position, 'observerLocalVelocityKmPerDay': velocity})
    return {**config, 'epochDefinition': 'inferior-conjunction', 'transitTimeBmjdTdb': transit_epoch_bmjd, 'states': states}


references = []
for url in REFERENCE_URLS:
    with urllib.request.urlopen(url, timeout=30) as response:
        references.append(external_record(url, response.read()))

write(
    'astronomy/hosted-eccentric.json',
    'SpiceyPy CSPICE conics_c eccentric propagation',
    'tools/oracles/astronomy/hosted-eccentric.py',
    {'spiceypy': spice.__version__, 'cspice': spice.tkvrsn('TOOLKIT'), 'method': 'conics_c'},
    [SOURCE],
    {'orbits': [orbit_case(config) for config in ORBITS]},
    references,
)
