import assert from "node:assert/strict";
import test from "node:test";
import { preparedRowPresentation } from "./prepared-row-presentation.mjs";
import { PREPARED_MARS_LIGHTING } from "../planets/mars/runtime/preparedLighting.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../planets/jupiter/runtime/preparedLighting.mjs";

for (const [name, plan, fallback] of [["Mars", PREPARED_MARS_LIGHTING.banks[2], "same-column"],
  ["Jupiter", PREPARED_JUPITER_LIGHTING, "nearest-frame"]]) {
  test(`${name} fallback selects existing prepared addresses without requesting a row`, () => {
    const reads = [], count = plan.transport.framesPerRow ?? 1;
    const resources = { has: key => ["row:2", "row:6"].includes(key), readyKeys: () => ["row:2", "row:6"],
      url: key => { reads.push(key); return `/scenes/${name.toLowerCase()}/${key}.webp`; } };
    for (const frame of [0, 3 * count + count - 1, 5 * count, plan.presentations.length - 1]) {
      const result = preparedRowPresentation(plan, frame, resources, "row:", fallback);
      const target = plan.presentations[frame].rowIndex;
      const row = Math.abs(target - 2) <= Math.abs(target - 6) ? 2 : 6;
      const expected = fallback === "nearest-frame" ? Math.max(row * count, Math.min((row + 1) * count - 1, frame)) : row * count + frame % count;
      assert.equal(result.frameIndex, expected);
      assert.equal(result.backgroundPosition, plan.presentations[expected].backgroundPosition);
      assert.equal(reads.at(-1), `row:${row}`);
    }
    assert.equal(preparedRowPresentation(plan, 0, { has: () => false, readyKeys: () => [] }, "row:"), null);
    assert.throws(() => preparedRowPresentation(plan, -1, resources, "row:"), /Unprepared/);
  });
}
