import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeDefinition as runtime } from './prepared-fixture.mjs';

test('the cloud dataset keeps its clear base, with cloud assets acquired only when selected', () => {
  const clear = runtime.variants.find(v => v.when.lensId === 'normal');
  const clouds = runtime.variants.find(v => v.when.lensId === 'clouds');
  const cloudKeys = runtime.assets.entries.filter(e => e.pool === 'surface-blend').map(e => e.key);
  assert.ok(cloudKeys.length > 0);
  assert.ok(cloudKeys.every(key => clouds.required.includes(key) && !clear.required.includes(key) && !runtime.assets.startup.includes(key)));
  assert.ok(clear.required.every(key => clouds.required.includes(key)));
  const pool = runtime.assets.pools.find(pool => pool.id === 'surface-blend');
  assert.equal(pool.retention, 'mount'); // CSS can finish a fade after the clear selection commits.
  assert.equal(pool.capacity, cloudKeys.length);
});

test('only the prepared surface leaves fade, while other datasets disable the transition', () => {
  const carriers = runtime.tree.nodes.flatMap((node, i) => node.className?.includes('polycss-dataset-overlay') ? [i] : []);
  const leaves = runtime.tree.nodes.filter(node => carriers.includes(node.parent));
  assert.ok(leaves.length > 0);
  assert.ok(leaves.every(leaf => leaf.properties.some(id => runtime.tree.properties[id].name === 'opacity')));
  for (const variant of runtime.variants) {
    const pair = ['normal', 'clouds'].includes(variant.when.lensId);
    const write = variant.writes.find(write => write.name === '--surface-blend-duration');
    assert.equal(write.value === '0ms', !pair);
  }
});
