import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createPreparedImageStore, decodePreparedImage, releasePreparedImage } from '../renderers/css/dist/testing.js';

type PreparedImage = Parameters<typeof decodePreparedImage>[0];
interface ControlledImage extends PreparedImage { calls: number; resolve(): void; reject(reason: unknown): void; }

function harness() {
  const images: ControlledImage[] = [];
  const store = createPreparedImageStore({ createImage() {
    const image: ControlledImage = { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, calls: 0,
      decode: () => Promise.reject(new Error("Decode must be installed before use")),
      resolve() { throw new Error("No pending decode"); },
      reject(_reason: unknown) { throw new Error("No pending decode"); },
    };
    image.decode = () => {
      image.calls += 1;
      return new Promise<void>((resolve, reject) => { image.resolve = resolve; image.reject = reject; });
    };
    images.push(image);
    return image;
  } });
  return { images, store, lease: store.createLease() };
}

test("destroy retires every image even when one native release throws", async () => {
  const { store, images, lease } = harness();
  const first = lease.load("/first.webp");
  const second = lease.load("/second.webp");
  images[0].removeAttribute = () => { throw new Error("release"); };
  assert.throws(() => store.destroy(), AggregateError);
  assert.equal(images[1].src, "");
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
  images[0].resolve(); images[1].reject(new Error("late"));
  assert.deepEqual(await Promise.all([first, second]), [null, null]);
  store.destroy();
});

test("image construction failures are rejected loads and do not poison retries", async () => {
  const store = createPreparedImageStore({ createImage() { throw new Error("allocation"); } });
  const lease = store.createLease();
  await assert.rejects(lease.load("/image.webp"), /allocation/);
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
});

test("release still clears src if clearing srcset fails", () => {
  const image: PreparedImage = { src: "/retained.webp", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode: () => Promise.resolve(), removeAttribute(name: string) {
    if (name === "srcset") throw new Error("srcset");
    this.src = "";
  } };
  assert.throws(() => releasePreparedImage(image), AggregateError);
  assert.equal(image.src, "");
});

test("deduplicates pending work and retains successful decoded identity", async () => {
  const { store, images, lease } = harness();
  const a = lease.load("/selected.webp");
  assert.equal(lease.load("/selected.webp"), a);
  assert.equal(images.length, 1);
  assert.equal(images[0].calls, 1);
  assert.deepEqual(store.stats(), { pendingCount: 1, retainedCount: 0 });
  images[0].resolve();
  assert.equal(await a, images[0]);
  assert.equal(await lease.load("/selected.webp"), images[0]);
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 1 });
  store.destroy();
  assert.equal(images[0].src, "");
});

for (const badDimensions of [false, true]) test(`failed decode permits explicit retry (${badDimensions})`, async () => {
  const { store, images, lease } = harness();
  const failed = lease.load("/selected.webp");
  if (badDimensions) { images[0].naturalWidth = 0; images[0].resolve(); }
  else images[0].reject(new Error("network"));
  await assert.rejects(failed, /selected.webp/);
  assert.equal(images[0].src, "");
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
  const retried = lease.load("/selected.webp");
  images[1].resolve();
  assert.equal(await retried, images[1]);
});

for (const rejectOld of [false, true]) test(`released old request cannot retire replacement (${rejectOld})`, async () => {
  const { store, images, lease } = harness();
  const a = lease.load("/selected.webp");
  assert.equal(lease.release("/selected.webp"), true);
  const b = lease.load("/selected.webp");
  if (rejectOld) images[0].reject(new Error("late"));
  else images[0].resolve();
  assert.equal(await a, null);
  assert.deepEqual(store.stats(), { pendingCount: 1, retainedCount: 0 });
  images[1].resolve();
  assert.equal(await b, images[1]);
  assert.equal(lease.release("/selected.webp"), true);
  assert.equal(lease.release("/selected.webp"), false);
});

test("destroy releases pending and retained images, not independent stores", async () => {
  const { store, images, lease } = harness();
  const pending = lease.load("/pending.webp");
  const retained = lease.load("/retained.webp");
  images[1].resolve();
  await retained;
  const other = harness();
  const otherLoad = other.lease.load("/pending.webp");
  store.destroy();
  store.destroy();
  assert.deepEqual(images.map(({ src }) => src), ["", ""]);
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
  assert.equal(await lease.load("/new.webp"), null);
  assert.equal(images.length, 2);
  images[0].reject(new Error("destroyed"));
  assert.equal(await pending, null);
  assert.equal(other.images[0].src, "/pending.webp");
  other.images[0].resolve();
  await otherLoad;
});

test("transport failure never clears an owner's reused slot", async () => {
  let reject!: (error: unknown) => void;
  const image: PreparedImage = { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode: () => new Promise<void>((_, fail) => { reject = fail; }) };
  const work = decodePreparedImage(image, "/old.webp");
  image.src = "/replacement.webp";
  reject(new Error("old decode"));
  await assert.rejects(work, /old.webp/);
  assert.equal(image.src, "/replacement.webp");
  releasePreparedImage(image);
  assert.equal(image.src, "");
});
