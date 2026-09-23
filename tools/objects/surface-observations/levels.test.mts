import { fixtureRecord } from '../../contract/test-values.mts';
import { required } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { edgeWeights, finestOnSurface, fitObservationLevels, pixelOnSurface, selectObservation, sampleTrianglePoints } from './levels.mts';
import { validateSurfaceObservation, loadSurfaceObservation } from './index.mts';
import { namedLevelRefusal } from './surface.mts';
import { observingSeasons } from './formats/controlled-camera.mts';
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
  const source = await createSourceManifest({ objectId: 'steins', objectName: 'Steins', sourceRoot: sourceDirectory });
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

test('frames without a calibrated level are placed season by season through their overlaps', () => {
  // Two seasons 20× apart, as Kleopatra's 2017 and 2018 frames are; each season's frames within 1.2× of each other.
  const levels = [1, 1.2, 20, 22], seasons = [0, 0, 1, 1];
  const samples = levels.map(level => Array.from({ length: 300 }, (_, i) => sample((1 + i / 300) * level)));
  assert.throws(() => fitObservationLevels(samples, { minimumPairs: 64, maximumGain: 4 }), /budget/, 'one budget across seasons refuses them');
  const fit = fitObservationLevels(samples, { minimumPairs: 64, maximumGain: 4 }, seasons);
  levels.forEach((level, i) => assert.ok(Math.abs(fit.gains[i] - 1 / level) < 1e-12, `frame ${i} matched to the first`));
  assert.deepEqual(fit.seasons, seasons);
  assert.equal('seasons' in fitObservationLevels(samples.slice(0, 2), { minimumPairs: 64, maximumGain: 4 }, [0, 0]), false, 'one season reports as before');
  // Within a season the budget still holds, against the season's own first frame.
  const wide = [1, 1.2, 20, 100].map(level => Array.from({ length: 300 }, (_, i) => sample((1 + i / 300) * level)));
  let refusal: unknown;
  try { fitObservationLevels(wide, { minimumPairs: 64, maximumGain: 4 }, seasons); } catch (error) { refusal = error; }
  const named = namedLevelRefusal(refusal, ['a', 'b', 'c', 'd'], 4);
  assert.ok(named instanceof Error);
  assert.match(named.message, /Beyond the 4× budget: d 0\.20× its season's first frame's level/);
});

test('with seasons, a frame no accepted overlap reaches is refused and named', () => {
  const samples = [Array(200).fill(sample(1)), Array(200).fill(sample(1.1)), Array(200).fill({ reason: 'missing' })];
  let refusal: unknown;
  try { fitObservationLevels(samples, { minimumPairs: 64, maximumGain: 4 }, [0, 0, 1]); } catch (error) { refusal = error; }
  assert.ok(refusal instanceof Error && /no calibrated level/.test(refusal.message));
  const named = namedLevelRefusal(refusal, ['a', 'b', 'c'], 4);
  assert.ok(named instanceof Error);
  assert.match(named.message, /Groups no accepted overlap joins: a, b \| c\.$/);
  assert.deepEqual(fitObservationLevels(samples, { minimumPairs: 64, maximumGain: 4 }).groups, [[0, 1], [2]], 'without seasons the frame keeps its own level');
});

test('seasons follow the frames\' start times, a new one at the gap or more', () => {
  assert.deepEqual(observingSeasons(['2017-07-14T05:00:59.538', '2017-08-22T01:42:34', '2018-12-10T06:41:03', '2019-01-14T04:57:42']), [0, 0, 1, 1]);
  assert.deepEqual(observingSeasons(['2018-12-10T06:41:03', '2017-07-14T05:00:59']), [1, 0], 'counted in time order, reported in frame order');
  assert.deepEqual(observingSeasons(['2018-01-01T00:00:00', '2018-05-01T00:00:00']), [0, 1], '120 days apart');
  assert.deepEqual(observingSeasons(['2018-01-01T00:00:00', '2018-04-30T23:59:59']), [0, 0]);
  assert.throws(() => observingSeasons(['no time']), /start time/);
});

test('the finest resolution is the least surface under one pixel, not the nearest frame', () => {
  assert.equal(pixelOnSurface(1000, 0), 1000);
  assert.ok(Math.abs(pixelOnSurface(1000, 60) - 2000) < 1e-9, 'a view 60° from the normal spreads a pixel over twice the surface');
  assert.throws(() => pixelOnSurface(1000, 90), /emission/);
  assert.throws(() => pixelOnSurface(1000, undefined), /emission/);
  // A nearer frame seeing the point at 70° (2.92 per pixel) loses to one 20% farther seeing it at 10° (1.22).
  const scales = [1, 1.2, 2], emissions = [70, 10, 0], asked: number[] = [];
  const pick = finestOnSurface([0, 1, 2], scales, frame => { asked.push(frame); return { maximumEmissionDegrees: emissions[frame] }; });
  assert.equal(pick.index, 1);
  assert.deepEqual(asked, [0, 1], 'a frame whose own scale is already coarser than the best is never sampled');
  assert.equal(finestOnSurface([0, 1, 2], scales, () => undefined).index, -1);
  // The early stop always agrees with comparing every frame, ties going to the earlier frame in scale order.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let trial = 0; trial < 500; trial++) {
    const count = 1 + Math.floor(random() * 8), frameScales = Array.from({ length: count }, () => 1 + Math.floor(random() * 4) / 2);
    const views = Array.from({ length: count }, () => random() < .3 ? undefined : { maximumEmissionDegrees: Math.floor(random() * 9) * 10 });
    const order = frameScales.map((_, i) => i).sort((a, b) => frameScales[a] - frameScales[b] || a - b);
    let brute = -1, size = Infinity;
    for (const i of order) { const view = views[i]; if (!view) continue; const candidate = pixelOnSurface(frameScales[i], view.maximumEmissionDegrees); if (candidate < size) { brute = i; size = candidate; } }
    assert.equal(finestOnSurface(order, frameScales, i => views[i]).index, brute, `trial ${trial}`);
  }
});

test('the edge-weighted average weighs each qualifying frame by its depth inside its disc over its pixel area', () => {
  const scales = [1, 2, 1], depths = [.5, 1, .2];
  const mix = required(edgeWeights([true, true, false], frame => depths[frame], scales));
  assert.deepEqual(mix.weights, [.5, .25, 0], 'a frame that does not qualify carries nothing, however deep the point lies in it');
  assert.equal(mix.index, 0);
  assert.equal(mix.total, .75);
  // A frame fades out as the point nears its edge: its share goes to zero with its depth, so its value never stops abruptly.
  const shares = [.4, .2, .1, .01, 0].map(depth => { const faded = required(edgeWeights([true, true], frame => frame === 0 ? depth : 1, [1, 1])); return faded.weights[0] / faded.total; });
  shares.reduce((previous, share) => { assert.ok(share <= previous); return share; });
  assert.equal(shares.at(-1), 0);
  assert.equal(edgeWeights([false, false], () => 1, [1, 1]), null);
  assert.throws(() => edgeWeights([true], () => 0, [1]), /no weight/);
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
