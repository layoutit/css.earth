import assert from "node:assert/strict";
import { test } from "node:test";
import { preparePerspectiveCamera } from "./prepare-perspective-camera.mjs";
import { PREPARED_MERCURY_SCENE } from "../planets/mercury/runtime/preparedScene.mjs";

test("shared perspective recipe preserves Mercury's accepted camera", () => {
  assert.deepEqual(preparePerspectiveCamera({ sky: PREPARED_MERCURY_SCENE.starfield }), PREPARED_MERCURY_SCENE.camera);
});
