import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readOracleFixture } from '../../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../../sources/source-values.mts';
import { bandBrightnessTemperature, brightnessTemperature, fitEigenmap, planckRadiance, sampleEigenmap } from './eigenmap-fit.mts';
import { harmonicOrder, realSphericalHarmonics } from './spherical-harmonics.mts';

const fixture = await readOracleFixture('eclipse-map/numerics.json');
const numbers = (value: unknown) => requireArray(value).map(entry => requireFiniteNumber(entry));
function close(actual: number, expected: number, label: string, relative = 2e-10) {
  const error = Math.abs(actual - expected), tolerance = relative * Math.max(1, Math.abs(expected));
  assert.ok(error <= tolerance, `${label}: ${actual} differs from ${expected} by ${error}`);
}

test('real spherical harmonics match independent Legendre-polynomial derivatives', () => {
  const latitudes = [-89.9, -60, -5, 0, 23.5, 72], longitudes = [-180, -123.4, 179.9, 0, 47, -91];
  const expected = requireRecord(fixture.cases.harmonics);
  const order = requireArray(expected.order).map(entry => numbers(entry));
  assert.deepEqual(harmonicOrder(6), order);
  const actual = realSphericalHarmonics(6, latitudes, longitudes), values = requireArray(expected.values).map(entry => numbers(entry));
  assert.equal(actual.length, values.length);
  actual.forEach((row, harmonic) => row.forEach((value, point) => close(value, values[harmonic]![point]!, `harmonic ${harmonic}, point ${point}`, 2e-11)));
});

const curves = [
  Float64Array.from([-0.7, -0.3, 0, 0.25, 0.8, 1.1, 0.4, -0.5, 0.2]),
  Float64Array.from([0.2, 0.9, -0.4, -0.8, 0.1, 0.6, -0.2, 1, -0.7]),
];
const uniform = Float64Array.from([0.8, 0.85, 0.9, 1, 1.1, 0.95, 0.75, 0.88, 1.02]);
const systematic = Float64Array.from([-1, -0.7, -0.3, 0, 0.2, 0.5, 0.8, 1.1, 1.4]);
const truth = [0.003, -0.002, 0.015, -0.004, 0.0015];
const residual = [0.0001, -0.0002, 0.00005, 0.0003, -0.0001, 0.0002, -0.00015, 0.00005, -0.00025];
const errors = Float64Array.from([0.0003, 0.0004, 0.00025, 0.0005, 0.00035, 0.00045, 0.00028, 0.00032, 0.00038]);
const data = Float64Array.from(uniform, (_, i) => 1 + curves[0]![i]! * truth[0]! + curves[1]![i]! * truth[1]! + uniform[i]! * truth[2]! + truth[3]! + systematic[i]! * truth[4]! + residual[i]!);
const basis = { curves, uniform, visible: new Uint8Array(2), maps: [new Float64Array(2), new Float64Array(2)] };

test('linear eigenmap fit and posterior match NumPy normal equations', () => {
  const expected = requireRecord(fixture.cases.fit);
  const fit = fitEigenmap(basis as never, 2, data, errors, () => true, { positive: false, systematics: [systematic] });
  const solution = [...fit.coefficients, fit.uniformAmplitude, fit.stellarCorrection, ...fit.systematics];
  solution.forEach((value, i) => close(value, numbers(expected.solution)[i]!, `solution ${i}`));
  fit.normal.matrix.forEach((value, i) => close(value, numbers(expected.normalMatrix)[i]!, `normal matrix ${i}`));
  fit.normal.rhs.forEach((value, i) => close(value, numbers(expected.rhs)[i]!, `normal rhs ${i}`));
  close(fit.normal.dataSquares, requireFiniteNumber(expected.dataSquares), 'data squares');
  close(fit.chiSquared, requireFiniteNumber(expected.chiSquared), 'chi squared', 2e-7);
  close(fit.bic, requireFiniteNumber(expected.bic), 'BIC', 2e-8);

  const covariance = numbers(expected.covariance), posterior = sampleEigenmap(basis as never, fit, { steps: 120000, burn: 20000, keep: 4000, seed: 19 });
  const mean = solution.map((_, i) => posterior.samples.reduce((sum, sample) => sum + sample[i]!, 0) / posterior.samples.length);
  const empirical = solution.flatMap((_, i) => solution.map((__, j) => posterior.samples.reduce((sum, sample) => sum + (sample[i]! - mean[i]!) * (sample[j]! - mean[j]!), 0) / (posterior.samples.length - 1)));
  mean.forEach((value, i) => {
    const sigma = Math.sqrt(covariance[i * solution.length + i]!);
    assert.ok(Math.abs(value - solution[i]!) < 0.12 * sigma, `posterior mean ${i}`);
  });
  empirical.forEach((value, index) => {
    const i = Math.floor(index / solution.length), j = index % solution.length;
    const scale = Math.sqrt(covariance[i * solution.length + i]! * covariance[j * solution.length + j]!);
    assert.ok(Math.abs(value - covariance[index]!) < 0.12 * scale, `posterior covariance ${i},${j}`);
  });
});

test('Planck radiance and brightness-temperature inversions match Astropy', () => {
  const expected = requireRecord(fixture.cases.temperature), wavelengths = numbers(expected.radianceWavelengthsMicrons);
  const temperature = requireFiniteNumber(expected.radianceTemperatureK), radiance = numbers(expected.radianceWm3Sr);
  wavelengths.forEach((wavelength, i) => close(planckRadiance(wavelength, temperature), radiance[i]!, `radiance ${wavelength} um`, 2e-12));
  const radiusRatio = 0.15883, correction = 0.002, stellarTemperatureK = 4520;
  close(brightnessTemperature(requireFiniteNumber(expected.singleFlux), 4.5, radiusRatio, stellarTemperatureK, correction), requireFiniteNumber(expected.singleTemperatureK), 'single-wavelength temperature', 2e-10);
  const band = { wavelengthMicrons: [5, 5.7, 6.8, 8.2, 9.6, 10.5], response: [0.2, 0.8, 1, 0.65, 0.9, 0.1] };
  const flux = requireFiniteNumber(expected.bandFlux), bandTemperature = requireFiniteNumber(expected.bandTemperatureK);
  close(bandBrightnessTemperature(flux, band, radiusRatio, { stellarTemperatureK }, correction), bandTemperature, 'band temperature', 2e-9);
  close(bandBrightnessTemperature(flux, { ...band, response: band.response.map(value => 7 * value) }, radiusRatio, { stellarTemperatureK }, correction), bandTemperature, 'response-scale invariant temperature', 2e-9);
});
