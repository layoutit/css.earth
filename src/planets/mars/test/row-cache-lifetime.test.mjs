import assert from "node:assert/strict";
import test from "node:test";
import { createRowShardCache as createMarsCache } from "../runtime/preparedRowCache.mjs";
import { createRowShardCache as createJupiterCache } from "../../jupiter/runtime/preparedRowCache.mjs";
import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../../jupiter/runtime/preparedLighting.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";

for (const [name, create, plan] of [
  ["Mars", createMarsCache, PREPARED_MARS_LIGHTING.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)]],
  ["Jupiter", createJupiterCache, PREPARED_JUPITER_LIGHTING],
]) {
  test(`${name} row cache retries failed decode and preserves its allocation bound`, async () => {
    const previous = globalThis.Image;
    const images = [];
    globalThis.Image = class {
      constructor() {
        this.naturalWidth = 64;
        this.naturalHeight = 64;
        this.decode = () => new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
        images.push(this);
      }
      removeAttribute(name) { if (name === "src") this.src = ""; }
    };
    const cache = create(plan);
    try {
      const initial = assert.rejects(cache.prepareInitial(), /decode/i);
      const failed = images[0];
      failed.reject(new Error("injected failure"));
      await initial;
      assert.equal(failed.src, "");
      const retried = cache.prepareInitial();
      for (const image of images) image.resolve();
      await retried;
      assert.ok(cache.stats().readyCount > 0);
      assert.ok(images.length <= plan.transport.maximumRetainedRowCount);
      cache.destroy();
      assert.equal(cache.stats().retainedImageCount, 0);
      assert.ok(images.every((image) => image.src === ""));
    } finally { cache.destroy(); globalThis.Image = previous; }
  });

  test(`${name} row cache contains late rejection and releases siblings after cleanup error`, async () => {
    const previous = globalThis.Image;
    const images = [];
    globalThis.Image = class {
      constructor() {
        this.naturalWidth = 64;
        this.naturalHeight = 64;
        this.decode = () => new Promise((resolve, reject) => { this.reject = reject; });
        images.push(this);
      }
      removeAttribute(name) { if (name === "src") this.src = ""; }
    };
    const cache = create(plan);
    try {
      const initial = cache.prepareInitial();
      let callbacks = 0;
      cache.onReady(() => { callbacks += 1; });
      images[0].removeAttribute = () => { throw new Error("release failure"); };
      assert.throws(() => cache.destroy(), /cleanup failed/);
      assert.ok(images.slice(1).every((image) => image.src === ""));
      for (const image of images) image.reject(new Error("late failure"));
      await initial;
      assert.equal(callbacks, 0);
      assert.equal(cache.stats().retainedImageCount, 0);
      assert.equal(cache.stats().pendingCount, 0);
      cache.destroy();
    } finally { cache.destroy(); globalThis.Image = previous; }
  });
}
