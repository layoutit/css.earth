import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

test("guards retained body and overlay registration without forcing one scene", async () => {
  const source = await readFile(new URL(
    "./body-layer-registration.mjs",
    import.meta.url,
  ), "utf8");
  assert.match(source, /sceneElement\.contains\(bodySystem\)/u);
  assert.match(source, /bodySystem\.closest\("\.polycss-scene"\) !== sceneElement/u);
  assert.match(source, /overlay\.closest\("\.planet-stage"\) !== stage/u);
  assert.doesNotMatch(source, /sceneElement\.contains\(overlay\)/u);
  assert.match(source, /body-layer parent identity changed/u);
  assert.doesNotMatch(source, /querySelectorAll|requestAnimationFrame/u);
});
