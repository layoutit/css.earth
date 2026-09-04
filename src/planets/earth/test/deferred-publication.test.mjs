import assert from "node:assert/strict";
import test from "node:test";
import { createEarthRowShardCache } from "../runtime/preparedRowCache.mjs";
import { createMercuryRowShardCache } from "../../mercury/runtime/preparedRowCache.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
for (const [id, create] of [["Earth", createEarthRowShardCache], ["Mercury", createMercuryRowShardCache]]) {
  for (const failure of ["publication", "decode"]) {
    test(`${id}: deferred ${failure} failures use the correct error boundary`, async () => {
      const previousImage = globalThis.Image, previousError = console.error;
      const images = [], fatal = [], decoded = [];
      class Image {
        naturalWidth = 1;
        naturalHeight = 1;
        constructor() { images.push(this); }
        decode() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
        removeAttribute(name) { if (name === "src") this.src = ""; }
      }
      globalThis.Image = Image;
      console.error = (error) => decoded.push(error);
      const rows = [0, 1, 2].map((index) => ({ url: `/row-${index}`, assets: { two: `/row-${index}` } }));
      const frames = rows.map((_, rowIndex) => ({ rowIndex }));
      const cache = create({ rows, preparedRows: rows, frames, presentations: frames,
        transport: { model: "row-shard-cache", defaultRow: 0, initialWarmRows: [0],
          maximumRetainedRowCount: 2, initialDecodedWorkingSetBytes: {}, maximumDecodedWorkingSetBytes: {} },
      }, { onError(error) { fatal.push(error); cache.destroy(); } });
      try {
        const initial = cache.prepareInitial();
        images[0].resolve();
        await initial;
        let notifications = 0;
        cache.onReady(() => {
          notifications += 1;
          if (failure === "publication") throw new Error("style publication failed");
        });
        cache.presentation(1);
        if (id === "Earth") await new Promise((resolve) => setTimeout(resolve, 140));
        if (failure === "publication") images[1].resolve();
        else images[1].reject(new Error("network decode failed"));
        await tick();
        if (failure === "publication") {
          assert.equal(fatal.length, 1);
          assert.match(fatal[0].message, /style publication failed/u);
          assert.equal(notifications, 1);
          assert.equal(decoded.length, 0, "publication must not be classified as a decode failure");
          assert.equal(cache.presentation(2), null);
          assert.ok(images.every((image) => image.src === ""));
        } else {
          assert.equal(fatal.length, 0);
          assert.equal(decoded.length, 1);
          assert.equal(notifications, 0);
          assert.equal(cache.stats().appliedRow, 0, "last decoded presentation remains active");
          cache.presentation(1);
          if (id === "Earth") await new Promise((resolve) => setTimeout(resolve, 140));
          images[1].resolve();
          await tick();
          assert.equal(notifications, 1, "an explicit camera request retries a failed decode");
          assert.equal(fatal.length, 0);
        }
      } finally { cache.destroy(); globalThis.Image = previousImage; console.error = previousError; }
    });
  }
}
