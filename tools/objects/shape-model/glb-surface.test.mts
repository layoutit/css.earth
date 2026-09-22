import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareGlbSurface } from './glb-surface.mts';

const model = (id: string) => new URL(`../../../src/objects/${id}/source/nasa-${id}.glb`, import.meta.url);

// Small actual-source reprojections cover the high-density Eris triangles,
// Haumea's polar UV islands, and Makemake's slightly irregular cube-mapped mesh.
for (const [id, triangles] of [['haumea', 960], ['eris', 20508], ['makemake', 3072]] as const) {
  test(`${id}: the original model covers all sampled directions`, async () => {
    const result = await prepareGlbSurface(model(id), 256, 128);
    assert.equal(result.sourceTriangles, triangles);
    assert.ok(result.sourceRadialResidual < .01);
    assert.equal(result.pixels.length, 256 * 128 * 4);
    for (let index = 3; index < result.pixels.length; index += 4) assert.ok(result.pixels[index] > 0);
  });
}

test('an incomplete source mesh fails instead of filling missing texture coverage', async () => {
  const file = await readFile(model('haumea'));
  const jsonSize = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonSize).toString());
  const primitive = gltf.meshes[0].primitives[0];
  gltf.accessors[primitive.indices].count = 3;
  const json = Buffer.from(JSON.stringify(gltf));
  assert.ok(json.length <= jsonSize);
  file.fill(32, 20, 20 + jsonSize);
  json.copy(file, 20);
  const directory = await mkdtemp(join(tmpdir(), 'eris-source-coverage-'));
  try {
    const path = join(directory, 'open.glb');
    await writeFile(path, file);
    await assert.rejects(prepareGlbSurface(path, 8, 4), /Source model UV coverage is missing/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
