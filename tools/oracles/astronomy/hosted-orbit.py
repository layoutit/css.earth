"""Independent Astropy/NumPy fixtures for hosted-orbit sky geometry."""
import sys
import urllib.request
from pathlib import Path

import astropy
import astropy.units as u
import numpy as np
from astropy.coordinates import SkyCoord

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import external_record, write


ASTROPY_COMMIT = '7c5a9c124ce84c76992016e89631566ad398aff7'
REFERENCE_URL = (
    'https://raw.githubusercontent.com/astropy/astropy/'
    f'{ASTROPY_COMMIT}/astropy/coordinates/sky_coordinate.py'
)

FRAMES = [
    {'rightAscensionDegrees': 0.0, 'declinationDegrees': 0.0, 'nodePositionAngleDegrees': 0.0},
    {'rightAscensionDegrees': 123.456, 'declinationDegrees': -54.321, 'nodePositionAngleDegrees': 237.0},
    {'rightAscensionDegrees': 359.999, 'declinationDegrees': 89.999, 'nodePositionAngleDegrees': 91.25},
]

ORBITS = [
    {
        'id': 'short-period-inclined',
        'rightAscensionDegrees': 123.456,
        'declinationDegrees': -54.321,
        'nodePositionAngleDegrees': 237.0,
        'periodDays': 0.81347436,
        'semiMajorAxisStellarRadii': 4.8767,
        'inclinationDegrees': 82.155,
        'transitTimeBmjdTdb': 55276.79816,
        'stellarRadiusKm': 462700.0,
        'cycles': [-1234.875, 0.0, 0.125, 0.25, 0.5, 7000.125],
    },
    {
        'id': 'near-pole-long-period',
        'rightAscensionDegrees': 359.999,
        'declinationDegrees': 89.999,
        'nodePositionAngleDegrees': 91.25,
        'periodDays': 12.3456789,
        'semiMajorAxisStellarRadii': 17.2,
        'inclinationDegrees': 89.999,
        'transitTimeBmjdTdb': 59000.125,
        'stellarRadiusKm': 695700.0,
        'cycles': [0.0, 0.375, 0.875, 12345.5],
    },
]


def sky_frame(config):
    origin = SkyCoord(
        ra=config['rightAscensionDegrees'] * u.deg,
        dec=config['declinationDegrees'] * u.deg,
        frame='icrs',
    )
    node = origin.directional_offset_by(
        config['nodePositionAngleDegrees'] * u.deg,
        90 * u.deg,
    )
    x = np.asarray(node.cartesian.xyz.value, dtype=np.float64)
    z = -np.asarray(origin.cartesian.xyz.value, dtype=np.float64)
    y = np.cross(z, x)
    return x, y / np.linalg.norm(y), z


def frame_cases():
    cases = []
    for config in FRAMES:
        x, y, z = sky_frame(config)
        cases.append({**config, 'x': x.tolist(), 'y': y.tolist(), 'z': z.tolist()})
    return cases


def orbit_cases():
    cases = []
    for config in ORBITS:
        x, y, z = sky_frame(config)
        basis = np.column_stack((x, y, z))
        inclination = np.deg2rad(config['inclinationDegrees'])
        semimajor = config['semiMajorAxisStellarRadii'] * config['stellarRadiusKm']
        rate = 2 * np.pi / config['periodDays']
        states = []
        for cycles in config['cycles']:
            epoch = 2400000.5 + config['transitTimeBmjdTdb'] + cycles * config['periodDays']
            phase = 2 * np.pi * ((epoch - 2400000.5 - config['transitTimeBmjdTdb']) / config['periodDays'])
            local_position = semimajor * np.array([
                np.sin(phase),
                -np.cos(inclination) * np.cos(phase),
                np.sin(inclination) * np.cos(phase),
            ])
            local_velocity = semimajor * rate * np.array([
                np.cos(phase),
                np.cos(inclination) * np.sin(phase),
                -np.sin(inclination) * np.sin(phase),
            ])
            position = basis @ local_position
            velocity = basis @ local_velocity
            body_x = -position / np.linalg.norm(position)
            body_z = np.cross(position, velocity)
            body_z /= np.linalg.norm(body_z)
            body_y = np.cross(body_z, body_x)
            states.append({
                'cycles': cycles,
                'epochJdTt': epoch,
                'phaseRadians': phase,
                'positionKm': position.tolist(),
                'velocityKmPerDay': velocity.tolist(),
                'bodyFixedToIcrf': np.column_stack((body_x, body_y, body_z)).reshape(-1).tolist(),
            })
        cases.append({key: value for key, value in config.items() if key != 'cycles'} | {'states': states})
    return cases


with urllib.request.urlopen(REFERENCE_URL, timeout=30) as response:
    reference = external_record(REFERENCE_URL, response.read())

write(
    'astronomy/hosted-orbit.json',
    'Astropy ICRS sky geometry and NumPy circular-orbit states',
    'tools/oracles/astronomy/hosted-orbit.py',
    {'astropy': astropy.__version__, 'methods': 'SkyCoord.directional_offset_by and NumPy vectors'},
    [],
    {'frames': frame_cases(), 'orbits': orbit_cases()},
    [reference],
)
