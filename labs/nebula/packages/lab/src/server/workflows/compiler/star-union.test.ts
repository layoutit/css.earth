import test from 'node:test';
import assert from 'node:assert/strict';
import { compilerUnionStars } from '@cssearth/nebula-reconstruction/stars/union';
import { compilerStars } from '@cssearth/nebula-reconstruction/stars/compiler';
import { readCompilerRecipe, readCompilerStarCatalogue } from '../../../features/compiler/model.ts';
import type { CompilerImage } from './images.ts';
import type { EmissionFieldModel } from '@cssearth/bake/volume';

function image(id: string, points: { x: number; y: number; peak: number }[], gain = 1, rotated = false): CompilerImage {
  const width = 64, data = new Uint8Array(width * width * 3);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const value = points.reduce((sum, point) => sum + Math.round(point.peak * Math.exp(-((x - point.x) ** 2 + (y - point.y) ** 2) / 4)), 0);
    for (let c = 0; c < 3; c++) data[(y * width + x) * 3 + c] = value * gain;
  }
  const layer = { width, height: width, data, path: 'fixture', sha256: 'fixture' };
  const pixelToSky = (x: number, y: number): [number, number] => rotated ? [64 - y, -x] : [x, -y];
  const sample = (x: number, y: number, out: [number, number, number]) => {
    const px = Math.floor(rotated ? -y : x), py = Math.floor(rotated ? 64 - x : -y);
    if (px < 0 || py < 0 || px >= width || py >= width) return false;
    for (let c = 0; c < 3; c++) out[c] = data[(py * width + px) * 3 + c]!; return true;
  };
  return { id, label: id, credit: 'fixture', page: 'fixture', matrix: [1, 0, 0, 1, 0, 0], nativeWidth: width, nativeHeight: width,
    original: layer, diffuse: layer, stars: layer, pixelToSky, sampleOriginal: sample, sampleRgb: sample };
}
const model: EmissionFieldModel = { schema: 'cssearth-conditional-emission-field@1', identity: 'fixture', controls: { detail: 1, faint: 1, depth: 1 },
  bounds: { min: [0, -64, -100], max: [64, 0, 100] }, skyBounds: { min: [0, -64], max: [64, 0] }, scaffold: null,
  components: [{ id: 'cloud', basisId: 'cloud', center: [32, -32, 0], sigma: [40, 40, 20], angleRadians: 0,
    projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false }],
  assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 100,
    equalNearFarSplit: true, velocityUncoveredComponents: 1 } };
const configuration = { sourceIds: ['optical', 'infrared'], mergeRadiusArcsec: 3 };
const optical = () => image('optical', [{ x: 16, y: 16, peak: 160 }, { x: 16, y: 48, peak: 80 }]);
const infrared = (gain = 1) => image('infrared', [{ x: 16, y: 47, peak: 20 }, { x: 48, y: 15, peak: 40 }], gain, true);

test('registered union adds a real infrared-only star, retains the optical anchor and deduplicates the shared source', async () => {
  const reference = optical(), ir = infrared(), baseline = await compilerStars(reference, model, 2, [reference, ir]);
  assert.equal(baseline.length, 2); assert.ok(baseline.every(star => star.positionArcsec[0] < 20));
  const all = await compilerUnionStars(reference, model, 3, [reference, ir], configuration);
  assert.equal(all.selection.detectionCounts.optical, 2); assert.equal(all.selection.detectionCounts.infrared, 2);
  assert.equal(all.selection.mergedCandidates, 3); assert.equal(all.stars.length, 3);
  const shared = all.stars.find(star => star.id === 'optical-0')!, observed = baseline.find(star => star.id === shared.id)!;
  assert.deepEqual(shared.positionArcsec, observed.positionArcsec, 'Cross-lens matching must retain measured anchor XY and conditional depth.');
  assert.deepEqual(all.selection.selected.find(star => star.id === shared.id)!.detectedIn, ['optical', 'infrared']);
  const selected = await compilerUnionStars(reference, model, 2, [reference, ir], configuration);
  assert.equal(selected.stars.length, 2);
  const irOnly = selected.stars.find(star => star.id.startsWith('infrared-')); assert.ok(irOnly, 'The unchanged two-light budget must include the bright infrared-only observation.');
  assert.deepEqual(irOnly.positionArcsec.slice(0, 2), [48.5, -48.5]);
  assert.equal(irOnly.materials!.optical!.alpha, 0, 'No optical residual means no invented optical light.');
  assert.ok(irOnly.materials!.infrared!.alpha > 0);
  assert.deepEqual(irOnly, all.stars.find(star => star.id === irOnly.id), 'Budgeting cannot move, resize or recolor the observation.');
});

test('source exposure normalization changes selection scores only and preserves actual per-lens measured light', async () => {
  const reference = optical(), low = infrared(), high = infrared(2);
  const a = await compilerUnionStars(reference, model, 2, [reference, low], configuration);
  const b = await compilerUnionStars(reference, model, 2, [reference, high], configuration);
  assert.ok(a.stars.some(star => star.id.startsWith('infrared-')), 'The weaker display exposure must not exclude the infrared-only source.');
  assert.deepEqual(a.stars.map(star => [star.id, star.positionArcsec]), b.stars.map(star => [star.id, star.positionArcsec]));
  assert.deepEqual(a.selection.selected.map(star => star.selectionScore), b.selection.selected.map(star => star.selectionScore));
  for (let index = 0; index < a.stars.length; index++) {
    const first = a.stars[index]!, second = b.stars[index]!;
    assert.deepEqual(second.materials!.optical, first.materials!.optical);
    assert.equal(second.materials!.infrared!.alpha, first.materials!.infrared!.alpha * 2);
    assert.ok(Math.abs(second.materials!.infrared!.diameterUnits - first.materials!.infrared!.diameterUnits) < 1e-10);
  }
});

test('union configuration rejects missing sources, invalid tolerances and unsupported route instead of silently falling back', async () => {
  for (const bad of [null, { sourceIds: ['optical'], mergeRadiusArcsec: 3 }, { sourceIds: ['optical', 'optical'], mergeRadiusArcsec: 3 },
    { ...configuration, mergeRadiusArcsec: 0 }, { ...configuration, mergeRadiusArcsec: NaN }])
    assert.throws(() => readCompilerStarCatalogue(bad), /star catalogue/);
  await assert.rejects(() => compilerUnionStars(optical(), model, 2, [optical()], configuration), /unavailable/);
  const recipe = { schema: 'cssearth-nebula-compiler@1', id: 'fixture', label: 'fixture', observationRecipe: 'labs/nebula/models/fixture/observations.json',
    observationCatalogue: '.local/nebula-lab/fixture/observations.json', structureRecipe: 'labs/nebula/models/fixture/structures.json',
    structureCatalogue: '.local/nebula-lab/fixture/structures.json', defaultSourceId: 'optical', maximumStars: 2, interpretation: 'fixture', starCatalogue: configuration };
  assert.deepEqual(readCompilerRecipe(recipe).starCatalogue, configuration);
  assert.throws(() => readCompilerRecipe({ ...recipe, defaultSourceId: 'infrared' }), /reference source/);
  assert.throws(() => readCompilerRecipe({ ...recipe, sampledRecipe: 'labs/nebula/models/fixture/sampled.json' }), /emission-field route/);
});
