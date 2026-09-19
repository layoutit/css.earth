"""Independent numerical fixtures for the eclipse-map harmonics, fit and temperature conversion."""
import math
import sys
import urllib.request
from pathlib import Path

import astropy
import astropy.units as u
import numpy as np
from astropy.modeling.models import BlackBody

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import external_record, write


COMMIT = '74a8fec0462f4583e336bbc44e2f2441b263a49f'
REFERENCE_URLS = [
    f'https://raw.githubusercontent.com/rychallener/ThERESA/{COMMIT}/theresa/lib/model.py',
    f'https://raw.githubusercontent.com/rychallener/ThERESA/{COMMIT}/theresa/lib/utils.py',
]


def harmonic_case():
    latitudes = np.array([-89.9, -60, -5, 0, 23.5, 72], dtype=np.float64)
    longitudes = np.array([-180, -123.4, 179.9, 0, 47, -91], dtype=np.float64)
    x = np.sin(np.deg2rad(latitudes))
    values = []
    order = []
    for degree in range(1, 7):
        polynomial = np.polynomial.Legendre.basis(degree)
        for signed_order in range(-degree, degree + 1):
            order.append([degree, signed_order])
            magnitude = abs(signed_order)
            associated = (1 - x * x) ** (magnitude / 2) * polynomial.deriv(magnitude)(x)
            factorial_ratio = math.factorial(degree - magnitude) / math.factorial(degree + magnitude)
            norm = np.sqrt((2 * degree + 1) * (1 if magnitude == 0 else 2) * factorial_ratio)
            angle = magnitude * np.deg2rad(longitudes)
            trig = np.ones_like(angle) if signed_order == 0 else np.cos(angle) if signed_order > 0 else np.sin(angle)
            values.append((norm * associated * trig).tolist())
    return {'order': order, 'values': values}


CURVES = np.array([
    [-0.7, -0.3, 0, 0.25, 0.8, 1.1, 0.4, -0.5, 0.2],
    [0.2, 0.9, -0.4, -0.8, 0.1, 0.6, -0.2, 1, -0.7],
], dtype=np.float64)
UNIFORM = np.array([0.8, 0.85, 0.9, 1, 1.1, 0.95, 0.75, 0.88, 1.02], dtype=np.float64)
SYSTEMATIC = np.array([-1, -0.7, -0.3, 0, 0.2, 0.5, 0.8, 1.1, 1.4], dtype=np.float64)
TRUTH = np.array([0.003, -0.002, 0.015, -0.004, 0.0015], dtype=np.float64)
RESIDUAL = np.array([0.0001, -0.0002, 0.00005, 0.0003, -0.0001, 0.0002, -0.00015, 0.00005, -0.00025], dtype=np.float64)
ERRORS = np.array([0.0003, 0.0004, 0.00025, 0.0005, 0.00035, 0.00045, 0.00028, 0.00032, 0.00038], dtype=np.float64)


def fit_case():
    design = np.column_stack((CURVES.T, UNIFORM, np.ones(UNIFORM.size), SYSTEMATIC))
    target = design @ TRUTH + RESIDUAL
    weights = 1 / ERRORS ** 2
    normal = design.T @ (weights[:, None] * design)
    rhs = design.T @ (weights * target)
    solution = np.linalg.solve(normal, rhs)
    residual = target - design @ solution
    chi_squared = np.sum((residual / ERRORS) ** 2)
    return {
        'normalMatrix': normal.reshape(-1).tolist(),
        'rhs': rhs.tolist(),
        'dataSquares': float(np.sum(weights * target ** 2)),
        'solution': solution.tolist(),
        'covariance': np.linalg.inv(normal).reshape(-1).tolist(),
        'chiSquared': float(chi_squared),
        'bic': float(chi_squared + solution.size * np.log(target.size)),
    }


def radiance(wavelength_microns, temperature):
    wavelength = np.asarray(wavelength_microns) * u.um
    blackbody = BlackBody(temperature=temperature * u.K)(wavelength)
    return blackbody.to(u.W / (u.m ** 3 * u.sr), equivalencies=u.spectral_density(wavelength)).value


def temperature_case():
    ratio = 0.15883
    correction = 0.002
    stellar_temperature = 4520
    single_temperature = 1450
    wavelength = 4.5
    single_flux = ratio ** 2 / (np.pi * (1 + correction)) * radiance(wavelength, single_temperature) / radiance(wavelength, stellar_temperature)
    wavelengths = np.array([5, 5.7, 6.8, 8.2, 9.6, 10.5], dtype=np.float64)
    response = np.array([0.2, 0.8, 1, 0.65, 0.9, 0.1], dtype=np.float64)
    band_temperature = 1730
    planet_band = np.trapezoid(radiance(wavelengths, band_temperature) * response, wavelengths)
    stellar_band = np.trapezoid(radiance(wavelengths, stellar_temperature) * response, wavelengths)
    band_flux = ratio ** 2 / (np.pi * (1 + correction)) * planet_band / stellar_band
    samples = [1.2, 4.5, 10, 20]
    return {
        'radianceWavelengthsMicrons': samples,
        'radianceTemperatureK': single_temperature,
        'radianceWm3Sr': np.asarray(radiance(samples, single_temperature)).tolist(),
        'singleFlux': float(single_flux),
        'singleTemperatureK': single_temperature,
        'bandFlux': float(band_flux),
        'bandTemperatureK': band_temperature,
    }


references = []
for url in REFERENCE_URLS:
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read()
    references.append(external_record(url, data))

write(
    'eclipse-map/numerics.json',
    'NumPy linear algebra and Astropy blackbody numerics',
    'tools/oracles/eclipse-map/numerics.py',
    {'astropy': astropy.__version__, 'methods': 'Legendre derivatives, numpy.linalg, astropy BlackBody'},
    [],
    {'harmonics': harmonic_case(), 'fit': fit_case(), 'temperature': temperature_case()},
    references,
)
