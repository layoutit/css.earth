import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createPreparedImageStore, type PreparedImage } from './prepared-image-store.js';

class NetworkImage implements PreparedImage {
  src = '';
  decoding: PreparedImage['decoding'] = 'async';
  naturalWidth = 1;
  naturalHeight = 1;
  decodeCalls = 0;
  completeDecode!: () => void;
  listeners = { load: new Set<() => void>(), error: new Set<() => void>() };
  addEventListener(type: 'load' | 'error', listener: () => void) { this.listeners[type].add(listener); }
  removeEventListener(type: 'load' | 'error', listener: () => void) { this.listeners[type].delete(listener); }
  emit(type: 'load' | 'error') { for (const listener of [...this.listeners[type]]) listener(); }
  decode() { this.decodeCalls++; return new Promise<void>(resolve => { this.completeDecode = resolve; }); }
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness() {
  const images: NetworkImage[] = [];
  const store = createPreparedImageStore({ createImage: () => { const image = new NetworkImage(); images.push(image); return image; },
    pools: [{ id: 'pages', capacity: 20, concurrency: 2, reuse: true }] });
  return { images, store, lease: store.createLease() };
}

test('downloads overlap while explicit decoding and pending work remain bounded', async () => {
  const { images, store, lease } = harness();
  const requests = Array.from({ length: 9 }, (_, i) => lease.load(`/${i}.webp`, { pool: 'pages' }));
  assert.equal(images.length, 6);
  assert.equal(images.reduce((sum, image) => sum + image.decodeCalls, 0), 0);
  // A slow first request cannot hold a decode slot away from later downloads.
  images[1].emit('load'); images[2].emit('load'); images[3].emit('load');
  assert.equal(images[0].decodeCalls, 0);
  assert.equal(images[1].decodeCalls, 1); assert.equal(images[2].decodeCalls, 1);
  assert.equal(images[3].decodeCalls, 0);
  images[1].completeDecode(); await flush();
  assert.equal(images.length, 7);
  assert.equal(images[3].decodeCalls, 1);
  assert.partialDeepStrictEqual(store.ownershipStats().pools[0], { active: 2, pending: 6 });
  store.destroy();
  assert.equal((await Promise.all(requests)).filter(Boolean).length, 1);
  assert.equal(images.every(image => image.src === ''), true);
});

test('shared download ownership and cancellation do not resurrect reused slots', async () => {
  const { images, store, lease } = harness(); const other = store.createLease();
  const first = lease.load('/shared.webp', { pool: 'pages' });
  const second = other.load('/shared.webp', { pool: 'pages' });
  assert.equal(images.length, 1);
  lease.release('/shared.webp'); assert.equal((await first), null);
  const staleLoad = [...images[0].listeners.load][0];
  other.destroy(); assert.equal((await second), null);
  assert.equal(images[0].listeners.load.size, 0); assert.equal(images[0].src, '');
  const replacement = lease.load('/new.webp', { pool: 'pages' });
  staleLoad(); assert.equal(images[0].decodeCalls, 0);
  images[0].emit('load'); images[0].completeDecode();
  assert.equal((await replacement), images[0]); assert.equal(images[0].src, '/new.webp');
  store.destroy();
});

test('a network failure releases its pending slot and rejects every owner', async () => {
  const { images, store, lease } = harness(); const other = store.createLease();
  const first = lease.load('/bad.webp', { pool: 'pages' });
  const second = other.load('/bad.webp', { pool: 'pages' });
  images[0].emit('error');
  await assert.rejects(first, /did not load/); await assert.rejects(second, /did not load/);
  assert.partialDeepStrictEqual(store.ownershipStats().pools[0], { active: 0, pending: 0, occupied: 0 });
  assert.equal(images[0].listeners.error.size, 0);
  store.destroy();
});

test('budgeted pools overlap admitted downloads without raising explicit decode concurrency', () => {
  const images: NetworkImage[] = [];
  const store = createPreparedImageStore({ createImage: () => { const image = new NetworkImage(); images.push(image); return image; },
    pools: [{ id: 'large', capacity: 20, concurrency: 2, reuse: true, maximumDecodedBytes: 1024 }] });
  const lease = store.createLease();
  for (let i = 0; i < 9; i++) void lease.load(`/${i}.webp`, { pool: 'large' });
  assert.equal(images.length, 6);
  for (const image of images) image.emit('load');
  assert.partialDeepStrictEqual(store.ownershipStats().pools[0], { pending: 6, active: 2 });
  store.destroy();
});
