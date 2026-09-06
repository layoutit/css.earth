import assert from "node:assert/strict";
import test from "node:test";

import { orientLatitudeBandsForProjectiveLeaves } from
  "../tools/orient-latitude-bands.mjs";

test("orients rows inside each latitude band without crossing bands", () => {
  const source = Buffer.from([1, 1, 2, 2, 3, 3, 4, 4]);
  const oriented = orientLatitudeBandsForProjectiveLeaves(
    source,
    { width: 2, height: 4, channels: 1 },
    2,
  );

  assert.deepEqual([...oriented], [2, 2, 1, 1, 4, 4, 3, 3]);
  assert.deepEqual([...source], [1, 1, 2, 2, 3, 3, 4, 4]);
});
