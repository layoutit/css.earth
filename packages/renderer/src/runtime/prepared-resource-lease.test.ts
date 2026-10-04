import { type PreparedAssets } from '@cssearth/objects';

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { prepareObjectResources } from './prepared-resource-lease.js';
import { createPreparedResidency } from '../rendering/prepared-residency.js';

import { waitFor } from '@cssearth/objects/node/contract';

const assets: PreparedAssets = { entries: [], pools: [], startup: [] };
test('preflight owns a bank until exactly one matching scene claims it', async () => {
  const controller = new AbortController();
  const native = createPreparedResidency({ assets });
  const destroy = mock.fn(() => native.destroy());
  const residency = { ...native, destroy };
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await lease.ready;
  assert.throws(() => lease.claim({ ...assets }, {}), /another definition/);
  assert.equal(lease.claim(assets, {}), residency);
  assert.throws(() => lease.claim(assets, {}), /unavailable/);
  controller.abort(); lease.destroy();
  assert.equal(destroy.mock.callCount(), 0);
  residency.destroy();
  assert.equal(destroy.mock.callCount(), 1);
});
test('preflight resolves its image bank against the published asset origin', async () => {
  const assets: PreparedAssets = {
    entries: [{ key: 'surface', url: '/scenes/venus/surface.webp', pool: 'surface' }],
    pools: [{ id: 'surface', capacity: 1, concurrency: 1, reuse: false, retention: 'mount' }],
    startup: ['surface'],
  };
  const images: { src: string; decoding: 'async'; naturalWidth: number; naturalHeight: number; decode(): Promise<void> }[] = [];
  const lease = prepareObjectResources(assets, {
    assetOrigin: { origin: 'https://earth-assets.example', assets: { 'surface.webp': 'a'.repeat(64) } },
    createResources: options => createPreparedResidency({ ...options,
      createImage: () => { const image = { src: '', decoding: 'async' as const, naturalWidth: 8, naturalHeight: 8, decode: async () => {} }; images.push(image); return image; },
    }),
  });
  await lease.ready;
  assert.equal(images[0]?.src, `https://earth-assets.example/runtime-assets/${'a'.repeat(64)}/surface.webp`);
  lease.destroy();
});
test('an image whose hash the page did not embed loads from the published origin after its group arrives', async () => {
  const assets: PreparedAssets = {
    entries: [{ key: 'page:normal:0:level:2048', url: '/scenes/earth/page-level-1024.webp', pool: 'pages' }],
    pools: [{ id: 'pages', capacity: 1, concurrency: 1, reuse: false, retention: 'mount' }],
    startup: ['page:normal:0:level:2048'],
  };
  const images: { src: string; decoding: 'async'; naturalWidth: number; naturalHeight: number; decode(): Promise<void> }[] = [];
  const reads: string[] = [];
  const lease = prepareObjectResources(assets, {
    assetOrigin: { origin: 'https://earth-assets.example', assets: {}, groups: '/objects/earth/asset-hashes/' },
    createResources: options => createPreparedResidency({ ...options,
      readAssetHashes: async url => { reads.push(url); return { 'page-level-1024.webp': 'c'.repeat(64) }; },
      createImage: () => { const image = { src: '', decoding: 'async' as const, naturalWidth: 8, naturalHeight: 8, decode: async () => {} }; images.push(image); return image; },
    }),
  });
  await lease.ready;
  assert.deepEqual(reads, ['/objects/earth/asset-hashes/page.normal.level.2048.json']);
  assert.equal(images[0]?.src, `https://earth-assets.example/runtime-assets/${'c'.repeat(64)}/page-level-1024.webp`);
  lease.destroy();
});
test('a prefetched hash group starts no image, and the demand that follows reads no group of its own', async () => {
  const assets: PreparedAssets = {
    entries: [{ key: 'page:normal:0:level:2048', url: '/scenes/earth/page-level-1024.webp', pool: 'pages' }],
    pools: [{ id: 'pages', capacity: 1, concurrency: 1, reuse: false, retention: 'mount' }],
    startup: [],
  };
  const images: { src: string; decoding: 'async'; naturalWidth: number; naturalHeight: number; decode(): Promise<void> }[] = [];
  const reads: string[] = [];
  const residency = createPreparedResidency({ assets,
    assetOrigin: { origin: 'https://earth-assets.example', assets: {}, groups: '/objects/earth/asset-hashes/' },
    readAssetHashes: async url => { reads.push(url); return { 'page-level-1024.webp': 'c'.repeat(64) }; },
    createImage: () => { const image = { src: '', decoding: 'async' as const, naturalWidth: 8, naturalHeight: 8, decode: async () => {} }; images.push(image); return image; },
  });
  residency.prefetchHashes(['page:normal:0:level:2048', 'undeclared']);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(reads, ['/objects/earth/asset-hashes/page.normal.level.2048.json']);
  assert.equal(images.length, 0);
  await residency.request({ required: ['page:normal:0:level:2048'] }).ready;
  assert.equal(reads.length, 1);
  assert.equal(images[0]?.src, `https://earth-assets.example/runtime-assets/${'c'.repeat(64)}/page-level-1024.webp`);
  residency.destroy();
});
test('cancelled preflight releases an unclaimed bank and cannot reach a scene', async () => {
  const controller = new AbortController(); controller.abort();
  const residency = createPreparedResidency({ assets });
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await assert.rejects(lease.ready, /cancelled/);
  assert.throws(() => lease.claim(assets, {}), /unavailable/);
  lease.destroy();
  assert.equal((await residency.prepareStartup()), null);
});
test('ready unclaimed resources are cancelled promptly without double destruction', async () => {
  const controller = new AbortController();
  const residency = createPreparedResidency({ assets });
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await lease.ready; controller.abort(); lease.destroy();
  assert.throws(() => lease.claim(assets, {}), /unavailable/);
  assert.equal((await residency.prepareStartup()), null);
});

function decodingFixture() {
  const assets: PreparedAssets = {
    entries: ['base', 'a', 'b', 'c'].map(key => ({ key, url: `/${key}.webp`, pool: key === 'base' ? 'base' : 'material' })),
    startup: ['base'], pools: [
      { id: 'base', capacity: 1, concurrency: 1, reuse: false, retention: 'mount' },
      { id: 'material', capacity: 2, concurrency: 2, reuse: true, retention: 'selection', eviction: 'unused' },
    ],
  };
  const decodes = new Map<string, { resolve(): void; reject(error: Error): void }>();
  const createResources: typeof createPreparedResidency = options => createPreparedResidency({ ...options,
    createImage: () => ({ src: '', decoding: 'async', naturalWidth: 8, naturalHeight: 8,
      decode() { return new Promise<void>((resolve, reject) => decodes.set(this.src, { resolve, reject })); } }),
  });
  const controller = new AbortController();
  const lease = prepareObjectResources(assets, { createResources, signal: controller.signal });
  return { assets, lease, controller, decodes };
}

test('startup yields its reservation; a moving view replaces stale demand before claim', async () => {
  const f = decodingFixture();
  let key = 'a';
  const prepared = f.lease.prepareDemand(() => ({ required: [key] }));
  assert.deepEqual(([...f.decodes.keys()]), ['/base.webp']);
  f.decodes.get('/base.webp')!.resolve();
  await waitFor(() => assert.equal(f.decodes.has('/a.webp'), true));
  key = 'b';
  f.decodes.get('/a.webp')!.resolve();
  await waitFor(() => assert.equal(f.decodes.has('/b.webp'), true));
  f.decodes.get('/b.webp')!.resolve();
  await prepared;
  const residency = f.lease.claim(f.assets, {});
  assert.deepEqual([...residency.resources.readyKeys()].sort(), ['b', 'base']);
  const ticket = residency.request({ required: ['b'] });
  assert.equal((await ticket.ready), ticket);
  residency.commit(ticket);
  assert.equal(f.decodes.size, 3); // The mount reuses the decoded image handle.
  residency.destroy();
});

test('view preparation cancels pending native decode and propagates required image failure', async () => {
  const cancelled = decodingFixture();
  const pending = cancelled.lease.prepareDemand(() => ({ required: ['a'] }));
  cancelled.controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.throws(() => cancelled.lease.claim(cancelled.assets, {}), /unavailable/);

  const failed = decodingFixture();
  const preparation = failed.lease.prepareDemand(() => ({ required: ['a'] }));
  failed.decodes.get('/base.webp')!.resolve();
  await waitFor(() => assert.equal(failed.decodes.has('/a.webp'), true));
  failed.decodes.get('/a.webp')!.reject(new Error('image failed'));
  await assert.rejects(preparation, /did not decode/);
  failed.lease.destroy();
});

test('one native release failure does not retain the other prepared images', async () => {
  // The startup bank decoded three images; releasing one of them throws. The
  // failure surfaces once from destroy and every other handle is still cleared.
  const images: { src: string; decoding: 'async'; naturalWidth: number; naturalHeight: number; decode(): Promise<void>; removeAttribute?(name: string): void }[] = [];
  const assets: PreparedAssets = {
    entries: ['a', 'b', 'c'].map(key => ({ key, url: `/${key}.webp`, pool: 'material' })),
    startup: ['a', 'b', 'c'], pools: [{ id: 'material', capacity: 3, concurrency: 3, reuse: true, retention: 'selection', eviction: 'unused' }],
  };
  const lease = prepareObjectResources(assets, { createResources: options => createPreparedResidency({ ...options,
    createImage: () => { const image = { src: '', decoding: 'async' as const, naturalWidth: 8, naturalHeight: 8, decode: async () => {} }; images.push(image); return image; },
  }) });
  await lease.ready;
  assert.deepEqual(images.map(image => image.src).sort(), ['/a.webp', '/b.webp', '/c.webp']);
  const failing = images.find(image => image.src === '/b.webp')!;
  failing.removeAttribute = () => { throw new Error('release failed'); };
  assert.throws(() => lease.destroy(), /cleanup failed/);
  assert.equal(images.filter(image => image !== failing).every(image => image.src === ''), true);
  assert.throws(() => lease.claim(assets, {}), /unavailable/);
});

function boundedLease(startup: string[], capacity: number) {
  const assets: PreparedAssets = { entries: ['a', 'b', 'c', 'd', 'e', 'f'].map(key => ({ key, url: `/${key}.webp`, pool: 'lighting' })),
    startup, pools: [{ id: 'lighting', capacity, concurrency: capacity, reuse: true, retention: 'selection', eviction: 'capacity' }] };
  let residency!: ReturnType<typeof createPreparedResidency>;
  const lease = prepareObjectResources(assets, { createResources: options => residency = createPreparedResidency({ ...options,
    createImage: () => ({ src: '', decoding: 'async', naturalWidth: 8, naturalHeight: 8, decode: async () => {} }),
  }) });
  return { assets, lease, residency };
}

test('a full default startup pool yields to an unpublished incoming view without increasing capacity', async () => {
  const f = boundedLease(['a', 'b', 'c'], 3);
  await f.lease.prepareDemand(() => ({ required: ['d'], prewarm: ['e', 'f'] }));
  assert.deepEqual(f.residency.stats().committed, []);
  assert.ok(f.residency.stats().pools[0].resident <= 3);
  const adopted = f.lease.claim(f.assets, {});
  assert.deepEqual(adopted.stats().committed, ['d']);
  assert.equal(adopted.resources.has('d'), true);
  adopted.destroy();
});

test('a second preflight checkpoint replaces a ready unpublished selection instead of protecting both', async () => {
  const f = boundedLease([], 2);
  await f.lease.prepareDemand(() => ({ required: ['a', 'b'] }));
  await f.lease.prepareDemand(() => ({ required: ['c', 'd'] }));
  assert.deepEqual(f.residency.stats().committed, []);
  assert.equal(f.residency.stats().pools[0].resident, 2);
  const adopted = f.lease.claim(f.assets, {});
  assert.deepEqual(adopted.stats().committed, ['c', 'd']);
  assert.equal(adopted.resources.has('c'), true); assert.equal(adopted.resources.has('d'), true);
  adopted.destroy();
});

test('first-paint decode rechecks selected handles once without refetching or publishing readiness', async () => {
  const calls: string[] = [], ready = mock.fn(() => {});
  const assets: PreparedAssets = {
    entries: [{ key: 'surface', url: '/atlas.webp', pool: 'material' }, { key: 'poles', url: '/atlas.webp', pool: 'material' }, { key: 'other', url: '/other.webp', pool: 'material' }],
    pools: [{ id: 'material', capacity: 3, concurrency: 2, retention: 'mount', reuse: false }], startup: [],
  };
  const images: { src: string; decoding: 'async'; naturalWidth: number; naturalHeight: number; decode(): Promise<void> }[] = [];
  const residency = createPreparedResidency({ assets, onReady: ready, createImage() {
    const image = { src: '', decoding: 'async' as const, naturalWidth: 1, naturalHeight: 1, async decode() { calls.push(this.src); } };
    images.push(image); return image;
  } });
  const ticket = residency.request({ required: ['surface', 'poles'], prewarm: ['other'] });
  await ticket.ready; residency.commit(ticket);
  await waitFor(() => assert.equal(residency.resources.has('other'), true));
  calls.length = 0; ready.mock.resetCalls();
  assert.equal((await residency.decodeForPaint()), true);
  assert.deepEqual(calls, ['/atlas.webp']);
  assert.equal(images.length, 2);
  assert.equal(ready.mock.callCount(), 0);
  assert.equal(residency.stats().paintDecodeChecks, 1);
  residency.destroy(); assert.equal((await residency.decodeForPaint()), false);
});

test('a demand for an image that stayed resident undrawn decodes it again before it is ready', async () => {
  const calls: string[] = [], warm = mock.fn((_error: unknown) => {});
  let fail = false;
  const assets: PreparedAssets = {
    entries: [{ key: 'a', url: '/a.webp', pool: 'pages' }, { key: 'b', url: '/b.webp', pool: 'pages' }],
    pools: [{ id: 'pages', capacity: 2, concurrency: 2, retention: 'selection', reuse: false, eviction: 'capacity' }], startup: [],
  };
  const residency = createPreparedResidency({ assets, onWarmError: warm, createImage: () => ({ src: '', decoding: 'async' as const, naturalWidth: 1, naturalHeight: 1,
    async decode() { calls.push(this.src); if (fail) throw new Error('discarded'); } }) });
  const first = residency.request({ required: ['a'] }); await first.ready; residency.commit(first);
  const second = residency.request({ required: ['b'] }); await second.ready; residency.commit(second);
  // Dataset a is no longer drawn but stays resident: WebKit may have dropped its pixels.
  assert.equal(residency.resources.has('a'), true);
  calls.length = 0;
  const back = residency.request({ required: ['a'] }); await back.ready;
  assert.deepEqual(calls, ['/a.webp']);
  residency.commit(back);
  // The image drawn now is not decoded again by a demand that keeps it.
  calls.length = 0;
  const same = residency.request({ required: ['a'] }); await same.ready; residency.commit(same);
  assert.deepEqual(calls, []);
  // A second decode that fails is reported and leaves the image to its paint: the demand is still ready.
  fail = true;
  const again = residency.request({ required: ['b'] });
  assert.equal(await again.ready, again);
  assert.equal(warm.mock.callCount(), 1);
  residency.destroy();
});

test('first-paint decode propagates failure and remains cancelled after its owner retires', async () => {
  let rejectNext: ((reason: Error) => void) | null = null;
  let delayed = false;
  const assets: PreparedAssets = { entries: [{ key: 'surface', url: '/atlas.webp', pool: 'material' }],
    pools: [{ id: 'material', capacity: 1, concurrency: 1, retention: 'mount', reuse: false }], startup: [] };
  const residency = createPreparedResidency({ assets, createImage: () => ({ src: '', decoding: 'async', naturalWidth: 1, naturalHeight: 1,
    decode: () => delayed ? new Promise<void>((_resolve, reject) => { rejectNext = reject; }) : Promise.resolve() }) });
  const ticket = residency.request({ required: ['surface'] }); await ticket.ready; residency.commit(ticket);
  delayed = true;
  const pending = residency.decodeForPaint();
  const failed = assert.rejects(pending, /discarded/);
  residency.destroy();
  if (!rejectNext) throw new Error('No pending decode');
  const reject: (reason: Error) => void = rejectNext;
  reject(new Error('discarded')); await failed;
  assert.equal((await residency.decodeForPaint()), false);
});

test('view-driven preflight skips the close-up startup bank until detail is requested', async () => {
  const assets: PreparedAssets = { entries: [{key:'surface',url:'/surface.webp',pool:'material'}],
    pools: [{id:'material',capacity:1,concurrency:1,reuse:false,retention:'selection',eviction:'unused'}], startup:['surface'] };
  const decode = mock.fn(async () => {});
  const lease = prepareObjectResources(assets, {startup:false, createResources: options => createPreparedResidency({...options,
    createImage: () => ({src:'',decoding:'async',naturalWidth:1,naturalHeight:1,decode})})});
  await lease.prepareDemand(() => ({required:[]}));
  assert.equal(decode.mock.callCount(), 0);
  await lease.prepareDemand(() => ({required:['surface']}));
  assert.equal(decode.mock.callCount(), 1);
  lease.destroy();
});
