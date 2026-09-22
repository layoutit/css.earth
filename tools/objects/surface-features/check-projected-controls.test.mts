import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProjectedControls, inspectProjectedControls, checkProjectedControlRecipe } from './check-projected-controls.mts';

const control = (id: string, lon: number, lat: number, x = 50, y = 50) => ({ id, longitudeDegrees: lon, latitudeDegrees: lat, observedPixel: [x, y], regionPixels: [45, 45, 55, 55], identification: 'Analytic test fixture, not a scientific control.' });
const unit = (v: number[]) => v.map(x => x / Math.hypot(...v));
const shape = { intersect(origin: readonly number[], direction: readonly number[]) {
  const b = origin.reduce((s, x, i) => s + x * direction[i], 0), c = origin.reduce((s, x) => s + x * x, 0) - 1, d = b * b - c;
  if (d < 0) return null;
  const first = -b - Math.sqrt(d), last = -b + Math.sqrt(d), radius = first > 0 ? first : last;
  return radius > 0 ? { radius, faceId: 0 } : null;
} };
const camera = { positionMeters: [10, 0, 0], project(p: number[]) { return [50 + 10 * p[1] / (10 - p[0]), 50 - 10 * p[2] / (10 - p[0])]; }, ray(x: number, y: number) { return unit([-1, (x - 50) / 10, -(y - 50) / 10]); } };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('checks east-positive longitude, north latitude and source surface visibility', () => {
  const controls = parseProjectedControls([control('front', 0, 0), control('east', 45, 0), control('north', 0, 45), control('back', 180, 0)], 100, 100);
  const rows = inspectProjectedControls(controls, shape, camera, 100, 100), shift = 10 * Math.SQRT1_2 / (10 - Math.SQRT1_2);
  close(rows[0].residualPixels, 0); close(rows[1].projectedPixel[0], 50 + shift); close(rows[2].projectedPixel[1], 50 - shift);
  assert.deepEqual(rows.map(r => r.visible), [true, true, true, false]);
  assert.ok(rows.every(r => r.insideImage));
});

test('measures a wrong identification without fitting it or calling the region an acceptance limit', () => {
  const controls = parseProjectedControls([{ ...control('displaced', 0, 0, 60, 70), regionPixels: [57, 67, 63, 73] }], 100, 100);
  const before = structuredClone(controls), r = inspectProjectedControls(controls, shape, camera, 100, 100)[0];
  close(r.residualPixels, Math.hypot(10, 20)); close(r.distanceFromIdentificationRegionPixels, Math.hypot(7, 17));
  assert.deepEqual(r.projectedPixel, [50, 50]); assert.deepEqual(controls, before);
  assert.equal('qualified' in r, false);
});

test('rejects malformed source coordinates, duplicate identities and off-image regions', () => {
  assert.throws(() => parseProjectedControls([control('a', 0, 91)], 100, 100), /coordinates/);
  assert.throws(() => parseProjectedControls([control('a', -1, 0)], 100, 100), /coordinates/);
  assert.throws(() => parseProjectedControls([control('a', 0, 0), control('a', 1, 0)], 100, 100), /Duplicate/);
  assert.throws(() => parseProjectedControls([control('a', 0, 0, NaN)], 100, 100), /finite/);
  assert.throws(() => parseProjectedControls([control('a', 0, 0)], 50, 50), /native identification region/);
  assert.throws(() => parseProjectedControls([], 100, 100), /No projected/);
});

test('rejects missing surface intersections and negative camera depth', () => {
  const controls = parseProjectedControls([control('a', 0, 0)], 100, 100);
  assert.throws(() => inspectProjectedControls(controls, { intersect() { return null; } }, camera, 100, 100), /No source surface/);
  assert.throws(() => inspectProjectedControls(controls, shape, { ...camera, project() { return [50, 50, -1]; } }, 100, 100), /Invalid projection/);
});

test('checks input bytes before decoding the native image', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projected-control-test-'));
  try {
    const recipe = { schema: 'cssearth-projected-controls@1', coordinateConvention: 'planetocentric-east-positive-z-north', purpose: 'diagnostic-only', source: 'test source', limitations: 'test only', controls: [control('a', 0, 0)], image: { file: 'native.fits', format: 'fits-primary', pixelConvention: 'zero-based-x-right-y-down-reversed-fits-rows', width: 100, height: 100, bytes: 3, sha256: '0'.repeat(64) } };
    await writeFile(join(directory, 'native.fits'), 'abc'); await writeFile(join(directory, 'recipe.json'), JSON.stringify(recipe));
    await assert.rejects(checkProjectedControlRecipe(join(directory, 'recipe.json'), directory, join(directory, 'result')));
    recipe.image.file = '../native.fits'; await writeFile(join(directory, 'recipe.json'), JSON.stringify(recipe));
    await assert.rejects(checkProjectedControlRecipe(join(directory, 'recipe.json'), directory, join(directory, 'result')), /filename in the input directory/);
  } finally { await rm(directory, { recursive: true }); }
});
