import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import { KEPT_POOL_BYTES, withKeptPoolBudgets } from './prepared-pool-budgets.ts';

// A body whose default dataset is mounted and whose other datasets share a pool marked to keep its images. A lit
// selection needs two images from it (the shadow atlas and the pole atlas), an unlit one a single image.
const image = (key: string, url: string, pool: string, width = 1000, height = 500) => ({ key, url, pool, width, height });
const body = (width = 1000, height = 500) => ({
  id: 'rock',
  assets: {
    entries: [image('surface:a', '/a.webp', 'mounted'), image('surface:b', '/b.webp', 'datasets', width, height), image('poles:b', '/b.webp', 'datasets', width, height),
      image('shadow:b', '/b-shadow.webp', 'datasets', width, height), image('surface:b:alpha', '/b-alpha.webp', 'datasets', width, height), image('lighting:0', '/rows.webp', 'lighting')],
    pools: [{ id: 'mounted', capacity: 1, concurrency: 1, retention: 'mount', reuse: false },
      { id: 'datasets', capacity: 4, concurrency: 2, retention: 'selection', reuse: false, eviction: 'capacity' },
      { id: 'lighting', capacity: 3, concurrency: 3, retention: 'selection', reuse: true, eviction: 'capacity' }],
  },
  variants: [{ required: ['surface:a'] }, { required: ['surface:b', 'poles:b'] }, { required: ['shadow:b', 'poles:b'] }],
});

test('a pool marked to keep its images states a budget of two selections, and its entries their decoded bytes', () => {
  const stated = withKeptPoolBudgets(body());
  // The lit selection is the largest: two images of 1000 x 500, four bytes a pixel. The pool keeps two such selections.
  assert.deepEqual(stated.assets.pools[1], { id: 'datasets', capacity: 4, concurrency: 2, retention: 'selection', reuse: false, eviction: 'capacity', maximumDecodedBytes: 8_000_000 });
  assert.deepEqual(stated.assets.entries[1], { key: 'surface:b', url: '/b.webp', pool: 'datasets', decodedBytes: 2_000_000, width: 1000, height: 500 });
  assert.deepEqual(Object.keys(stated.assets.entries[1]!), ['key', 'url', 'pool', 'decodedBytes', 'width', 'height']);
  // The alpha stand-in is in the pool too, so it states its bytes; other pools' entries and the row pool are untouched.
  assert.equal((stated.assets.entries[4] as { decodedBytes?: number }).decodedBytes, 2_000_000);
  assert.equal(stated.assets.entries[0], body().assets.entries[0] && stated.assets.entries[0]);
  assert.deepEqual(stated.assets.entries[0], body().assets.entries[0]);
  assert.deepEqual(stated.assets.pools[2], body().assets.pools[2]);
  assert.equal(withKeptPoolBudgets(stated), stated, 'a stated budget is left as it is');
});

test('a pool whose two selections exceed the ceiling keeps nothing: its mark is taken off', () => {
  // 6,000 x 6,000 is 144 MB decoded; two images a selection, two selections: 576 MB.
  const large = withKeptPoolBudgets(body(6000, 6000));
  assert.ok(2 * 2 * 6000 * 6000 * 4 > KEPT_POOL_BYTES);
  assert.deepEqual(large.assets.pools[1], { id: 'datasets', capacity: 4, concurrency: 2, retention: 'selection', reuse: false });
  assert.deepEqual(large.assets.entries, body(6000, 6000).assets.entries);
  assert.equal(withKeptPoolBudgets(large), large);
});

test('a marked pool with an unsized image or with no required image is refused by object, pool and image', () => {
  const unsized = body();
  unsized.assets.entries[3] = { key: 'shadow:b', url: '/b-shadow.webp', pool: 'datasets' } as never;
  assert.throws(() => withKeptPoolBudgets(unsized), /rock: image shadow:b \(\/b-shadow\.webp\) in pool datasets states no size, so the pool's byte budget cannot be stated/u);
  const unused = { ...body(), variants: [{ required: ['surface:a'] }] };
  assert.throws(() => withKeptPoolBudgets(unused), /rock: pool datasets keeps images until it is full, but no selection requires one of its images/u);
});
