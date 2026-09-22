// Draft replacement for the static-lane Pluto unit tests (preparation.test.mts, runtime-contract.test.mts,
// scientific.test.mts / source.test.mts, surface-raster.test.mts, missing-coverage.test.mts retire with the lane).
// Modelled on tests/objects/unit/venus/runtime-contract.test.mts and the Mars generic-lane draft.
import { required } from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import runtimeDefinition from "../../../../src/objects/pluto/prepared/runtime.json" with { type: "json" };
import text from "../../../../src/objects/pluto/prepared/text.json" with { type: "json" };
import assets from "../../../../src/objects/pluto/prepared/assets.json" with { type: "json" };
import scene from "../../../../src/objects/pluto/prepared/scene.json" with { type: "json" };
import lenses from "../../../../src/objects/pluto/prepared/lenses.json" with { type: "json" };
import controls from "../../../../src/objects/pluto/prepared/controls.json" with { type: "json" };
import { objectRuntimePackageTests, preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";

const LENS_IDS = ['surface', 'topography', 'monochrome', 'methane-ice', 'nitrogen-ice', 'water-ice'];

test("Pluto keeps its source-radius sphere and Lambert bank across photographic, elevation and ice views", () => {
  assert.equal(scene.schema, "csspluto-prepared-runtime-scene@1");
  assert.equal(scene.runtimeGeometry, false);
  assert.equal(scene.runtimeRasterization, false);
  assert.equal(scene.body.equatorialRadius, 230);
  assert.equal(scene.body.polarRadius, 230);
  assert.deepEqual([scene.body.latitudeSegments, scene.body.longitudeSegments], [16, 32]);
  assert.equal(scene.body.axialTiltDegrees, 119.51);
  // No atmosphere: the material is the row-sharded Lambert bank, not the atmosphere phase atlas.
  assert.equal(scene.material.runtimeLighting, false);
  assert.equal(scene.material.frameCount, 256);
  assert.equal('atmosphere' in assets, false);
  assert.equal(assets.lighting.frameCount, 256);
  assert.deepEqual(Object.keys(assets.surfaces), LENS_IDS);
  assert.deepEqual(lenses.controls.map(({ id }) => id), LENS_IDS);
  assert.equal(lenses.defaultLens, "surface");
  assert.deepEqual(controls.settings.controls.map(control => control.name), ["speed", "shadows"]);
  // The composite material is a separate silhouette-fitted root, never a plane inside the scene.
  assert.ok(runtimeDefinition.tree.nodes.some(node => node.className?.includes("pluto-material-composite")));
  assert.ok(runtimeDefinition.viewBindings.some(binding => binding.kind === "silhouette-fit"));
});
