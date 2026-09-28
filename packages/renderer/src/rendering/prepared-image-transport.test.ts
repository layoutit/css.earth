import { expect, test } from 'vitest';
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
  expect(images).toHaveLength(6);
  expect(images.reduce((sum, image) => sum + image.decodeCalls, 0)).toBe(0);
  // A slow first request cannot hold a decode slot away from later downloads.
  images[1].emit('load'); images[2].emit('load'); images[3].emit('load');
  expect(images[0].decodeCalls).toBe(0);
  expect(images[1].decodeCalls).toBe(1); expect(images[2].decodeCalls).toBe(1);
  expect(images[3].decodeCalls).toBe(0);
  images[1].completeDecode(); await flush();
  expect(images).toHaveLength(7);
  expect(images[3].decodeCalls).toBe(1);
  expect(store.ownershipStats().pools[0]).toMatchObject({ active: 2, pending: 6 });
  store.destroy();
  expect((await Promise.all(requests)).filter(Boolean)).toHaveLength(1);
  expect(images.every(image => image.src === '')).toBe(true);
});

test('shared download ownership and cancellation do not resurrect reused slots', async () => {
  const { images, store, lease } = harness(); const other = store.createLease();
  const first = lease.load('/shared.webp', { pool: 'pages' });
  const second = other.load('/shared.webp', { pool: 'pages' });
  expect(images).toHaveLength(1);
  lease.release('/shared.webp'); expect(await first).toBeNull();
  const staleLoad = [...images[0].listeners.load][0];
  other.destroy(); expect(await second).toBeNull();
  expect(images[0].listeners.load.size).toBe(0); expect(images[0].src).toBe('');
  const replacement = lease.load('/new.webp', { pool: 'pages' });
  staleLoad(); expect(images[0].decodeCalls).toBe(0);
  images[0].emit('load'); images[0].completeDecode();
  expect(await replacement).toBe(images[0]); expect(images[0].src).toBe('/new.webp');
  store.destroy();
});

test('a network failure releases its pending slot and rejects every owner', async () => {
  const { images, store, lease } = harness(); const other = store.createLease();
  const first = lease.load('/bad.webp', { pool: 'pages' });
  const second = other.load('/bad.webp', { pool: 'pages' });
  images[0].emit('error');
  await expect(first).rejects.toThrow('did not load'); await expect(second).rejects.toThrow('did not load');
  expect(store.ownershipStats().pools[0]).toMatchObject({ active: 0, pending: 0, occupied: 0 });
  expect(images[0].listeners.error.size).toBe(0);
  store.destroy();
});

test('budgeted pools overlap admitted downloads without raising explicit decode concurrency', () => {
  const images: NetworkImage[] = [];
  const store = createPreparedImageStore({ createImage: () => { const image = new NetworkImage(); images.push(image); return image; },
    pools: [{ id: 'large', capacity: 20, concurrency: 2, reuse: true, maximumDecodedBytes: 1024 }] });
  const lease = store.createLease();
  for (let i = 0; i < 9; i++) void lease.load(`/${i}.webp`, { pool: 'large' });
  expect(images).toHaveLength(6);
  for (const image of images) image.emit('load');
  expect(store.ownershipStats().pools[0]).toMatchObject({ pending: 6, active: 2 });
  store.destroy();
});
