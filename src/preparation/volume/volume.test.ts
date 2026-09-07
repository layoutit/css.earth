import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseVolumeRecipe } from './config.js';
import { loadVolumeSource, sampleEncoded, decodeDensityKtx2, containedPath } from './source.js';
import { sunBarycentricAu, M_PER_AU } from '@cssearth/astronomy';
const sourceDirectory = 'src/objects/milky-way/source';
const readRecipe = async () => parseVolumeRecipe(JSON.parse(await readFile(`${sourceDirectory}/volume.json`, 'utf8')) as unknown);

test('volume origin converts the recorded barycentric placement to the shared Sun frame', async () => {
  const descriptor=JSON.parse(await readFile('src/objects/milky-way/object.json','utf8')) as {properties:{volume:{originM:number[];epochJdTt:number}}};
  const provenance=JSON.parse(await readFile(`${sourceDirectory}/provenance.json`,'utf8')) as {sources:{upstreamRecord:{extra:{centerOffsetIcrfM:number[]}}}[]};
  const recorded=provenance.sources[0]!.upstreamRecord.extra.centerOffsetIcrfM;
  const barycentric=sunBarycentricAu(descriptor.properties.volume.epochJdTt);
  const expected=recorded.map((value,axis)=>value-barycentric[axis]!*M_PER_AU);
  assert.deepEqual(descriptor.properties.volume.originM,expected);
  assert.notDeepEqual(recorded,expected,'dropping the barycentric conversion must be detectable');
});

test('pinned density source is self-contained and sampling matches real voxel centers', async () => {
  const recipe = await readRecipe(), source = await loadVolumeSource(sourceDirectory, recipe);
  const result: [number, number, number, number] = [0, 0, 0, 0];
  for (const [x, y, z] of [[0, 0, 0], [255, 200, 32], [511, 511, 63], [193, 351, 29]] as const) {
    const position = [x, y, z].map((coordinate, axis) => {
      const lo = recipe.grid.bounds.min[axis], hi = recipe.grid.bounds.max[axis], count = recipe.grid.dimensions[axis];
      assert(lo !== undefined && hi !== undefined && count !== undefined);
      return lo + (hi - lo) * (coordinate + 0.5) / count;
    });
    const [px, py, pz] = position; assert(px !== undefined && py !== undefined && pz !== undefined);
    sampleEncoded(source, px, py, pz, result);
    for (let channel = 0; channel < 4; channel++) {
      const expected = source.encodedRgba[4 * ((z * source.height + y) * source.width + x) + channel];
      assert(expected !== undefined); assert.equal(result[channel], expected / 255);
    }
  }
  sampleEncoded(source, 0, 0, recipe.grid.bounds.max[2] + 1, result);
  assert.deepEqual(result, [0, 0, 0, 0]);
});

test('source hash and compression mutations fail before a density field can be used', async () => {
  const recipe = await readRecipe();
  await assert.rejects(loadVolumeSource(sourceDirectory, { ...recipe, grid: { ...recipe.grid, sha256: '0'.repeat(64) } }), /digest mismatch/);
  const original = await readFile(`${sourceDirectory}/${recipe.grid.path}`), changed = Buffer.from(original);
  changed.writeUInt32LE(1, 44);
  assert.throws(() => decodeDensityKtx2(changed), /Zstd/);
  assert.throws(() => containedPath(sourceDirectory, '../../outside.ktx2'), /escapes/);
});

test('generic volume config validates spatial bounds and channel indices', async () => {
  const recipe = await readRecipe();
  assert.throws(() => parseVolumeRecipe({ ...recipe, grid: { ...recipe.grid, bounds: { min: [0, 0, 0], max: [0, 1, 1] } } }), /Bounds/);
  assert.throws(() => parseVolumeRecipe({ ...recipe, material: { ...recipe.material, emission: [{ channel: 4, color: [1, 1, 1], strength: 1 }] } }), /RGBA/);
});
