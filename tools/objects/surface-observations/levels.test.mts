import { fixtureRecord } from '../../test-values.mts';
import { required } from '../../test-values.mts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitObservationLevels, selectObservation, sampleTrianglePoints } from './levels.mts';
import { validateSurfaceObservation, loadSurfaceObservation } from './index.mts';
import { namedLevelRefusal } from './surface.mts';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const policy = { minimumPairs: 64, maximumGain: 1.35 };
const sample = (radiance: number, maximumEmissionDegrees = 30) => ({ radiance, maximumEmissionDegrees });

test('calibration withholds steep-angle pairs without changing displayed source eligibility', () => {
  const a = Array.from({ length: 200 }, (_, i) => ({ ...sample(1), maximumIncidenceDegrees: i < 100 ? 30 : 75 }));
  const b = a.map((s, i) => ({ ...s, radiance: i < 100 ? 1 / 1.1 : 100 }));
  const before = structuredClone([a, b]);
  const fit = fitObservationLevels([a, b], { ...policy, maximumAngleDegrees: 70 });
  assert.equal(fit.pairs[0].samples, 100);
  assert.ok(Math.abs(fit.gains[1] - 1.1) < 1e-12);
  assert.deepEqual([a, b], before);
  assert.equal(selectObservation([a[150], b[150]]), 0);
  // With every pair withheld, each frame keeps its own level.
  const unlevelled = fitObservationLevels([a.map(s => ({ ...s, maximumIncidenceDegrees: NaN })), b], { ...policy, maximumAngleDegrees: 70 });
  assert.deepEqual(unlevelled.gains, [1, 1]); assert.deepEqual(unlevelled.groups, [[0], [1]]);
});

test('a refused level fit names the frames beyond its budget, against the first frame and the median', () => {
  // Frame a is dim: against it every other frame needs a gain of 1/5. Against the median only a itself is beyond budget.
  const levels = [1, 5, 5, 5.2];
  const samples = levels.map(level => Array.from({ length: 200 }, (_, i) => sample((1 + i / 200) * level)));
  let refusal: unknown;
  try { fitObservationLevels(samples, { minimumPairs: 64, maximumGain: 4 }); } catch (error) { refusal = error; }
  assert.ok(refusal instanceof Error && /authored gain budget/.test(refusal.message));
  const named = namedLevelRefusal(refusal, ['a', 'b', 'c', 'd'], 4);
  assert.ok(named instanceof Error);
  assert.match(named.message, /^Observation level fit exceeds its authored gain budget\. Beyond the 4× budget: a 1\.00× the first frame's level, 5\.00× the median frame's; b 0\.20×/);
  const other = new Error('something else');
  assert.equal(namedLevelRefusal(other, ['a'], 4), other, 'other errors pass through');
});

test('robust overlap fit recovers connected source scales despite missing pairs and outliers', () => {
  const gains = [1, 1.1, 1.2, .9];
  const samples = gains.map((gain, frame) => Array.from({ length: 600 }, (_, i) =>
    (frame === 0 && i > 299) || (frame === 3 && i < 300) ? { reason: 'no-geometry' } : sample((1 + i / 600) / gain * (i % 20 === 0 ? (frame + 1) : 1))));
  const result = fitObservationLevels(samples, policy);
  for (let i = 0; i < gains.length; i++) assert.ok(Math.abs(result.gains[i] - gains[i]) < 1e-12);
  assert.equal(required(result.pairs.find((p: unknown) => fixtureRecord(p)["a"] === 0 && fixtureRecord(p)["b"] === 3)).accepted, false);
});

test('archived-camera mosaics bind a separate camera to each image', async () => {
  const config = JSON.parse(await readFile(new URL('../../../src/objects/steins/source/preparation/terrestrial.json', import.meta.url), 'utf8'));
  const recipe = config.raster.surfaceObservations[0], shape = config.geometry.radialTerrain;
  validateSurfaceObservation(recipe, shape);
  for (const alter of [(r: unknown) => fixtureRecord(r,"frames",1)["cameraPath"] = fixtureRecord(r,"frames",0)["cameraPath"],
    (r: unknown) => delete fixtureRecord(r,"frames",1)["cameraPath"], (r: unknown) => fixtureRecord(r)["cameraPath"] = fixtureRecord(r,"frames",0)["cameraPath"],
(r: unknown) => fixtureRecord(r,"frames",0)["cameraPath"] = '../unbound.json', (r: unknown) => fixtureRecord(r,"photometry")["maximumGain"] = 1.1]) {
    const changed = structuredClone(recipe); alter(changed);
    assert.throws(() => validateSurfaceObservation(changed, shape), /source-bound/);
  }
});

test('each archived-camera mosaic frame verifies its original source closure before decoding', async () => {
  const sourceDirectory = resolve('src/objects/steins/source');
  const config = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8'));
  const source = await createSourceManifest({ planetId: 'steins', planetName: 'Steins', sourceRoot: sourceDirectory });
  const drift = new Error('Original camera kernel bytes changed');
  let checked = false;
  await assert.rejects(loadSurfaceObservation({ sourceDirectory, config,
    recipe: config.raster.surfaceObservations[0], radial: {
      get grid(): never { throw new Error('Geometry must not be read before source verification'); },
      get faces(): never { throw new Error('Faces must not be read before source verification'); },
    },
    // Isolate per-camera provenance verification from the separately tested group-byte validator.
    source: { ...source, validateGroup: async consumer => {
      assert.equal(consumer, 'osiris-observation');
      const entries = source.inputsFor(consumer); assert.ok(entries.length > 0); return entries;
    }, validatePath: async () => { checked = true; throw drift; } } }), error => error === drift);
  assert.equal(checked, true);
});

test('level matching keeps unconnected frames at their own level, accepts precise overlaps and rejects excessive gains', () => {
  const unconnected = fitObservationLevels([Array(100).fill(sample(1)), Array(100).fill({ reason: 'missing' })], policy);
  assert.deepEqual(unconnected.gains, [1, 1]); assert.deepEqual(unconnected.groups, [[0], [1]]);
  // Overlaps that scatter by a log spread of 0.4 around one 1.2 level ratio: many samples know the level, few do not.
  const scattered = (n: number) => [Array.from({ length: n }, () => sample(1)), Array.from({ length: n }, (_, i) => sample(Math.exp([-.4, 0, .4][i % 3]) / 1.2))];
  assert.ok(Math.abs(fitObservationLevels(scattered(999), policy).gains[1] - 1.2) < 1e-12);
  assert.deepEqual(fitObservationLevels(scattered(99), policy).groups, [[0], [1]]);
  assert.throws(() => fitObservationLevels([Array(100).fill(sample(1)), Array(100).fill(sample(.1))], policy), /budget/);
});

test('source selection preserves valid darkness, rejects missing samples, and resolves ties stably', () => {
  assert.equal(selectObservation([sample(10, 50), sample(-.01, 20), { reason: 'quality', maximumEmissionDegrees: 0 }]), 1);
  assert.equal(selectObservation([sample(0, 20), sample(100, 20)]), 0);
  assert.equal(selectObservation([{ reason: 'no-geometry' }, { reason: 'quality' }]), -1);
});

test('overlap points stay inside their own triangle and include both shape lobes', () => {
  const faces = [{ vertices: [[0, 0, 0], [2, 0, 0], [0, 2, 0]] }, { vertices: [[0, 0, 10], [2, 0, 10], [0, 2, 10]] }];
  const points = sampleTrianglePoints(faces, 24);
  assert.equal(points.length, 48);
  points.forEach(([x, y, z], i) => { assert.ok(x > 0 && y > 0 && x + y < 2); assert.ok(Math.abs(z - (i < 24 ? 0 : 10)) < 1e-12); });
});

test('the authored mosaic binds distinct images and rejects ambiguous frame policies', async () => {
  const config = JSON.parse(await readFile(new URL('../../../src/objects/comet-67p/source/preparation/terrestrial.json', import.meta.url), 'utf8'));
  const recipe = config.raster.surfaceObservations[0], shape = config.geometry.radialTerrain;
  validateSurfaceObservation(recipe, shape);
  for (const alter of [(r: unknown) => fixtureRecord(r,"frames",1)["id"] = fixtureRecord(r,"frames",0)["id"], (r: unknown) => fixtureRecord(r,"frames",1)["qualityPath"] = fixtureRecord(r,"frames",0)["qualityPath"],
(r: unknown) => fixtureRecord(r,"frames",0)["filter"] = 'unbound', (r: unknown) => fixtureRecord(r,"frames",0)["path"] = '../outside.IMG', (r: unknown) => fixtureRecord(r)["selection"] = 'brightest',
(r: unknown) => fixtureRecord(r,"levelMatching")["maximumGain"] = 3, (r: unknown) => fixtureRecord(r)["frames"] = [], (r: unknown) => fixtureRecord(r)["path"] = fixtureRecord(r,"frames",0)["path"]]) {
    const changed = structuredClone(recipe); alter(changed); assert.throws(() => validateSurfaceObservation(changed, shape), /source-bound/);
  }
});
