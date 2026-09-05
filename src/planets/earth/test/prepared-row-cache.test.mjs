import assert from "node:assert/strict";
import test from "node:test";

import { createEarthRowShardCache } from
  "../runtime/preparedRowCache.mjs";

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

test("Earth row disposal attempts every slot before reporting release failure", async () => {
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
  const cache = createEarthRowShardCache({
    preparedRows: [0, 1, 2].map((i) => ({ assets: { two: `/row-${i}` } })),
    frames: [0, 1, 2].map((rowIndex) => ({ rowIndex })),
    transport: { model: "row-shard-cache", defaultRow: 0, initialWarmRows: [0, 1, 2],
      maximumRetainedRowCount: 3, initialDecodedWorkingSetBytes: {}, maximumDecodedWorkingSetBytes: {} },
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

test("Earth stale warm failure does not suppress a newer camera row request", async () => {
  const previous = globalThis.Image;
  const previousError = console.error;
  const images = [];
  class Image {
    naturalWidth = 1;
    naturalHeight = 1;
    constructor() { images.push(this); }
    decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
    removeAttribute(name) { if (name === "src") this.src = ""; }
  }
  globalThis.Image = Image;
  console.error = () => {};
  const cache = createEarthRowShardCache({
    preparedRows: [0, 1, 2, 3].map((i) => ({ assets: { two: `/row-${i}` } })),
    frames: [0, 1, 2, 3].map((rowIndex) => ({ rowIndex })),
    transport: { model: "row-shard-cache", defaultRow: 0, initialWarmRows: [0],
      maximumRetainedRowCount: 2, initialDecodedWorkingSetBytes: {}, maximumDecodedWorkingSetBytes: {} },
  });
  try {
    const initial = cache.prepareInitial();
    images[0].resolve();
    await initial;
    cache.presentation(1);
    await wait(150);
    assert.equal(images[1].src, "/row-1");
    cache.presentation(3);
    images[1].reject(new Error("old row failed"));
    await wait(150);
    assert.equal(images[1].src, "/row-3", "new target must still start without another camera event");
    assert.equal(cache.stats().pendingCount, 1);
    images[1].resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(cache.presentation(3));
    assert.equal(cache.stats().appliedRow, 3);
  } finally { cache.destroy(); globalThis.Image = previous; console.error = previousError; }
});

test("coalesces transient row requests and replaces an evicted image", async () => {
  const NativeImage = globalThis.Image;
  const images = [];
  class PreparedImage {
    constructor() {
      this.decoding = "auto";
      this.src = "";
      this.naturalWidth = 1;
      this.naturalHeight = 1;
      images.push(this);
    }

    decode() {
      return Promise.resolve();
    }

    removeAttribute(name) {
      if (name === "src") this.src = "";
    }
  }
  globalThis.Image = PreparedImage;
  const rows = Array.from({ length: 4 }, (_, rowIndex) => ({
    assets: {
      one: `/row-${rowIndex}.webp`,
      two: `/row-${rowIndex}@2x.webp`,
    },
  }));
  const cache = createEarthRowShardCache({
    preparedRows: rows,
    frames: rows.map((_, rowIndex) => ({ rowIndex })),
    transport: {
      model: "row-shard-cache",
      defaultRow: 0,
      initialWarmRows: [0],
      maximumRetainedRowCount: 2,
      initialDecodedWorkingSetBytes: { one: 1, two: 2 },
      maximumDecodedWorkingSetBytes: { one: 1, two: 2 },
    },
  });
  try {
    await cache.prepareInitial();
    let notifications = 0;
    let expectedRow = 2;
    cache.onReady(() => {
      notifications += 1;
      cache.presentation(expectedRow);
    });
    cache.presentation(1);
    cache.presentation(2);

    await wait(80);
    assert.equal(cache.stats().runtimeDecodeCount, 0);
    await wait(100);
    assert.equal(cache.stats().appliedRow, 2);

    expectedRow = 3;
    cache.presentation(3);
    await wait(180);

    const stats = cache.stats();
    assert.equal(stats.requestStabilityMilliseconds, 120);
    assert.equal(stats.runtimeDecodeCount, 2);
    assert.equal(stats.appliedRow, 3);
    assert.equal(stats.releaseCount, 1);
    assert.equal(notifications, 2);
    assert.equal(images.length, 3);
    assert.equal(images[0].src, "");
    assert.equal(images[1].src, "/row-2@2x.webp");
    assert.equal(images[2].src, "/row-3@2x.webp");
  } finally {
    cache.destroy();
    globalThis.Image = NativeImage;
  }
});
