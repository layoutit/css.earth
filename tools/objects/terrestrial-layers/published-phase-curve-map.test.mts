import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { planckRadiance } from '../eclipse-map/eigenmap-fit.mts';
import { brightnessTemperature, impliedStellarTemperature, loadPublishedPhaseCurveMap, parsePublishedPhaseCurve, sinusoidMap } from './published-phase-curve-map.mts';

const test = sourceTest();
const objects = new URL('../../../src/objects/', import.meta.url);
const record = async (path: string) => parsePublishedPhaseCurve(JSON.parse(await readFile(new URL(path, objects), 'utf8')));

test('the Cowan & Agol map, integrated over the visible hemisphere, gives back the light curve it came from', async () => {
  const kelt = await record('kelt-9b/source/science/mansfield-2020/phase-curve.json');
  if (kelt.model.kind !== 'two-term-sinusoid') throw new TypeError('KELT-9b is a two-term sinusoid.');
  const { flux, slice } = sinusoidMap(kelt.model, kelt.eclipseDepth);
  // Cowan & Agol (2008), their equation 4: F(xi) is J(phi) cos(phi + xi) over the hemisphere that faces the observer, integrated
  // here by the midpoint rule, independently of equation 5's coefficients.
  const convolve = (xi: number, steps = 20000) => {
    let sum = 0; const from = -xi - Math.PI / 2, step = Math.PI / steps;
    for (let i = 0; i < steps; i++) { const phi = from + (i + 0.5) * step; sum += slice(phi * 180 / Math.PI) * Math.cos(phi + xi) * step; }
    return sum;
  };
  for (const degrees of [-180, -120, -60, -16.5, 0, 45, 90, 150]) {
    const xi = degrees * Math.PI / 180;
    assert.ok(Math.abs(convolve(xi) - flux(xi)) < 1e-9, `${degrees} degrees: ${convolve(xi)} vs ${flux(xi)}`);
  }
  assert.ok(Math.abs(flux(0) - kelt.eclipseDepth) < 1e-15, 'the planet shows its eclipse depth at mid-eclipse');
});

test('brightness temperature inverts the Planck ratio, and the implied star temperature returns the paper\'s day side', () => {
  for (const [starK, planetK] of [[7942, 4566], [5695, 1259], [10000, 300]] as const) {
    const ratio = planckRadiance(4.5, planetK) / planckRadiance(4.5, starK);
    assert.ok(Math.abs(brightnessTemperature(ratio, starK, 4.5)! - planetK) < 1e-6);
  }
  assert.equal(brightnessTemperature(0, 6000, 4.5), null);
  assert.equal(brightnessTemperature(-1e-4, 6000, 4.5), null);
  const star = impliedStellarTemperature(0.003131, 0.08004, 4566, 4.5);
  assert.ok(Math.abs(0.08004 ** 2 * planckRadiance(4.5, 4566) / planckRadiance(4.5, star) - 0.003131) < 1e-12);
});

test('KELT-9b: Mansfield et al. (2020)\'s sinusoids reproduce their amplitude, night side and hottest hemisphere', async () => {
  const map = await loadPublishedPhaseCurveMap(new URL('kelt-9b/source', objects).pathname, { path: 'science/mansfield-2020/phase-curve.json' });
  const { derived, stellarBandTemperatureK } = map.report as unknown as { derived: Record<string, number>; stellarBandTemperatureK: number };
  // Table 1: amplitude 0.609 +/- 0.020, night side 2556 +101/-97 K, hottest hemisphere 4636 +145/-138 K.
  assert.ok(Math.abs(derived.amplitude! - 0.609) <= 0.020, `amplitude ${derived.amplitude}`);
  assert.ok(Math.abs(derived.nightsideK! - 2556) <= 97, `night side ${derived.nightsideK}`);
  assert.ok(Math.abs(derived.hottestHemisphereK! - 4636) <= 138, `hottest hemisphere ${derived.hottestHemisphereK}`);
  assert.ok(Math.abs(derived.daysideK! - 4566) < 1e-6);
  // The curve peaks 16.5 degrees before eclipse; Table 1 gives 18.7 +2.1/-2.3. The difference is inside the lower bound.
  assert.ok(Math.abs(derived.peakDegreesBeforeEclipse! - 16.48) < 0.01 && 18.7 - derived.peakDegreesBeforeEclipse! <= 2.3);
  // The 8287 K the paper uses in its energy-balance model (section 5) is not the conversion behind its day and night values.
  assert.ok(Math.abs(stellarBandTemperatureK - 7941.9) < 0.1);
  // Every latitude is drawn alike, and the hottest longitude is east of noon.
  assert.equal(map.sample(20, 60), map.sample(20, -60));
  let hottest = -180, peak = -Infinity;
  for (let lon = -180; lon < 180; lon += 0.1) { const t = map.sample(lon, 0)!; if (t > peak) { peak = t; hottest = lon; } }
  assert.ok(hottest > 10 && hottest < 30, `hottest longitude ${hottest}`);
});

test('WASP-76b: SPIDERMAN evaluates May et al. (2021)\'s dipole to their day side and near their night side', async () => {
  const map = await loadPublishedPhaseCurveMap(new URL('wasp-76b/source', objects).pathname, { path: 'science/may-2021/phase-curve.json' });
  const report = map.report as unknown as { spiderman: string; derived: Record<string, number> };
  assert.equal(report.spiderman, '1.0.3');
  const { derived } = report;
  // Section 3.3: eclipse depth 3729 +/- 52 ppm and day side 2699 +/- 32 K after the dilution correction.
  assert.ok(Math.abs(derived.daysideFlux! - 0.003729) <= 0.000052, `day side flux ${derived.daysideFlux}`);
  assert.ok(Math.abs(derived.daysideK! - 2699) <= 32, `day side ${derived.daysideK}`);
  // Night side 1259 +/- 44 K: the table's two-digit coefficients give 1185 K, 1.7 standard deviations colder (README, Known problems).
  assert.ok(derived.nightsideK! > 1259 - 2 * 44 && derived.nightsideK! < 1259, `night side ${derived.nightsideK}`);
  // A dipole centred on the substellar point: no longitude offset in the curve, the same temperature east and west of noon.
  assert.ok(Math.abs(derived.peakDegreesAfterEclipse!) < 0.01);
  assert.ok(Math.abs(map.sample(40, 0)! - map.sample(-40, 0)!) < 1e-6);
  // Around the antistellar point the fitted dipole is below zero; those cells have no temperature.
  assert.equal(map.sample(180, 0), null);
  assert.ok(derived.nonPositiveAreaFraction! > 0.02 && derived.nonPositiveAreaFraction! < 0.05);
});
