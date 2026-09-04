import assert from "node:assert/strict";
import test from "node:test";
import { createUranusMaterialNeighborhoodCache } from "../runtime/material-neighborhood-cache.mjs";

const rows = (name) => Array.from({ length: 16 }, (_, i) => `/${name}-${i}`);
function fixture() {
  const images = [];
  const cache = createUranusMaterialNeighborhoodCache({ createImage() {
    const image = { src: "", naturalWidth: 1, naturalHeight: 1,
      decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); },
      removeAttribute(name) { if (name === "src") this.src = ""; },
    };
    images.push(image);
    return image;
  } });
  return { images, cache };
}

test("Uranus pending lens preserves active neighborhood and failure remains retryable", async () => {
  const { cache, images } = fixture();
  const initial = cache.warm(rows("normal"), 4);
  images.forEach((image) => image.resolve());
  await initial;
  const lens = cache.prepare(rows("methane"), 4);
  assert.equal(cache.stats().retainedCount, 3);
  assert.equal(cache.stats().pendingCount, 3);
  images[3].resolve();
  images[4].reject(new Error("material failed"));
  await assert.rejects(lens, /Prepared image did not decode/u);
  assert.ok(images.slice(0, 3).every((image) => image.src.startsWith("/normal")));
  assert.ok(images.slice(3).every((image) => image.src === ""));
  const retry = cache.prepare(rows("methane"), 4);
  images[5].reject(new Error("late sibling"));
  images.slice(6).forEach((image) => image.resolve());
  const prepared = await retry;
  prepared.commit();
  assert.equal(cache.stats().retainedCount, 3);
  assert.ok(images.slice(0, 3).every((image) => image.src === ""));
  cache.destroy();
});

test("Uranus A/B/A preparation contains old settlements and keeps camera neighborhood independent", async () => {
  const { cache, images } = fixture();
  const a = cache.prepare(rows("a"), 3);
  const b = cache.prepare(rows("b"), 3);
  const secondA = cache.prepare(rows("a"), 3);
  const camera = cache.warm(rows("normal"), 12);
  assert.equal(cache.stats().pendingCount, 6);
  images.slice(0, 6).forEach((image) => image.reject(new Error("retired")));
  images.slice(6).forEach((image) => image.resolve());
  assert.equal(await a, null);
  assert.equal(await b, null);
  await camera;
  const prepared = await secondA;
  prepared.commit();
  assert.equal(cache.stats().retainedCount, 3);
  cache.destroy();
  assert.equal(await cache.prepare(rows("c"), 4), null);
  assert.ok(images.every((image) => image.src === ""));
});

test("Uranus camera ownership failures are synchronous, native decode failures remain asynchronous", async () => {
  const { cache, images } = fixture();
  const initial = cache.warm(rows("normal"), 4);
  images.forEach((image) => image.resolve());
  await initial;
  images[0].removeAttribute = (name) => { if (name === "src") throw new Error("release failed"); };
  assert.throws(() => cache.warm(rows("normal"), 12), AggregateError);
  assert.equal(images[1].src, "", "release failure must not strand siblings");
  const retry = cache.warm(rows("normal"), 12);
  images[3].reject(new Error("decode failed"));
  await assert.rejects(retry, /Prepared image did not decode/u);
  cache.destroy();
  images.slice(4).forEach((image) => image.reject(new Error("late decode")));
});
