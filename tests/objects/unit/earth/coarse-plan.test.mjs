import test from 'node:test';
import assert from 'node:assert/strict';
import { PREPARED_EARTH_SCENE as scene } from './prepared-fixture.mjs';
import { prepareCoarsePageGeometry, coarsePageFootprint } from '../../../../tools/objects/geographic-pages/operations/coarse-page.mjs';
import { coarseSourceAvailability, coarseSourceTileKeys, coarseSourceAddress, planGlobalCoarse } from '../../../../tools/objects/geographic-pages/operations/coarse-plan.mjs';

const entry = tile => ({ tile, etag: 'a'.repeat(32), sourceBytes: 1 });

test('catalog absence can prune a region, while a small available source island cannot', () => {
  const page = { sourceBounds: { west: 111.1, east: 113.9, south: 32.1, north: 35.9 } };
  assert.equal(coarseSourceAvailability(page, new Map()).empty, 'outside-pinned-source-inventory');
  const catalog = new Map([['N33E112', entry('N33E112')]]);
  assert.deepEqual(coarseSourceAvailability(page, catalog), { bounds: page.sourceBounds, catalogTiles: ['N33E112'] });
  assert.equal(coarseSourceAvailability({ sourceBounds: { west: 0, east: 1, south: 86, north: 89 } }, catalog).empty, 'outside-provider-projection');
});

test('prepared cap exterior is conclusive but an intersecting edge retains sampling support', () => {
  for (const y of [0, 15 * 64]) {
    const exterior = prepareCoarsePageGeometry({ level: 6, x: 0, y }, scene);
    assert.equal(coarseSourceAvailability(exterior, new Map()).empty, 'outside-prepared-cap');
  }
  const cap = prepareCoarsePageGeometry({ level: 0, x: 0, y: 15 }, scene);
  const available = coarseSourceAvailability(cap, new Map([['N79E020', entry('N79E020')]]));
  assert.equal(available.empty, undefined);
});

test('conservative planned source addresses contain every sampled texel across regular, dateline and cap pages', () => {
  for (const [address, zoom] of [
    [{ level: 2, x: 36, y: 40 }, 7], [{ level: 0, x: 16, y: 6 }, 5],
    [{ level: 0, x: 0, y: 15 }, 2], [{ level: 6, x: 6, y: 1000 }, 8],
  ]) {
    const page = prepareCoarsePageGeometry(address, scene), planned = new Set(coarseSourceTileKeys(page, zoom));
    const n = 2 ** zoom;
    let samples = 0;
    for (let y = 0; y < page.height; y++) for (let x = 0; x < page.width; x++) {
      const b = coarsePageFootprint(page, zoom, x, y);
      if (!b) continue;
      for (let row = Math.floor(b.y0 / 256); row < Math.ceil(b.y1 / 256); row++) {
        for (let col = Math.floor(b.x0 / 256); col < Math.ceil(b.x1 / 256); col++) {
          assert.ok(planned.has(`${zoom}-${((col % n) + n) % n}-${row}`), `${page.key}: unplanned source ${col},${row}`);
          samples++;
        }
      }
    }
    assert.ok(samples > 0);
    assert.ok(planned.size <= 192);
  }
});

test('global planning covers all roots and resumes with complete four-child branches', async () => {
  const catalog = new Map([['N33E112', entry('N33E112')]]), checkpoints = [];
  const args = { scene, catalog, regularLevel: 1, polarLevel: 0 };
  const plan = await planGlobalCoarse({ ...args, onProgress: async p => checkpoints.push(p.pages.slice()) });
  assert.equal(plan.rootCount, 450);
  assert.equal(plan.pages.filter(p => p.level === 0).length, 450);
  const keys = new Set(plan.pages.map(p => p.key));
  assert.equal(keys.size, plan.pages.length);
  assert.ok(plan.pages.length > 450);
  for (const page of plan.pages) {
    assert.ok(page.children.length === 0 || page.children.length === 4);
    assert.ok(page.children.every(key => keys.has(key)));
    if (page.stop) assert.equal(page.children.length, 0);
  }
  assert.deepEqual(await planGlobalCoarse({ ...args, cached: checkpoints.at(-1) }), plan);
});

test('planned addresses retain the provider matrix convention and reject out-of-range coordinates', () => {
  const template = 'https://example.invalid/wmts/{z}/{x}/{y}.png';
  assert.equal(coarseSourceAddress('2-3-1', template).url, 'https://example.invalid/wmts/02/3/1.png');
  for (const key of ['20-0-0', '2-4-1', '2-1-4', '2--1-1', '2-1-1.5']) {
    assert.throws(() => coarseSourceAddress(key, template));
  }
});
