// Draft replacement for the retired terrestrial-lane unit tests of Umbriel
// (modelled on tests/objects/unit/pluto/runtime-contract.test.mts). Decoder-level tests that only read the
// source files and tools/objects/terrestrial-layers decoders stay valid and are kept beside this file.
import { requireRecord } from '../../../../tools/sources/source-values.mts';
import { required } from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import runtimeDefinition from "../../../../src/objects/umbriel/prepared/runtime.json" with { type: "json" };
import assets from "../../../../src/objects/umbriel/prepared/assets.json" with { type: "json" };
import scene from "../../../../src/objects/umbriel/prepared/scene.json" with { type: "json" };
import lenses from "../../../../src/objects/umbriel/prepared/lenses.json" with { type: "json" };
import text from "../../../../src/objects/umbriel/prepared/text.json" with { type: "json" };
import controls from "../../../../src/objects/umbriel/prepared/controls.json" with { type: "json" };
import { objectRuntimePackageTests, preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { SCENE_OBJECTS } from "../../../../site/objects.mts";
import { auditObjectRuntimeOwnership } from "../../../../tools/ci/check-object-runtime-ownership.mts";

const LENS_IDS = ["normal","voyager-color"];

objectRuntimePackageTests(runtimeDefinition);

test("Umbriel's actual import closure has only shared runtime owners", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: SCENE_OBJECTS.filter(object => object.id === "umbriel") });
  assert.equal(audit.complete, true);
  for (const name of ["runtime/object-runtime", "rendering/prepared-residency", "rendering/object-selection-runtime", "rendering/object-control-binding", "rendering/prepared-playback", "solar-system/cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/renderers/css/${name}.ts`));
  }
});

test("Umbriel is prepared by the generic raster lane with the source-radius sphere, the Lambert lighting bank and its 1 lens", () => {
  assert.equal(scene.schema, "cssumbriel-prepared-runtime-scene@1");
  assert.equal(scene.runtimeGeometry, false);
  assert.equal(scene.runtimeRasterization, false);
  assert.equal(scene.body.equatorialRadius, 230);
  assert.equal(scene.body.polarRadius, 230);
  assert.deepEqual([scene.body.latitudeSegments, scene.body.longitudeSegments], [16, 32]);
  assert.equal(scene.body.leaves.length, 450, "448 band leaves plus two polar caps: the mesh the retired lane already used");
  assert.equal(scene.body.sourceMapSize[0], 2048);
  // No atmosphere: the material is the row-sharded Lambert bank, not the atmosphere phase atlas.
  assert.equal(scene.material.runtimeLighting, false);
  assert.equal(scene.material.frameCount, 256);
  assert.equal(Object.hasOwn(assets, "atmosphere"), false);
  assert.equal(assets.lighting.frameCount, 256);
  assert.deepEqual(Object.keys(assets.surfaces), LENS_IDS);
  assert.deepEqual(lenses.controls.map(({ id }) => id), LENS_IDS);
  assert.equal(lenses.defaultLens, "normal");
  assert.deepEqual(controls.settings.controls.map(control => control.name), ["shadows"]);
  // The composite material is a separate silhouette-fitted root, never a plane inside the scene.
  assert.ok(runtimeDefinition.tree.nodes.some(node => node.className?.includes("umbriel-material-composite")));
  assert.ok(runtimeDefinition.viewBindings.some(binding => binding.kind === "silhouette-fit"));
});

test("Umbriel lenses keep their prepared legends and false-colour declarations", () => {
  const byId = new Map(controls.lenses.controls.map(control => [control.id, control]));
  for (const control of lenses.controls) {
    const shell = requireRecord(required(byId.get(control.id)));
    const legend = shell.legend === undefined ? undefined : requireRecord(shell.legend);
    assert.equal(typeof requireRecord(required(requireRecord(text.datasets)[control.id])).summary, "string");
    if (legend?.kind === "scale") assert.ok(Array.isArray(legend.colors) && legend.colors.length >= 2 && Array.isArray(legend.labels) && legend.labels.length >= 2);
    if (legend?.kind === "categories") assert.ok(Array.isArray(legend.items) && legend.items.length >= 2);
  }
});

test("Umbriel publishes every declared toggle through the shared controls and selection owner", async () => {
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
    assert.equal(f.inputs.get("stars"), undefined, "the shared universe owns the sky");
    assert.equal(f.inputs.get("orbit"), undefined, "the retired lane's orbit toggle is gone");
    assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    assert.deepEqual(f.errors, []); f.lifetime.destroy(); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Umbriel lens selection keeps the retained tree and switches only the surface textures", async () => {
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
