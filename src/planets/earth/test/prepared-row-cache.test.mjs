import assert from "node:assert/strict";
import test from "node:test";

import { createEarthRowShardCache } from
  "../runtime/preparedRowCache.mjs";

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

test("coalesces transient row requests and replaces an evicted image", async () => {
  const NativeImage = globalThis.Image;
  const images = [];
  class PreparedImage {
    constructor() {
      this.decoding = "auto";
      this.src = "";
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
