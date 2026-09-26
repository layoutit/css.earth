import { expect, test, vi } from 'vitest';
import { prepareObjectResources } from './prepared-resource-lease.js';
import { createPreparedResidency, type PreparedAssets } from '../rendering/prepared-residency.js';

const assets: PreparedAssets = { entries: [], pools: [], startup: [] };
test('preflight owns a bank until exactly one matching scene claims it', async () => {
  const controller = new AbortController();
  const native = createPreparedResidency({ assets });
  const destroy = vi.fn(() => native.destroy());
  const residency = { ...native, destroy };
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await lease.ready;
  expect(() => lease.claim({ ...assets }, {})).toThrow('another definition');
  expect(lease.claim(assets, {})).toBe(residency);
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
  controller.abort(); lease.destroy();
  expect(destroy).not.toHaveBeenCalled();
  residency.destroy();
  expect(destroy).toHaveBeenCalledOnce();
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
  expect(images[0]?.src).toBe(`https://earth-assets.example/runtime-assets/${'a'.repeat(64)}/surface.webp`);
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
  expect(reads).toEqual(['/objects/earth/asset-hashes/page.normal.level.2048.json']);
  expect(images[0]?.src).toBe(`https://earth-assets.example/runtime-assets/${'c'.repeat(64)}/page-level-1024.webp`);
  lease.destroy();
});
test('cancelled preflight releases an unclaimed bank and cannot reach a scene', async () => {
  const controller = new AbortController(); controller.abort();
  const residency = createPreparedResidency({ assets });
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await expect(lease.ready).rejects.toThrow('cancelled');
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
  lease.destroy();
  expect(await residency.prepareStartup()).toBeNull();
});
test('ready unclaimed resources are cancelled promptly without double destruction', async () => {
  const controller = new AbortController();
  const residency = createPreparedResidency({ assets });
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await lease.ready; controller.abort(); lease.destroy();
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
  expect(await residency.prepareStartup()).toBeNull();
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
  expect([...f.decodes.keys()]).toEqual(['/base.webp']);
  f.decodes.get('/base.webp')!.resolve();
  await vi.waitFor(() => expect(f.decodes.has('/a.webp')).toBe(true));
  key = 'b';
  f.decodes.get('/a.webp')!.resolve();
  await vi.waitFor(() => expect(f.decodes.has('/b.webp')).toBe(true));
  f.decodes.get('/b.webp')!.resolve();
  await prepared;
  const residency = f.lease.claim(f.assets, {});
  expect([...residency.resources.readyKeys()].sort()).toEqual(['b', 'base']);
  const ticket = residency.request({ required: ['b'] });
  expect(await ticket.ready).toBe(ticket);
  residency.commit(ticket);
  expect(f.decodes.size).toBe(3); // The mount reuses the decoded image handle.
  residency.destroy();
});

test('view preparation cancels pending native decode and propagates required image failure', async () => {
  const cancelled = decodingFixture();
  const pending = cancelled.lease.prepareDemand(() => ({ required: ['a'] }));
  cancelled.controller.abort();
  await expect(pending).rejects.toThrow('cancelled');
  expect(() => cancelled.lease.claim(cancelled.assets, {})).toThrow('unavailable');

  const failed = decodingFixture();
  const preparation = failed.lease.prepareDemand(() => ({ required: ['a'] }));
  failed.decodes.get('/base.webp')!.resolve();
  await vi.waitFor(() => expect(failed.decodes.has('/a.webp')).toBe(true));
  failed.decodes.get('/a.webp')!.reject(new Error('image failed'));
  await expect(preparation).rejects.toThrow('did not decode');
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
  expect(images.map(image => image.src).sort()).toEqual(['/a.webp', '/b.webp', '/c.webp']);
  const failing = images.find(image => image.src === '/b.webp')!;
  failing.removeAttribute = () => { throw new Error('release failed'); };
  expect(() => lease.destroy()).toThrow(/cleanup failed/);
  expect(images.filter(image => image !== failing).every(image => image.src === '')).toBe(true);
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
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
  expect(f.residency.stats().committed).toEqual([]);
  expect(f.residency.stats().pools[0].resident).toBeLessThanOrEqual(3);
  const adopted = f.lease.claim(f.assets, {});
  expect(adopted.stats().committed).toEqual(['d']);
  expect(adopted.resources.has('d')).toBe(true);
  adopted.destroy();
});

test('a second preflight checkpoint replaces a ready unpublished selection instead of protecting both', async () => {
  const f = boundedLease([], 2);
  await f.lease.prepareDemand(() => ({ required: ['a', 'b'] }));
  await f.lease.prepareDemand(() => ({ required: ['c', 'd'] }));
  expect(f.residency.stats().committed).toEqual([]);
  expect(f.residency.stats().pools[0].resident).toBe(2);
  const adopted = f.lease.claim(f.assets, {});
  expect(adopted.stats().committed).toEqual(['c', 'd']);
  expect(adopted.resources.has('c')).toBe(true); expect(adopted.resources.has('d')).toBe(true);
  adopted.destroy();
});
