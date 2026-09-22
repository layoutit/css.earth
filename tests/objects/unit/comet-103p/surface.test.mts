import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('comet-103p');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPdsPlanetocentricShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { preparePdsConstraintMap } from '../../../../tools/objects/terrestrial-layers/pds-constraint-map.mts';
const root = resolve(import.meta.dirname, '../../../../src/objects/comet-103p');
const json = async (path: string) => JSON.parse((await readFile(resolve(root, path))).toString('utf8'));

test('Hartley 2 retains published geometry, source constraint flags and fixed non-spin orientation', async () => {
  const config = await json('source/preparation/terrestrial.json'), profile = config.geometry.radialTerrain;
  const source = await loadPdsPlanetocentricShape(resolve(root, 'source', profile.path), profile.grid);
  assert.deepEqual(source.coverage.vertexFlags, { 1: 7431, 2: 4745, 3: 3846 });
  const prepared = await json('prepared/terrain.json');
  const metres = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const key = (p: number[]) => p.map((x: number) => x.toFixed(4)).join(',');
  const sourceVertices = new Set(source.positions.map(key)), positions = [], lookup = new Map(), indices = [];
  for (const face of prepared.faces) for (const v of face.vertices) {
    const p = v.map((x: number) => x * metres), k = key(p);
    assert.ok(sourceVertices.has(k), 'every prepared vertex must retain a released source position');
    if (!lookup.has(k)) { lookup.set(k, positions.length); positions.push(p); }
    indices.push(lookup.get(k));
  }
  const topology = validateClosedMesh(Uint32Array.from(indices), positions);
  const original = validateClosedMesh(Uint32Array.from(source.indices.flat()), source.positions);
  assert.equal(topology.components, 1); assert.equal(topology.eulerCharacteristic, 2);
  assert.ok(Math.abs(topology.signedVolumeCubicMeters / original.signedVolumeCubicMeters - 1) < .02);
  const manifest = await json('source/manifest.json');
  for (const entry of manifest.inputs.filter((e: { consumers: string|string[]; }) => e.consumers.includes('surfaces'))) {
    assert.deepEqual(entry.recipe.gridFlags, [3], 'only the poorly constrained source category receives the grid in either lens');
    assert.deepEqual(await preparePdsConstraintMap(source, entry.recipe), await readFile(resolve(root, 'source', entry.path)));
  }
  const orientation = await json('source/preparation/rotation.json');
  assert.equal(orientation.schema, 'cssearth-display-orientation@1');
  assert.equal(orientation.periodHours, undefined);
  assert.equal((await json('source/content/object.json')).lenses.defaultLens, 'constraints');
});
