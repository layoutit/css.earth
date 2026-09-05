import { bodyLayerFixture } from "./test/body-layer-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mjs";
import { objectControls } from "../planets/moon/site/control-content.mjs";
import { PREPARED_MOON_SCENE } from "../planets/moon/runtime/preparedScene.mjs";
import { PREPARED_MOON_STARFIELD } from "../planets/moon/runtime/preparedStarfield.mjs";
import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, invokeRuntimeHook,
  reduceObjectSelection, requireObjectAction, requireObjectPresentation,
  requireObjectRuntimeDefinition, requireObjectSelection, requireResolvedPresentation } from "./object-runtime-contract.mjs";

function definition(overrides = {}) {
  return { schema: OBJECT_RUNTIME_SCHEMA, id: "moon", controls: objectControls,
    camera: PREPARED_MOON_SCENE.camera, sky: PREPARED_MOON_STARFIELD,
    assets: { entries: [{ key: "surface", url: PREPARED_MOON_SCENE.body.assets.surface.two, pool: "surface" }],
      pools: [{ id: "surface", capacity: 2, concurrency: 2, reuse: false, retention: "selection" }], startup: ["surface"] },
    initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
    resolvePresentation() { return { required: ["surface"], prewarm: [] }; },
    createPresentation() {}, ...overrides };
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
  assert.throws(() => requireObjectRuntimeDefinition(definition({ start() {} })), /unsupported/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ initialSelection: { lensId: "topography", speed: 1 } })), /default/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ controls: { lenses: { controls: [{ id: "a" }, { id: "a" }] }, settings: null } })), /IDs/);
});

test("rejects invalid pool capacity, unknown startup keys and undeclared resolved resources", () => {
  const value = definition();
  value.assets.pools[0].concurrency = 3;
  assert.throws(() => requireObjectRuntimeDefinition(value), /pool/);
  const missing = definition(); missing.assets.startup = ["absent"];
  assert.throws(() => requireObjectRuntimeDefinition(missing), /undeclared/);
  assert.throws(() => requireResolvedPresentation({ required: ["absent"] }, definition()), /undeclared/);
  assert.throws(() => requireResolvedPresentation({ required: ["surface"], prewarm: ["absent"] }, definition()), /undeclared/);
  assert.throws(() => requireResolvedPresentation({ required: [], pressedLenses: ["absent"] }, definition()), /undeclared/);
});

for (const name of ["reduceSelection", "resolvePresentation", "createPresentation"]) {
  test(`${name} cannot be an async hook or return a promise from an ordinary function`, async () => {
    assert.throws(() => requireObjectRuntimeDefinition(definition({ [name]: async () => ({}) })), /synchronous/);
    const value = definition({ [name]() { return Promise.reject(new Error("late rejection")); } });
    requireObjectRuntimeDefinition(value);
    assert.throws(() => invokeRuntimeHook(value, name, []), /thenable/);
    await new Promise(resolve => setImmediate(resolve));
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
