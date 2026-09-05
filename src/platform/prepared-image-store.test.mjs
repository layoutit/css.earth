import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedImageStore, decodePreparedImage, releasePreparedImage } from "./prepared-image-store.mjs";

function harness() {
  const images = [];
  const store = createPreparedImageStore({ createImage() {
    const image = { naturalWidth: 1, naturalHeight: 1, calls: 0 };
    image.decode = () => {
      image.calls += 1;
      return new Promise((resolve, reject) => { image.resolve = resolve; image.reject = reject; });
    };
    images.push(image);
    return image;
  } });
  return { images, store };
}

test("destroy retires every image even when one native release throws", async () => {
  const { store, images } = harness();
  const first = store.load("/first.webp");
  const second = store.load("/second.webp");
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
  await assert.rejects(store.load("/image.webp"), /allocation/);
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
});

test("release still clears src if clearing srcset fails", () => {
  const image = { src: "/retained.webp", removeAttribute(name) {
    if (name === "srcset") throw new Error("srcset");
    this.src = "";
  } };
  assert.throws(() => releasePreparedImage(image), AggregateError);
  assert.equal(image.src, "");
});

test("deduplicates pending work and retains successful decoded identity", async () => {
  const { store, images } = harness();
  const a = store.load("/selected.webp");
  assert.equal(store.load("/selected.webp"), a);
  assert.equal(images.length, 1);
  assert.equal(images[0].calls, 1);
  assert.deepEqual(store.stats(), { pendingCount: 1, retainedCount: 0 });
  images[0].resolve();
  assert.equal(await a, images[0]);
  assert.equal(await store.load("/selected.webp"), images[0]);
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 1 });
  store.destroy();
  assert.equal(images[0].src, "");
});

for (const badDimensions of [false, true]) test(`failed decode permits explicit retry (${badDimensions})`, async () => {
  const { store, images } = harness();
  const failed = store.load("/selected.webp");
  if (badDimensions) { images[0].naturalWidth = 0; images[0].resolve(); }
  else images[0].reject(new Error("network"));
  await assert.rejects(failed, /selected.webp/);
  assert.equal(images[0].src, "");
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
  const retried = store.load("/selected.webp");
  images[1].resolve();
  assert.equal(await retried, images[1]);
});

for (const rejectOld of [false, true]) test(`released old request cannot retire replacement (${rejectOld})`, async () => {
  const { store, images } = harness();
  const a = store.load("/selected.webp");
  assert.equal(store.release("/selected.webp"), true);
  const b = store.load("/selected.webp");
  if (rejectOld) images[0].reject(new Error("late"));
  else images[0].resolve();
  assert.equal(await a, null);
  assert.deepEqual(store.stats(), { pendingCount: 1, retainedCount: 0 });
  images[1].resolve();
  assert.equal(await b, images[1]);
  assert.equal(store.release("/selected.webp"), true);
  assert.equal(store.release("/selected.webp"), false);
});

test("destroy releases pending and retained images, not independent stores", async () => {
  const { store, images } = harness();
  const pending = store.load("/pending.webp");
  const retained = store.load("/retained.webp");
  images[1].resolve();
  await retained;
  const other = harness();
  const otherLoad = other.store.load("/pending.webp");
  store.destroy();
  store.destroy();
  assert.deepEqual(images.map(({ src }) => src), ["", ""]);
  assert.deepEqual(store.stats(), { pendingCount: 0, retainedCount: 0 });
  assert.equal(await store.load("/new.webp"), null);
  assert.equal(images.length, 2);
  images[0].reject(new Error("destroyed"));
  assert.equal(await pending, null);
  assert.equal(other.images[0].src, "/pending.webp");
  other.images[0].resolve();
  await otherLoad;
});

test("transport failure never clears an owner's reused slot", async () => {
  let reject;
  const image = { decode: () => new Promise((_, fail) => { reject = fail; }) };
  const work = decodePreparedImage(image, "/old.webp");
  image.src = "/replacement.webp";
  reject(new Error("old decode"));
  await assert.rejects(work, /old.webp/);
  assert.equal(image.src, "/replacement.webp");
  releasePreparedImage(image);
  assert.equal(image.src, "");
});
