import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeDefinition as runtime } from './prepared-fixture.mjs';

test('manual Earth datasets reuse one surface and require only their selected image bank', () => {
  const clear = runtime.variants.find(v => v.when.lensId === 'normal');
  const clouds = runtime.variants.find(v => v.when.lensId === 'clouds');
  const cloudKeys = runtime.assets.entries.filter(e => e.key.startsWith('page:clouds:')).map(e => e.key);
  assert.ok(cloudKeys.length > 0);
  assert.ok(cloudKeys.every(key => clouds.required.includes(key) && !clear.required.includes(key) && !runtime.assets.startup.includes(key)));
  assert.ok(!clouds.required.some(key => key.startsWith('page:normal:')));
  assert.equal(runtime.controls.lenses.zoomSelection, undefined);
  assert.ok(!runtime.tree.nodes.some(node => node.className?.includes('polycss-dataset-overlay')));
  const pageTargets = variant => variant.writes.filter(w => w.kind === 'texture' && w.name.startsWith('--earth-surface-page-') && w.resource).map(w => w.target);
  assert.deepEqual(pageTargets(clear), pageTargets(clouds));
});
