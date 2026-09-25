import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emissiveEntries } from '../../src/renderers/css/preparation/presentation/emissive.ts';

// 364 of 454 published star plates held no visible pixel, and a layer painting a transparent image still gets a backing:
// AB Pic's empty off-limb plate kept its whole stage a 7.4 MB layer on a DPR 3 iPhone. The raster lane no longer publishes
// an empty plate, and a lens without one loads and draws nothing there.
test('a star lens publishes its surface and poles, and a plate only when the raster lane published one', () => {
  const lens = (id: string, plates: { corona?: string; limb?: string }) => ({ id, name: id, surfaceUrl: `/scenes/s/s-surface-${id}@2x.webp`,
    polesUrl: `/scenes/s/s-poles-${id}@2x.webp`, materialUrl: '', ...(plates.corona ? { coronaUrl: plates.corona, corona2xUrl: plates.corona } : {}),
    ...(plates.limb ? { limbUrl: plates.limb, limb2xUrl: plates.limb } : {}) });
  const entries = emissiveEntries([lens('color', { limb: '/scenes/s/s-limb-color@2x.webp' }), lens('shape', {})] as never);
  assert.deepEqual(entries.map(entry => entry.key), ['surface:color', 'poles:color', 'limb:color', 'surface:shape', 'poles:shape']);
  assert.ok(entries.every(entry => entry.pool === 'material'));
});
