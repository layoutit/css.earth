// Draft replacement for the static-lane Pluto unit tests (preparation.test.mts, runtime-contract.test.mts,
// scientific.test.mts / source.test.mts, surface-raster.test.mts, missing-coverage.test.mts retire with the lane).
// Modelled on tests/objects/unit/venus/runtime-contract.test.mts and the Mars generic-lane draft.
import { required } from '../../../../tools/test-values.mts';
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
import { auditObjectRuntimeOwnership } from "../../../../tools/check-object-runtime-ownership.mts";

const LENS_IDS = ['surface', 'topography', 'monochrome', 'methane-ice', 'nitrogen-ice', 'water-ice'];

objectRuntimePackageTests(runtimeDefinition);

test("Pluto's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "pluto") });
  assert.equal(audit.complete, true);
  for (const name of ["runtime/object-runtime", "rendering/prepared-residency", "rendering/object-selection-runtime", "rendering/object-control-binding", "rendering/prepared-playback", "solar-system/cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/renderers/css/${name}.ts`));
  }
});

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

test("Pluto science lenses keep their prepared legends and false-colour declarations", () => {
  const byId = new Map(controls.lenses.controls.map(control => [control.id, control]));
  for (const control of lenses.controls) {
    const shell = required(byId.get(control.id));
    assert.equal(typeof Object.getOwnPropertyDescriptor(text.datasets, control.id)?.value?.summary, "string");
    // The enhanced-colour surface is a three-filter composite, false colour without a scale; science lenses carry one.
    if (control.falseColor && control.id !== "surface") assert.ok(shell.legend, `${control.id} declares a false-colour scale without a legend`);
    if (shell.legend?.kind === "scale") assert.ok((shell.legend.colors?.length ?? 0) >= 2 && (shell.legend.labels?.length ?? 0) >= 2);
  }
});

test("Pluto publishes every declared toggle through the shared controls and selection owner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const name of ["shadows"]) {
      const input = required(f.inputs.get(name));
      input.checked = !input.checked;
      const listener = required(input.listeners.get("change"));
      if (typeof listener === "function") listener(new Event("change")); else listener.handleEvent(new Event("change"));
      await f.settle();
      assert.equal(required(f.selection.state().committed)[name], input.checked);
      assert.equal(f.presentation.observe().materials.lighting.rotationEnabled, input.checked);
    }
    assert.equal(f.inputs.get("atmosphere"), undefined, "an airless body declares no atmosphere toggle");
    assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    assert.deepEqual(f.errors, []); f.lifetime.destroy(); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Pluto lens selection keeps the retained tree and switches only the surface textures", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const records = f.stage.querySelectorAll("*");
    for (const id of [...LENS_IDS.slice(1), LENS_IDS[0]]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(required(f.selection.state().committed).lensId, id);
      assert.deepEqual(f.stage.querySelectorAll("*"), records);
      assert.equal(f.stage.dataset.lens, id);
    }
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});
