import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANET_SHADOW_DEFAULT,
  PLANET_SPEED_STATES,
} from "./planet-feature-controls.mjs";

test("defaults the shared retained-overlay shadow control to off", () => {
  assert.equal(PLANET_SHADOW_DEFAULT, false);
});

test("publishes the established five-state planet speed policy", () => {
  assert.deepEqual(PLANET_SPEED_STATES.map(({ label, value }) => [label, value]), [
    ["off", 0], ["normal", 1], ["fast", 2], ["fastest", 3], ["superfast", 4],
  ]);
});
