import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createPreparedImageStore } from '../renderers/css/dist/testing.js';
import type { PreparedImage } from '../renderers/css/rendering/prepared-image-store.ts';
type ImageLease = ReturnType<ReturnType<typeof createPreparedImageStore>["createLease"]>;
interface DecodeJob { image: PreparedImage; url: string; resolve(): void; reject(reason: unknown): void; }

function harness({ capacity = 3, concurrency = 2, reuse = true } = {}) {
  const images: PreparedImage[] = [], decodes: DecodeJob[] = [];
  const store = createPreparedImageStore({
    pools: [{ id: "material", capacity, concurrency, reuse }],
    createImage() {
      const image: PreparedImage = { naturalWidth: 1, naturalHeight: 1, src: "", decoding: "async", decode() {
        return new Promise<void>((resolve, reject) => decodes.push({ image, url: image.src, resolve, reject }));
      } };
      images.push(image);
      return image;
    },
  });
  const load = (lease: ImageLease, url: string) => lease.load(url, { pool: "material" });
  return { store, images, decodes, load };
}
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

test("request, committed and prewarm owners share one native URL without sharing cancellation", async () => {
  const { store, images, decodes, load } = harness();
  const active = store.createLease("committed"), request = store.createLease("request"), warm = store.createLease("prewarm");
  const a = load(active, "/same.webp"), b = load(request, "/same.webp"), c = load(warm, "/same.webp");
  assert.equal(load(request, "/same.webp"), b);
  assert.equal(images.length, 1);
  request.destroy();
  assert.equal(await b, null);
  assert.equal(images[0].src, "/same.webp");
  decodes[0].resolve();
  assert.equal(await a, images[0]);
  assert.equal(await c, images[0]);
  warm.destroy();
  assert.equal(store.read("/same.webp"), images[0]);
  active.destroy();
  assert.equal(store.has("/same.webp"), false);
  assert.equal(images[0].src, "");
  assert.equal(store.ownershipStats().releases, 1);
  active.destroy(); store.destroy();
  assert.equal(store.ownershipStats().releases, 1);
});

for (const rejectOld of [false, true]) test(`a cancelled never-settling slot starts replacement immediately; late success/failure is inert (${rejectOld})`, async () => {
  const { store, images, decodes, load } = harness({ capacity: 1, concurrency: 1 });
  const old = store.createLease("request"), current = store.createLease("request");
  const a = load(old, "/old.webp"), b = load(current, "/new.webp");
  assert.equal(decodes.length, 1);
  old.destroy();
  assert.equal(await a, null);
  assert.equal(decodes.length, 2);
  assert.equal(images.length, 1);
  assert.equal(images[0].src, "/new.webp");
  if (rejectOld) decodes[0].reject(new Error("late")); else decodes[0].resolve();
  await flush();
  assert.equal(images[0].src, "/new.webp");
  assert.equal(store.ownershipStats().pools[0].active, 1);
  decodes[1].resolve();
  assert.equal(await b, images[0]);
  assert.equal(store.ownershipStats().pools[0].active, 0);
  store.destroy();
});

test("complete page banks have two logical decode slots and cancellation cannot stall the replacement bank", async () => {
  const { store, decodes, load } = harness({ capacity: 8, concurrency: 2, reuse: false });
  const abandoned = store.createLease("request"), next = store.createLease("request");
  const first = Array.from({ length: 4 }, (_, i) => load(abandoned, `/a-${i}.webp`));
  const second = Array.from({ length: 4 }, (_, i) => load(next, `/b-${i}.webp`));
  assert.equal(decodes.length, 2);
  abandoned.destroy();
  assert.deepEqual(await Promise.all(first), [null, null, null, null]);
  assert.equal(decodes.length, 4);
  assert.equal(store.ownershipStats().pools[0].active, 2);
  decodes[2].resolve(); decodes[3].resolve(); await flush();
  assert.equal(decodes.length, 6);
  decodes[4].resolve(); decodes[5].resolve();
  assert.equal((await Promise.all(second)).filter(Boolean).length, 4);
  assert.equal(store.stats().retainedCount, 4);
  assert.equal(store.ownershipStats().pools[0].active, 0);
  store.destroy();
});

test("failed shared decode rejects its owners and an explicit retry uses the same reusable allocation", async () => {
  const { store, decodes, images, load } = harness({ capacity: 1, concurrency: 1 });
  const first = store.createLease("request"), second = store.createLease("prewarm");
  const a = load(first, "/broken.webp"), b = load(second, "/broken.webp");
  decodes[0].reject(new Error("network"));
  await assert.rejects(a, /broken.webp/); await assert.rejects(b, /broken.webp/);
  const retry = load(first, "/broken.webp");
  second.destroy();
  assert.equal(images[0].src, "/broken.webp");
  decodes[1].resolve();
  assert.equal(await retry, images[0]);
  assert.equal(images.length, 1);
  store.destroy();
});

test("cleanup errors retire all owners and unblock the queue before being reported", async () => {
  const { store, images, decodes, load } = harness({ capacity: 2, concurrency: 2 });
  const old = store.createLease("request"), next = store.createLease("request");
  const abandoned = [load(old, "/a.webp"), load(old, "/b.webp")];
  const replacement = load(next, "/c.webp");
  images[0].removeAttribute = () => { throw new Error("native cleanup"); };
  assert.throws(() => old.destroy(), AggregateError);
  assert.deepEqual(await Promise.all(abandoned), [null, null]);
  assert.equal(decodes.length, 3);
  assert.equal(store.ownershipStats().entries.length, 1);
  decodes[2].resolve(); await replacement;
  store.destroy();
});

test("queued cancelled work never constructs an image and a disposed store stays inert", async () => {
  const { store, images, decodes, load } = harness({ capacity: 1, concurrency: 1 });
  const one = store.createLease("committed"), two = store.createLease("request");
  const a = load(one, "/one.webp"), b = load(two, "/two.webp");
  two.destroy(); assert.equal(await b, null);
  decodes[0].resolve(); await a;
  assert.equal(images.length, 1);
  store.destroy();
  assert.equal(await load(store.createLease("late"), "/late.webp"), null);
  assert.equal(images.length, 1);
});

test("a URL shared across catalog pools cannot strand the released role's reusable slot", async () => {
  const jobs: (() => void)[] = [];
  const store = createPreparedImageStore({ pools: ["row", "full-phase"].map(id => ({ id, capacity: 1, concurrency: 1, reuse: true })),
    createImage() { return { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode() { return new Promise<void>(resolve => jobs.push(resolve)); } }; },
  });
  const row = store.createLease("committed"), full = store.createLease("mount");
  const original = row.load("/same.webp", { pool: "row" });
  const alias = full.load("/same.webp", { pool: "full-phase" });
  assert.equal(jobs.length, 1);
  row.release("/same.webp");
  assert.equal(await original, null);
  const replacement = row.load("/next.webp", { pool: "row" });
  assert.equal(jobs.length, 2);
  jobs[0](); jobs[1]();
  const [a, b] = await Promise.all([alias, replacement]);
  assert.ok(a); assert.ok(b);
  assert.equal(a.src, "/same.webp"); assert.equal(b.src, "/next.webp");
  assert.ok(store.ownershipStats().pools.every(pool => pool.active === 0 && pool.occupied === 1));
  store.destroy();
});

test("declared native decoding hints survive pooled reuse without introducing another image owner", async () => {
  const images: PreparedImage[] = [];
  const store = createPreparedImageStore({ pools: [{ id: "material", capacity: 1, concurrency: 1, reuse: true, decoding: "sync" }],
    createImage() { const image: PreparedImage = { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode: () => Promise.resolve(),
      removeAttribute(name: string) { if (name === "src") this.src = ""; } }; images.push(image); return image; } });
  for (const url of ["/scenes/mars/a.webp", "/scenes/mars/b.webp"]) {
    const lease = store.createLease(); const image = await lease.load(url, { pool: "material" });
    assert.ok(image);
    assert.equal(image.decoding, "sync"); lease.destroy();
  }
  assert.equal(images.length, 1); assert.equal(store.ownershipStats().entries.length, 0); store.destroy();
  assert.throws(() => Reflect.apply(createPreparedImageStore, undefined, [{ pools: [{ id: "bad", capacity: 1, concurrency: 1, decoding: "invented" }] }]), /policy/);
});

test("CSS handoff drops ready native ownership without cancelling its published URL", async () => {
  const images: PreparedImage[] = [];
  const store = createPreparedImageStore({ pools: [{ id: "warm", capacity: 1, concurrency: 1, reuse: true }],
    createImage() { const image: PreparedImage = { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode: () => Promise.resolve(),
      removeAttribute() { assert.fail("A handed-off URL must not be cancelled"); } }; images.push(image); return image; } });
  const a = store.createLease(), b = store.createLease();
  const image = await a.load("/scenes/mars/published.webp", { pool: "warm" });
  await b.load("/scenes/mars/published.webp", { pool: "warm" });
  a.handoff("/scenes/mars/published.webp"); a.destroy();
  assert.equal(store.read("/scenes/mars/published.webp"), image);
  b.destroy(); assert.equal(store.ownershipStats().entries.length, 0);
  assert.equal(store.ownershipStats().pools[0].slots, 0);
  assert.ok(image);
  assert.equal(image.src, "/scenes/mars/published.webp"); store.destroy();
});
test("unsettled resources cannot be handed off and cancellation still clears their native URL", async () => {
  const image: PreparedImage = { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode: () => new Promise<void>(() => {}) };
  const store = createPreparedImageStore({ createImage: () => image });
  const lease = store.createLease(), pending = lease.load("/scenes/mars/pending.webp");
  assert.throws(() => lease.handoff("/scenes/mars/pending.webp"), /decoded/);
  assert.throws(() => lease.handoff("/scenes/mars/undeclared.webp"), /owned/);
  lease.destroy(); assert.equal(await pending, null); assert.equal(image.src, ""); store.destroy();
});
