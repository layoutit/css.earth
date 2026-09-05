import { bodyLayerFixture } from "./test/body-layer-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mjs";
import { objectControls } from "../planets/moon/site/control-content.mjs";
import { runtimeDefinition as moonDefinition } from "../planets/moon/runtime/definition.mjs";
import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, invokeRuntimeHook,
  reduceObjectSelection, requireObjectAction, requireObjectPresentation,
  requireObjectRuntimeDefinition, requireObjectSelection, requireResolvedPresentation } from "./object-runtime-contract.mjs";

function definition(overrides = {}) {
  return { ...moonDefinition, assets: structuredClone(moonDefinition.assets), ...overrides };
}
function presentation(overrides = {}) {
  const { cameraElement, sceneElement, bodyLayers } = bodyLayerFixture();
  return { cameraElement, sceneElement, bodyLayers, commitSelection() {}, publishFrame() {}, ...overrides };
}

test("validates real package controls and initial state for every existing object", async () => {
  for (const object of OBJECTS) {
    const { objectControls: controls } = await import(`../planets/${object.id}/site/control-content.mjs`);
    const selected = initialObjectSelection(controls);
    assert.deepEqual(requireObjectSelection(selected, controls), selected);
    for (const lens of controls.lenses?.controls ?? []) {
      assert.equal(requireObjectAction(controls, { kind: "lens", id: lens.id }).id, lens.id);
    }
    assert.throws(() => requireObjectAction(controls, { kind: "toggle", name: "undeclared", value: true }), /Unknown/);
  }
});

test("identity and content must match the mounted registry object", () => {
  const value = definition();
  assert.equal(requireObjectRuntimeDefinition(value, { objectId: "moon", controls: objectControls }), value);
  assert.throws(() => requireObjectRuntimeDefinition(value, { objectId: "pluto" }), /identity/);
  assert.throws(() => requireObjectRuntimeDefinition(value, { controls: { ...objectControls } }), /actual control-content/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ start() {} })), /acyclic JSON|unsupported/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ initialSelection: { lensId: "topography", speed: 1 } })), /unsupported/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ schema: "cssearth-object-runtime@1" })), /data-only/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ controls: { lenses: { controls: [{ id: "a" }, { id: "a" }] }, settings: null } })), /IDs/);
});

test("rejects invalid pool capacity, unknown startup keys and undeclared resolved resources", () => {
  const value = definition();
  value.assets.pools[0].concurrency = value.assets.pools[0].capacity + 1;
  assert.throws(() => requireObjectRuntimeDefinition(value), /pool/);
  const missing = definition(); missing.assets.startup = ["absent"];
  assert.throws(() => requireObjectRuntimeDefinition(missing), /undeclared/);
  assert.throws(() => requireResolvedPresentation({ required: ["absent"] }, definition()), /undeclared/);
  assert.throws(() => requireResolvedPresentation({ required: [moonDefinition.assets.entries[0].key], prewarm: ["absent"] }, definition()), /undeclared/);
  assert.throws(() => requireResolvedPresentation({ required: [], pressedLenses: ["absent"] }, definition()), /undeclared/);
});

for (const name of ["reduceSelection", "resolvePresentation", "createPresentation"]) {
  test(`${name} is rejected before package code can execute`, () => {
    let invoked = false;
    for (const callback of [async () => { invoked = true; }, () => { invoked = true; return Promise.resolve(); }, () => { invoked = true; }]) {
      assert.throws(() => requireObjectRuntimeDefinition(definition({ [name]: callback })), /acyclic JSON|unsupported/);
    }
    assert.equal(invoked, false);
  });
}

for (const name of ["commitSelection", "publishFrame", "observe"]) {
  test(`${name} rejects hidden asynchronous publication`, async () => {
    assert.throws(() => requireObjectPresentation(presentation({ [name]: async () => {} })), /synchronous/);
    const binding = requireObjectPresentation(presentation({ [name]() { return { then(resolve, reject) { reject(new Error("late")); } }; } }));
    assert.throws(() => invokeRuntimeHook(binding, name, []), /thenable/);
    await new Promise(resolve => setImmediate(resolve));
  });
}

test("the common binding rejects private coordination APIs and nonretained roots", () => {
  for (const name of ["prepareLens", "setMaterialRows", "preparePresentation", "pause", "destroy"]) {
    assert.throws(() => requireObjectPresentation(presentation({ [name]() {} })), /unsupported/);
  }
  assert.throws(() => requireObjectPresentation(presentation({ cameraElement: {} })), /retained element/);
});

test("reducers produce immutable scalar selections without mutating the committed state", () => {
  const initial = initialObjectSelection(objectControls);
  const next = reduceObjectSelection(initial, requireObjectAction(objectControls, { kind: "lens", id: "topography" }));
  assert.equal(initial.lensId, "surface"); assert.equal(next.lensId, "topography");
  assert.equal(Object.isFrozen(next), true);
  assert.throws(() => requireObjectSelection({ ...next, hiddenController: {} }, objectControls), /scalar/);
  assert.throws(() => requireObjectAction(objectControls, { kind: "cycle", name: "speed", value: 9 }), /Unknown/);
});
