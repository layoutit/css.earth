import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { prepareSaturnLeafLayouts, serializeSaturnLeafLayouts } from "../tools/prepare-leaf-layouts.mjs";
import { PREPARED_SATURN_LEAF_LAYOUTS } from "../runtime/leaf-layouts.mjs";
const scene = await readFile(new URL("../runtime/preparedSceneRuntime.mjs", import.meta.url), "utf8");
const stylesheet = await readFile(new URL("../runtime/styles.css", import.meta.url), "utf8");
test("missing interior leaf layouts reproduce from checked scene and stylesheet bytes", async () => {
  const generated = prepareSaturnLeafLayouts(scene, stylesheet);
  assert.deepEqual(generated, PREPARED_SATURN_LEAF_LAYOUTS);
  assert.equal(serializeSaturnLeafLayouts(generated), await readFile(new URL("../runtime/leaf-layouts.mjs", import.meta.url), "utf8"));
  assert.equal(Object.values(generated.classes).reduce((sum, layout) => sum + layout.completedLeafCount, 0), 162);
});
test("changing checked defaults changes the descriptor; no runtime stylesheet inspection supplies missing values", () => {
  const modified = stylesheet.replace("--polycss-atlas-width, 64px", "--polycss-atlas-width, 80px");
  const generated = prepareSaturnLeafLayouts(scene, modified);
  assert.ok(Object.values(generated.classes).every(layout => layout.width === "80px"));
  assert.notEqual(generated.sources["runtime/styles.css"], PREPARED_SATURN_LEAF_LAYOUTS.sources["runtime/styles.css"]);
});
