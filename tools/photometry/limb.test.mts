import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { limbFactors, limbLawFromRecords, limbOverlay, linearToSrgb, parseLimbBlock, scatteringAngles, srgbToLinear } from './limb.mts';
import { haloAltitudeKm, haloRatio, parseLimbProfile, PSG_LIMB_TABLE_SCHEMA } from './halo.mts';
import { parsePhotometricModelRecord } from './model-record.mts';

const record = (id: string, model: unknown) => parsePhotometricModelRecord({ schema: 'cssearth-photometric-model@1', id, instrument: 'fixture', filter: 'fixture', quantity: 'radiance-factor', model, fit: { phaseDegrees: [0, 10], emissionDegrees: [0, 80] } });
const minnaert = (k: number) => record(`k${String(k).replace('.', '-')}`, { family: 'separable', disk: { family: 'minnaert', coefficient: k, coefficientPerDegree: 0 } });
const paths = ['photometry/r.json', 'photometry/g.json', 'photometry/b.json'] as const;
const degrees = Math.PI / 180;

test('limb factors are 1 at the flood-lit disc centre, follow the law elsewhere and are 0 on the night side', () => {
  const law = limbLawFromRecords(paths, [minnaert(0.5), minnaert(0.8), minnaert(1)]);
  assert.deepEqual(limbFactors(law, 0, 0, 0), [1, 1, 1]);
  const mu = Math.cos(60 * degrees), flood = limbFactors(law, 60 * degrees, 60 * degrees, 0);
  [0.5, 0.8, 1].forEach((k, channel) => assert.ok(Math.abs(flood[channel] - mu ** (2 * k - 1)) < 1e-12));
  assert.deepEqual(limbFactors(law, 95 * degrees, 10 * degrees, 90 * degrees), [0, 0, 0]);
  const edge = Math.cos(80 * degrees), held = limbFactors(law, 89 * degrees, 89 * degrees, 0);
  [0.5, 0.8, 1].forEach((k, channel) => assert.ok(Math.abs(held[channel] - edge ** (2 * k - 1)) < 1e-12, `held at the fitted edge, channel ${channel}`));
  const ks3 = limbLawFromRecords(paths, Array(3).fill(record('ks3', { family: 'separable', disk: { family: 'lunar-lambert', weight: 0.6424 }, phase: { family: 'exponential', slopePerRadian: 0.5628 } })) as never);
  const side = limbFactors(ks3, 60 * degrees, 0, 60 * degrees)[0];
  assert.ok(Math.abs(side - Math.exp(-0.5628 * Math.PI / 3) * (0.6424 * 2 * 0.5 / 1.5 + 0.3576 * 0.5)) < 1e-12);
});

test('the overlay is exact for the reference colour and for the channel that sets its alpha', () => {
  const reference = [180, 120, 60] as const, factors = [0.9, 0.5, 1.4];
  const [r, g, b, alpha] = limbOverlay(factors, reference);
  const over = (base: number, colour: number) => base * (1 - alpha) + colour * alpha;
  [r, g, b].forEach((colour, channel) => {
    const expected = Math.min(255, linearToSrgb(Math.min(1, srgbToLinear(reference[channel]) * factors[channel])));
    assert.ok(Math.abs(over(reference[channel], colour) - expected) < 1e-9, `channel ${channel}`);
  });
  assert.deepEqual(limbOverlay([1, 1, 1], reference), [0, 0, 0, 0]);
  const night = limbOverlay([0, 0, 0], reference);
  assert.equal(night[3], 1);
  assert.deepEqual(night.slice(0, 3), [0, 0, 0]);
});

test('scattering angles floor the emission cosine and read phase from light and view', () => {
  const { incidence, emission, phase } = scatteringAngles([1, 0, 0], [0, 0, 1], [0, 0, 1], 0.01);
  assert.equal(incidence, Math.PI / 2);
  assert.ok(Math.abs(emission - Math.acos(0.01)) < 1e-12);
  assert.equal(phase, 0);
});

test('limb blocks name three records and refuse anything else', () => {
  assert.deepEqual(parseLimbBlock({ models: [...paths] }, 'fixture').models, paths);
  assert.throws(() => parseLimbBlock({ models: paths.slice(0, 2) }, 'fixture'), /three records/);
  assert.throws(() => parseLimbBlock({ models: [...paths], floor: 0.35 }, 'fixture'), /unknown keys: floor/);
  assert.throws(() => parseLimbBlock({ models: [...paths], reference: '../escape.png' }, 'fixture'), /source-relative/);
});

test('the PSG halo profile interpolates log radiance with altitude and ends at its top altitude', () => {
  const profile = parseLimbProfile({ schema: PSG_LIMB_TABLE_SCHEMA, body: 'fixture', radiusKm: 1000, altitudesKm: [0, 10, 20],
    nadirOverheadSun: { red: 10, green: 10, blue: 10 }, radiance: { red: [4, 1, 0.25], green: [2, 1, 0.5], blue: [1, 1, 1] } }, 'fixture');
  haloRatio(profile, 0).forEach((value, channel) => assert.ok(Math.abs(value - [0.4, 0.2, 0.1][channel]) < 1e-12));
  const middle = haloRatio(profile, 5);
  assert.ok(Math.abs(middle[0] - 0.2) < 1e-12 && Math.abs(middle[1] - Math.SQRT2 / 10) < 1e-12 && Math.abs(middle[2] - 0.1) < 1e-12);
  assert.deepEqual(haloRatio(profile, 25), [0, 0, 0]);
  assert.throws(() => parseLimbProfile({ schema: PSG_LIMB_TABLE_SCHEMA, radiusKm: 1000, altitudesKm: [0, 10], nadirOverheadSun: { red: 1, green: 1, blue: 1 }, radiance: { red: [1], green: [1, 1], blue: [1, 1] } }, 'fixture'), /one positive value per altitude/);
});

test('the halo starts at the visible disc edge: the content scale is the edge altitude, and altitude grows with the edge radius', () => {
  const profile = parseLimbProfile({ schema: PSG_LIMB_TABLE_SCHEMA, body: 'fixture', radiusKm: 6051.8, altitudesKm: [75, 80],
    nadirOverheadSun: { red: 1, green: 1, blue: 1 }, radiance: { red: [0.04, 0.02], green: [0.07, 0.03], blue: [0.11, 0.05] } }, 'fixture');
  // Venus: the lit map ends at the lane's 0.992 content scale, and the cloud top at 75 km is that edge.
  assert.equal(haloAltitudeKm(profile, 0.992, 0.992, 75), 75);
  assert.ok(Math.abs(haloAltitudeKm(profile, 0.992 * 1.001, 0.992, 75) - (75 + 0.001 * 6126.8)) < 1e-9);
  // The frame's fitted silhouette (radius 1) is already 49 km above the cloud top, not the cloud top itself.
  assert.ok(Math.abs(haloAltitudeKm(profile, 1, 0.992, 75) - (75 + (1 / 0.992 - 1) * 6126.8)) < 1e-9);
  // Mars: a surface edge, altitude 0 at the content scale.
  assert.equal(haloAltitudeKm(parseLimbProfile({ schema: PSG_LIMB_TABLE_SCHEMA, body: 'mars', radiusKm: 3389.9, altitudesKm: [0, 10],
    nadirOverheadSun: { red: 1, green: 1, blue: 1 }, radiance: { red: [1, 1], green: [1, 1], blue: [1, 1] } }, 'fixture'), 0.992, 0.992, 0), 0);
  assert.throws(() => haloAltitudeKm(profile, 1, 0, 75), /positive content scale/);
});
