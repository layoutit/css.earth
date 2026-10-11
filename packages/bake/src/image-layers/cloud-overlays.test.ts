import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { decodePreparedBank, readCloudPoints } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareCloudOverlays, readCloudSource, readKinematicsSource, readTubeSource } from './cloud-overlays.ts';

const point = { east: 1, north: -2, depth: 3, diameter: .5, color: '#ff8800', opacity: .7 };
const ellipsoid = { centre: [0, 0, 0], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
const knot = { east: 1, north: 2, depth: 3, vEast: 100, vNorth: -50, vLos: 400 };

test('well-formed source records read whole', () => {
  assert.deepEqual(readCloudSource({ points: [point], occluder: [ellipsoid] }, 'cloud'), { points: [point], occluder: [ellipsoid] });
  assert.deepEqual(readTubeSource({ centreline: [[0, 0, 0], [0, 0, 1]], radius: [1, 2], traced: [] }, 'tube').radius, [1, 2]);
  assert.deepEqual(readKinematicsSource({ knots: [knot] }, 'motions').knots, [knot]);
});

test('a source record with a number that is not finite, a missing field or a short centreline is refused by name', () => {
  for (const [patch, message] of [[{ east: Infinity }, /cloud points\[0\]\.east is a finite number/u], [{ depth: '3' }, /cloud points\[0\]\.depth is a finite number/u],
    [{ diameter: 0 }, /cloud points\[0\]\.diameter is positive/u], [{ color: undefined }, /cloud points\[0\]\.color is a #rrggbb/u], [{ opacity: undefined }, /opacity is a finite number/u]] as const)
    assert.throws(() => readCloudSource({ points: [{ ...point, ...patch }], occluder: [] }, 'cloud'), message);
  assert.throws(() => readCloudSource({ occluder: [] }, 'cloud'), /cloud points is a list/u);
  assert.throws(() => readCloudSource({ points: [], occluder: [{ centre: [0, 0], axes: ellipsoid.axes }] }, 'cloud'), /cloud occluder\[0\]\.centre is three numbers/u);
  assert.throws(() => readCloudSource({ points: [], occluder: [{ centre: [0, 0, 0], axes: ellipsoid.axes.slice(0, 2) }] }, 'cloud'), /cloud occluder\[0\]\.axes are three/u);
  for (const axes of [[[1, 0, 0], [0, 1, 0], [0, 0, 0]], [[1, 0, 0], [0, 1, 0], [1, 1, 0]]])
    assert.throws(() => readCloudSource({ points: [], occluder: [{ centre: [0, 0, 0], axes }] }, 'cloud'), /cloud occluder\[0\]\.axes are three that span space/u, JSON.stringify(axes));
  assert.throws(() => readCloudSource([], 'cloud'), /cloud is an object/u);
  assert.throws(() => readTubeSource({ centreline: [[0, 0, 0]], radius: [1], traced: [] }, 'tube'), /tube: a centreline of two or more samples/u);
  assert.throws(() => readTubeSource({ centreline: [[0, 0, 0], [0, 0, 1]], radius: [1], traced: [] }, 'tube'), /a positive radius for each/u);
  assert.throws(() => readTubeSource({ centreline: [[0, 0, 0], [0, 0, 1]], radius: [1, 0], traced: [] }, 'tube'), /a positive radius for each/u);
  assert.throws(() => readTubeSource({ centreline: [[0, 0, 0], [0, 0, Number.NaN]], radius: [1, 1], traced: [] }, 'tube'), /tube centreline\[1\]\[2\] is a finite number/u);
  assert.throws(() => readTubeSource({ centreline: [[0, 0, 0], [0, 0, 1]], radius: [1, 1] }, 'tube'), /tube traced is a list/u);
  assert.throws(() => readKinematicsSource({ knots: [{ ...knot, vLos: undefined }] }, 'motions'), /motions knots\[0\]\.vLos is a finite number/u);
  assert.throws(() => readKinematicsSource({}, 'motions'), /motions knots is a list/u);
});

test('the bake reads its cloud record before it writes anything', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'cssearth-cloud-points-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, 'source')); await mkdir(resolve(dir, 'prepared'));
  await writeFile(resolve(dir, 'object.json'), JSON.stringify({ schema: 'cssearth-object@2', id: 'nebula', type: 'image-layer-bank', properties: {
    frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [1e19, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1e14, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    preparation: { source: 'source/recipe.json' } } }));
  await writeFile(resolve(dir, 'source/cloud-points.json'), JSON.stringify({ points: [{ ...point, north: null }], occluder: [] }));
  await assert.rejects(prepareCloudOverlays(dir), /source\/cloud-points\.json points\[0\]\.north is a finite number, not null/u);
  assert.deepEqual(await readdir(resolve(dir, 'prepared')), [], 'nothing was written');
});

/** An object directory with a cloud of two dots, its frame `metersPerUnit` per unit. */
async function objectWithCloud(t: { after(fn: () => Promise<void>): void }, metersPerUnit: number) {
  const dir = await mkdtemp(resolve(tmpdir(), 'cssearth-cloud-points-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, 'source')); await mkdir(resolve(dir, 'prepared'));
  await writeFile(resolve(dir, 'object.json'), JSON.stringify({ schema: 'cssearth-object@2', id: 'nebula', type: 'image-layer-bank', properties: {
    frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [1e19, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    preparation: { source: 'source/recipe.json' } } }));
  await writeFile(resolve(dir, 'source/cloud-points.json'), JSON.stringify({ points: [point, { ...point, east: -1 }], occluder: [ellipsoid] }));
  return dir;
}

test('the bake writes the cloud bank the page reads, and names it among the overlays', async t => {
  const dir = await objectWithCloud(t, 1e14);
  await prepareCloudOverlays(dir);
  const bank = readCloudPoints(decodePreparedBank(unpackPreparedBinary(await readFile(resolve(dir, 'prepared/cloud.bin'))), 'cloud.bin'), 'cloud.bin');
  assert.deepEqual([bank.count, bank.atlas], [2, 'cloud-atlas.webp']);
  assert.deepEqual((JSON.parse(await readFile(resolve(dir, 'object.json'), 'utf8')) as { properties: { overlays: unknown } }).properties.overlays, { optical: ['cloud'] });
});

test('a cloud bank the page would refuse is never written', async t => {
  // so many metres a unit that a billboard's width in units is below the smallest 32-bit float: the reader refuses a width of 0
  const dir = await objectWithCloud(t, 1e70);
  await assert.rejects(prepareCloudOverlays(dir), /nebula: prepared\/cloud\.bin: every billboard has a positive width/u);
  assert.equal((await readdir(resolve(dir, 'prepared'))).includes('cloud.bin'), false);
});
