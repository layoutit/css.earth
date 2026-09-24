import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readOracleFixture } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { brightnessTemperatureKelvin, planckIntensity } from './interferometry/alma-disc-selfcal.mts';
import { rayleighPerSample } from './hst/line-stack-reduction.mts';

const fixture = await readOracleFixture('physical-units/spectral.json');
function relativeClose(actual: number, expected: number, label: string, tolerance = 3e-12) {
  const relative = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(relative <= tolerance, `${label}: ${actual} differs from ${expected} by ${relative}`);
}

test('frequency-form Planck intensity and its inverse match Astropy BlackBody', () => {
  for (const entry of requireArray(fixture.cases.planckFrequency)) {
    const expected = requireRecord(entry), temperature = requireFiniteNumber(expected.temperatureKelvin);
    const frequency = requireFiniteNumber(expected.frequencyHz), intensity = requireFiniteNumber(expected.intensityWm2HzSr);
    relativeClose(planckIntensity(temperature, frequency), intensity, `${temperature} K at ${frequency} Hz intensity`);
    relativeClose(brightnessTemperatureKelvin(intensity, frequency), requireFiniteNumber(expected.invertedTemperatureKelvin), `${frequency} Hz inverse`);
  }
});

test('HST flux-density samples convert to Rayleigh through Astropy units', () => {
  for (const entry of requireArray(fixture.cases.rayleigh)) {
    const expected = requireRecord(entry), width = requireFiniteNumber(expected.continuumToEmissionLineAngstrom);
    const wavelength = requireFiniteNumber(expected.wavelengthAngstrom), factor = requireFiniteNumber(expected.rayleighPerFluxDensitySample);
    relativeClose(rayleighPerSample(width, wavelength), factor, `${width} Angstrom at ${wavelength} Angstrom`);
  }
});
