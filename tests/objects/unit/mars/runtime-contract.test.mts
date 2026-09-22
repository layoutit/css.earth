// Draft replacement for the affine-lane Mars unit tests. Modelled on
// tests/objects/unit/venus/runtime-contract.test.mts and mercury/runtime-contract.test.mts.
import { required } from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import runtimeDefinition from "../../../../src/objects/mars/prepared/runtime.json" with { type: "json" };
import assets from "../../../../src/objects/mars/prepared/assets.json" with { type: "json" };
import scene from "../../../../src/objects/mars/prepared/scene.json" with { type: "json" };
import lenses from "../../../../src/objects/mars/prepared/lenses.json" with { type: "json" };
import { objectRuntimePackageTests, preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";

objectRuntimePackageTests(runtimeDefinition);

test("Mars's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "mars") });
  assert.equal(audit.complete, true);
  for (const name of ["runtime/object-runtime", "rendering/prepared-residency", "rendering/object-selection-runtime", "rendering/object-control-binding", "rendering/prepared-playback", "solar-system/cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/renderers/css/${name}.ts`));
  }
});

test("Mars is prepared by the generic raster lane with the source-radii ellipsoid and three lenses", () => {
  assert.equal(scene.schema, "cssmars-prepared-runtime-scene@1");
  assert.equal(scene.runtimeGeometry, false);
  assert.equal(scene.body.equatorialRadius, 230);
  assert.equal(scene.body.polarRadius, 228.646218);
  assert.deepEqual([scene.body.latitudeSegments, scene.body.longitudeSegments], [16, 32]);
  assert.equal(scene.body.axialTiltDegrees, 25.19);
  assert.equal(scene.material.model, "source-parameter-bound-light-terminator-and-atmosphere-phase-bank");
  assert.equal(scene.material.frameCount, 32);
  assert.deepEqual(Object.keys(assets.surfaces), ["normal", "elevation", "thermal"]);
  assert.deepEqual(lenses.controls.map(({ id }) => id), ["normal", "elevation", "thermal"]);
  assert.equal(lenses.defaultLens, "normal");
  // The composite material is a separate silhouette-fitted root, never a plane inside the scene.
  assert.ok(runtimeDefinition.tree.nodes.some(node => node.className?.includes("mars-material-composite")));
  assert.ok(runtimeDefinition.tree.nodes.every(node => !node.className?.includes("mars-material-plane")));
  assert.ok(runtimeDefinition.viewBindings.some(binding => binding.kind === "silhouette-fit"));
});

test("Mars publishes every declared toggle through the shared controls and selection owner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const name of ["atmosphere", "shadows"]) {
      const input = required(f.inputs.get(name));
      input.checked = !input.checked;
      const listener = required(input.listeners.get("change"));
      if (typeof listener === "function") listener(new Event("change")); else listener.handleEvent(new Event("change"));
      await f.settle();
      assert.equal(required(f.selection.state().committed)[name], input.checked);
      if (name !== "shadows") assert.equal(f.stage.classList.contains(`mars-hide-${name}`), !input.checked);
      else assert.equal(f.presentation.observe().materials.lighting.rotationEnabled, input.checked);
    }
    assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    assert.deepEqual(f.errors, []); f.lifetime.destroy(); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Mars lens selection keeps the retained tree and switches the observation material", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const records = f.stage.querySelectorAll("*");
    for (const id of ["elevation", "thermal", "normal"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(required(f.selection.state().committed).lensId, id);
      assert.deepEqual(f.stage.querySelectorAll("*"), records);
      assert.equal(f.stage.dataset.lens, id);
    }
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
