import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const root = new URL('../../../../src/planets/makemake/', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Makemake uses the documented spherical approximation within the actual quad budget', async () => {
  const scene = await json('prepared/scene.json');
  assert.deepEqual(scene.model.semiAxesKm, [715, 715, 715]);
  assert.equal(scene.bodyLeaves.length, 452);
  assert.equal(scene.counts.totalQuads, 453);
  assert.ok(scene.counts.totalQuads <= 2000);
  assert.deepEqual(scene.ringLeaves, []);
});

test('Makemake mounts only its illustrative surface with its model dataset and no unsupported ring or shadow assets', async () => {
  const runtime = await json('prepared/runtime.json');
  assert.equal(runtime.controls.lenses.defaultLens, 'illustration');
  assert.deepEqual(runtime.controls.lenses.controls.map(lens => lens.label), ['Illustrative model']);
  const lens = (await json('prepared/lenses.json')).controls[0];
  assert.ok(lens.surfaceUrl && lens.polesUrl);
  assert.equal(lens.surfaceUrl, lens.surface2xUrl);
  assert.equal(lens.polesUrl, lens.poles2xUrl);
  const { images } = await json('prepared/minimaps.json');
  assert.equal(images.length, 1);
  assert.equal(images[0].id, lens.id);
  assert.deepEqual([images[0].width, images[0].height], [640, 320]);
  assert.equal(images[0].attribution.url, lens.source.url);
  assert.ok((await readFile(new URL('prepared/' + images[0].path, root))).length < 100_000);
  assert.deepEqual(runtime.controls.settings.controls, []);
  assert.deepEqual(runtime.variants.map(variant => variant.when), [{ lensId: 'illustration' }]);
  assert.deepEqual(runtime.variants[0].required, ['surface', 'poles', 'lighting']);
  assert.ok(runtime.assets.entries.every(asset => !asset.key.includes('ring') && !asset.key.includes('lit-')));
  assert.ok(runtime.tree.nodes.every(node => !node.className?.includes('shape-model-ring')));
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
