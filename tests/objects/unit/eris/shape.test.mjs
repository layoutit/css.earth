import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
const root = new URL('../../../../src/planets/eris/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Eris prepares the occultation sphere inside the actual quad budget without a ring', async () => {
  const descriptor = parseAuthoredObjectDescriptor(await json('object.json'));
  assert.deepEqual(descriptor.recipe.shape, { kind: 'sphere', radiusKm: 1163 });
  const scene = await json('prepared/scene.json');
  assert.equal(scene.bodyLeaves.length, 1924);
  assert.equal(scene.ringLeaves.length, 0);
  assert.equal(scene.counts.totalQuads, 1925);
  assert.ok(scene.counts.totalQuads <= 2000);
  assert.deepEqual(scene.model.semiAxesKm, [1163, 1163, 1163]);
});

test('the illustration mounts without invented observations or extra shadow/ring assets', async () => {
  const runtime = await json('prepared/runtime.json');
  assert.equal(runtime.controls.lenses, null);
  assert.deepEqual(runtime.controls.settings.controls, []);
  assert.deepEqual(runtime.variants.map(v => v.when), [{}]);
  assert.ok(runtime.assets.entries.some(a => a.key === 'surface'));
  assert.ok(runtime.assets.entries.every(a => a.key !== 'ring' && !a.key.includes('lit-')));
  assert.deepEqual(runtime.animations, []);
});

test('flood lighting is required, mounted, and fitted to the projected surface', async () => {
  const runtime = await json('prepared/runtime.json');
  const binding = runtime.viewBindings.find(value => value.kind === 'silhouette-fit');
  assert.ok(binding);
  assert.equal(binding.unitScale, 2 / runtime.camera.logicalBodyDiameter);
  const root = runtime.tree.nodes[binding.target];
  assert.equal(root.parent, -1);
  assert.ok(root.className.includes('shape-model-material-root'));
  const write = runtime.variants[0].writes.find(value => value.resource === 'lighting');
  assert.ok(write);
  assert.equal(runtime.tree.nodes[write.target].parent, binding.target);
  assert.ok(runtime.variants[0].required.includes('lighting'));
  assert.ok(runtime.assets.startup.includes('lighting'));
});
