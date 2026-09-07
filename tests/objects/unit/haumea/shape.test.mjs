import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
const root = new URL('../../../../src/planets/haumea/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Haumea retains its measured triaxial shape and ring within the actual leaf budget', async () => {
  const descriptor = parseAuthoredObjectDescriptor(await json('object.json'));
  assert.deepEqual(descriptor.recipe.shape, { kind: 'ellipsoid', radiusKm: 1161, secondaryRadiusKm: 852, polarRadiusKm: 513 });
  const scene = await json('prepared/scene.json');
  assert.equal(scene.bodyLeaves.length + scene.ringLeaves.length, 1572);
  const runtime = await json('prepared/runtime.json');
  assert.equal(runtime.tree.nodes.filter(node => node.tag === 's').length, 1573);
  assert.ok(runtime.tree.nodes.filter(node => node.tag === 's').length <= 2000);
  assert.deepEqual([scene.model.ring.innerRadiusKm, scene.model.ring.outerRadiusKm], [2252, 2322]);
});
test('the NASA illustration stays evenly lit without a fabricated lens or shadow control', async () => {
  const runtime = await json('prepared/runtime.json');
  assert.equal(runtime.controls.lenses, null);
  assert.deepEqual(runtime.controls.settings.controls, []);
  assert.deepEqual(runtime.variants.map(v => v.when), [{}]);
  assert.ok(runtime.assets.entries.some(a => a.key === 'surface'));
  assert.ok(runtime.assets.entries.every(a => !a.key.includes('lit-')));
  const material = runtime.materials[0];
  assert.equal(material.rotation.kind, 'ellipsoid');
  assert.equal(material.rotation.projection.bodyMeshMatrix[0], 852 / 1161);
  assert.equal(runtime.variants[0].materials[0].rotationEnabled, false);
  let parent = runtime.tree.nodes[material.target].parent;
  while (parent >= 0 && parent !== runtime.tree.scene) parent = runtime.tree.nodes[parent].parent;
  assert.equal(parent, runtime.tree.scene, 'lighting shares body/ring depth ordering');
});
