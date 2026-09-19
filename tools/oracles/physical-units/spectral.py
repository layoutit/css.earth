"""Independent Astropy fixtures for shared spectral-unit conversions."""
import sys
import urllib.request
from pathlib import Path

import astropy
import astropy.units as u
from astropy.constants import c, h
from astropy.modeling.models import BlackBody

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import external_record, write


ASTROPY_COMMIT = '7c5a9c124ce84c76992016e89631566ad398aff7'
REFERENCE_PATHS = [
    'astropy/modeling/physical_models.py',
    'astropy/units/astrophys.py',
]


def planck_intensity(temperature_kelvin, frequency_hz):
    value = BlackBody(temperature=temperature_kelvin * u.K)(frequency_hz * u.Hz)
    return value.to_value(u.W / (u.m ** 2 * u.Hz * u.sr))


def planck_cases():
    cases = []
    for temperature, frequency in [
        (2.7255, 30e9),
        (20.0, 950e9),
        (50.0, 233e9),
        (100.0, 233e9),
        (300.0, 345e9),
    ]:
        intensity = planck_intensity(temperature, frequency)
        low, high = 0.01, 1e6
        for _ in range(100):
            middle = (low + high) / 2
            if planck_intensity(middle, frequency) < intensity:
                low = middle
            else:
                high = middle
        cases.append({
            'temperatureKelvin': temperature,
            'frequencyHz': frequency,
            'intensityWm2HzSr': intensity,
            'invertedTemperatureKelvin': (low + high) / 2,
        })
    return cases


def rayleigh_cases():
    one_rayleigh = (1 * u.Rayleigh).to(u.photon / (u.s * u.cm ** 2 * u.arcsec ** 2))
    cases = []
    for width, wavelength in [(47.47967479674797, 1355.6), (10.0, 1304.0), (1.0, 6300.0)]:
        flux_density = 1 * u.erg / (u.s * u.cm ** 2 * u.AA * u.arcsec ** 2)
        photon_energy = (h * c / (wavelength * u.AA)).to(u.erg)
        photon_flux = (flux_density * (width * u.AA) / photon_energy * u.photon).to(
            u.photon / (u.s * u.cm ** 2 * u.arcsec ** 2)
        )
        cases.append({
            'continuumToEmissionLineAngstrom': width,
            'wavelengthAngstrom': wavelength,
            'rayleighPerFluxDensitySample': (photon_flux / one_rayleigh).value,
        })
    return cases


references = []
for path in REFERENCE_PATHS:
    url = f'https://raw.githubusercontent.com/astropy/astropy/{ASTROPY_COMMIT}/{path}'
    with urllib.request.urlopen(url, timeout=30) as response:
        references.append(external_record(url, response.read()))

write(
    'physical-units/spectral.json',
    'Astropy blackbody and Rayleigh unit conversions',
    'tools/oracles/physical-units/spectral.py',
    {'astropy': astropy.__version__, 'methods': 'BlackBody, exact constants and Rayleigh units'},
    [],
    {'planckFrequency': planck_cases(), 'rayleigh': rayleigh_cases()},
    references,
)
