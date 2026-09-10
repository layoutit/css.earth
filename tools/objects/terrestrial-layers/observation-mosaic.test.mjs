import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitObservationLevels, selectObservation, sampleTrianglePoints } from './observation-mosaic.mts';
import { validateGeoSurfaceRecipe, loadGeoObservationSurface } from './observed-geo-surface.mts';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
const policy = { minimumPairs: 64, maximumLogMad: .25, maximumGain: 1.35 };
const sample = (radiance, maximumEmissionDegrees = 30) => ({ radiance, maximumEmissionDegrees });

test('calibration withholds steep-angle pairs without changing displayed source eligibility', () => {
  const a = Array.from({ length: 200 }, (_, i) => ({ ...sample(1), maximumIncidenceDegrees: i < 100 ? 30 : 75 }));
  const b = a.map((s, i) => ({ ...s, radiance: i < 100 ? 1 / 1.1 : 100 }));
  const before = structuredClone([a, b]);
  const fit = fitObservationLevels([a, b], { ...policy, maximumAngleDegrees: 70 });
  assert.equal(fit.pairs[0].samples, 100);
  assert.ok(Math.abs(fit.gains[1] - 1.1) < 1e-12);
  assert.deepEqual([a, b], before);
  assert.equal(selectObservation([a[150], b[150]]), 0);
  assert.throws(() => fitObservationLevels([a.map(s => ({ ...s, maximumIncidenceDegrees: NaN })), b], { ...policy, maximumAngleDegrees: 70 }), /connect/);
});

test('robust overlap fit recovers connected source scales despite missing pairs and outliers', () => {
  const gains = [1, 1.1, 1.2, .9];
  const samples = gains.map((gain, frame) => Array.from({ length: 600 }, (_, i) =>
    (frame === 0 && i > 299) || (frame === 3 && i < 300) ? { reason: 'no-geometry' } : sample((1 + i / 600) / gain * (i % 20 === 0 ? (frame + 1) : 1))));
  const result = fitObservationLevels(samples, policy);
  for (let i = 0; i < gains.length; i++) assert.ok(Math.abs(result.gains[i] - gains[i]) < 1e-12);
  assert.equal(result.pairs.find(p => p.a === 0 && p.b === 3).accepted, false);
});

test('archived-camera mosaics bind a separate camera to each image', async () => {
  const config = JSON.parse(await readFile(new URL('../../../src/planets/steins/source/preparation/terrestrial.json', import.meta.url)));
  const recipe = config.raster.surfaceObservations[0], shape = config.geometry.radialTerrain;
  validateGeoSurfaceRecipe(recipe, shape);
  for (const alter of [r => r.frames[1].cameraPath = r.frames[0].cameraPath,
    r => delete r.frames[1].cameraPath, r => r.cameraPath = r.frames[0].cameraPath,
    r => r.frames[0].cameraPath = '../unbound.json', r => r.photometry.maximumGain = 1.1]) {
    const changed = structuredClone(recipe); alter(changed);
    assert.throws(() => validateGeoSurfaceRecipe(changed, shape), /source-bound/);
  }
});

test('each archived-camera mosaic frame verifies its original source closure before decoding', async () => {
  const sourceDirectory = resolve('src/planets/steins/source');
  const config = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json')));
  const source = await createSourceManifest({ planetId: 'steins', planetName: 'Steins', sourceRoot: sourceDirectory });
  const drift = new Error('Original camera kernel bytes changed');
  let checked = false;
  await assert.rejects(loadGeoObservationSurface({ sourceDirectory, config,
    recipe: config.raster.surfaceObservations[0], radial: {},
    source: { ...source, validatePath: async () => { checked = true; throw drift; } } }), error => error === drift);
  assert.equal(checked, true);
});

test('level matching rejects disconnected overlaps and excessive brightness gains', () => {
  assert.throws(() => fitObservationLevels([Array(100).fill(sample(1)), Array(100).fill({ reason: 'missing' })], policy), /connect/);
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
  const config = JSON.parse(await readFile(new URL('../../../src/planets/comet-67p/source/preparation/terrestrial.json', import.meta.url)));
  const recipe = config.raster.surfaceObservations[0], shape = config.geometry.radialTerrain;
  validateGeoSurfaceRecipe(recipe, shape);
  for (const alter of [r => r.frames[1].id = r.frames[0].id, r => r.frames[1].qualityPath = r.frames[0].qualityPath,
    r => r.frames[0].filter = 'unbound', r => r.frames[0].path = '../outside.IMG', r => r.selection = 'brightest',
    r => r.levelMatching.maximumGain = 3, r => r.frames = [], r => r.path = r.frames[0].path]) {
    const changed = structuredClone(recipe); alter(changed); assert.throws(() => validateGeoSurfaceRecipe(changed, shape), /source-bound/);
  }
});
