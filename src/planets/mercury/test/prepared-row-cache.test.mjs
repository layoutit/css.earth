import assert from "node:assert/strict";
import test from "node:test";
import { createMercuryRowShardCache } from "../runtime/preparedRowCache.mjs";

test("Mercury rows reuse bounded slots, keep the applied row, and release pending work on disposal", async () => {
  const previous = globalThis.Image;
  const images = [];
  class Image {
    naturalWidth = 1;
    naturalHeight = 1;
    src = "";
    constructor() { images.push(this); }
    decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
    removeAttribute(name) { if (name === "src") this.src = ""; }
  }
  globalThis.Image = Image;
  const cache = createMercuryRowShardCache({
    rows: Array.from({ length: 4 }, (_, i) => ({ url: `/row-${i}` })),
    presentations: Array.from({ length: 4 }, (_, rowIndex) => ({ rowIndex })),
    transport: { model: "row-shard-cache", defaultRow: 0, initialWarmRows: [0],
      maximumRetainedRowCount: 2, initialDecodedWorkingSetBytes: 1, maximumDecodedWorkingSetBytes: 2 },
  });
  try {
    const initial = cache.prepareInitial();
    images[0].resolve();
    await initial;
    assert.equal(cache.presentation(1), null);
    assert.equal(images.length, 2);
    cache.presentation(2);
    images[1].resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(images.length, 2, "existing row slot must be reused");
    assert.equal(images[0].src, "/row-0", "applied row stays protected");
    assert.equal(images[1].src, "/row-2");
    assert.equal(cache.stats().staleWarmPasses, 1);
    cache.destroy();
    images[1].reject(new Error("retired decode"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(images.every((image) => image.src === ""));
    assert.equal(cache.stats().retainedImageCount, 0);
    assert.equal(cache.presentation(3), null);
  } finally { cache.destroy(); globalThis.Image = previous; }
});

test("Mercury row disposal attempts every slot before reporting release failure", async () => {
  const previous = globalThis.Image;
  const images = [];
  class Image {
    naturalWidth = 1;
    naturalHeight = 1;
    constructor() { this.index = images.length; this.releases = 0; images.push(this); }
    decode() { return Promise.resolve(); }
    removeAttribute(name) {
      if (name !== "src") return;
      this.releases += 1;
      if (this.index === 0) throw new Error("release failed");
      this.src = "";
    }
  }
  globalThis.Image = Image;
  const cache = createMercuryRowShardCache({
    rows: [0, 1, 2].map((i) => ({ url: `/row-${i}` })),
    presentations: [0, 1, 2].map((rowIndex) => ({ rowIndex })),
    transport: { model: "row-shard-cache", defaultRow: 0, initialWarmRows: [0, 1, 2],
      maximumRetainedRowCount: 3, initialDecodedWorkingSetBytes: 1, maximumDecodedWorkingSetBytes: 3 },
  });
  try {
    await cache.prepareInitial();
    assert.throws(cache.destroy, AggregateError);
    assert.ok(images.every((image) => image.releases === 1));
    assert.ok(images.slice(1).every((image) => image.src === ""));
    assert.equal(cache.stats().retainedImageCount, 0);
    assert.equal(cache.stats().imageAllocations, 0);
    assert.doesNotThrow(cache.destroy);
  } finally { globalThis.Image = previous; }
});
