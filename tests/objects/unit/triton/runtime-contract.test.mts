// Draft replacement for the retired terrestrial-lane unit tests of Triton
// (modelled on tests/objects/unit/pluto/runtime-contract.test.mts). Decoder-level tests that only read the
// source files and tools/objects/terrestrial-layers decoders stay valid and are kept beside this file.
import { requireRecord } from '../../../../tools/sources/source-values.mts';
import { required } from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('triton');
import runtimeDefinition from "../../../../src/objects/triton/prepared/runtime.json" with { type: "json" };
import assets from "../../../../src/objects/triton/prepared/assets.json" with { type: "json" };
import scene from "../../../../src/objects/triton/prepared/scene.json" with { type: "json" };
import lenses from "../../../../src/objects/triton/prepared/lenses.json" with { type: "json" };
import text from "../../../../src/objects/triton/prepared/text.json" with { type: "json" };
import controls from "../../../../src/objects/triton/prepared/controls.json" with { type: "json" };
import { objectRuntimePackageTests, preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";
import { readFile } from "node:fs/promises";

const LENS_IDS = ["normal","enhanced","ultraviolet","voyager-color"];

test("every Triton lens beyond the baked default has its surface and polar texture rules in the shared stylesheet", async () => {
  // The raster lane bakes the default lens into each leaf; the other lenses swap textures through these hand-written rules.
  const css = await readFile(new URL("../../../../src/renderers/css/styles/planet-surfaces.css", import.meta.url), "utf8");
  for (const id of LENS_IDS.filter(id => id !== lenses.defaultLens)) {
    assert.ok(css.includes(`.planet-stage[data-object-id="triton"][data-lens="${id}"] .polycss-scene s:not(.triton-polar) {\n  background-image: url("/scenes/triton/triton-${id}@2x.webp") !important;`), `${id} surface rule`);
    assert.ok(css.includes(`.planet-stage[data-object-id="triton"][data-lens="${id}"] .polycss-scene s.triton-polar {\n  background-image: url("/scenes/triton/triton-poles-${id}@2x.webp") !important;`), `${id} poles rule`);
  }
});
