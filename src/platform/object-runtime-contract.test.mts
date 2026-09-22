import { parsePreparedObjectRuntime } from "../renderers/css/dist/index.js";
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS } from "../../site/objects.mts";
const moonDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon'));
const objectControls = moonDefinition.controls;
import { initialObjectSelection, reduceObjectSelection, requireObjectAction } from '../renderers/css/dist/testing.js';
import { requireObjectRuntimeDefinition } from "../../tools/contract/object-runtime-contract.mts";

function definition(overrides: Record<string, unknown> = {}) {
  return { ...moonDefinition, assets: structuredClone(moonDefinition.assets), ...overrides };
}

test("validates actions against real controls for every existing object", async () => {
  for (const object of SCENE_OBJECTS) {
    const {controls} = parsePreparedObjectRuntime(await loadObjectTestDefinition(object.id));
    for (const lens of controls.lenses?.controls ?? []) {
      const action = requireObjectAction(controls, { kind: "lens", id: lens.id });
      assert.equal(action.kind, "lens");
      assert.ok(action.kind === "lens");
      assert.equal(action.id, lens.id);
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

test("rejects invalid pool capacity, unknown startup keys", () => {
  const value = definition();
  value.assets.pools[0].concurrency = value.assets.pools[0].capacity + 1;
  assert.throws(() => requireObjectRuntimeDefinition(value), /pool/);
  const missing = definition(); missing.assets.startup = ["absent"];
  assert.throws(() => requireObjectRuntimeDefinition(missing), /undeclared/);
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

test("reducers produce immutable scalar selections without mutating the committed state", () => {
  const initial = initialObjectSelection(objectControls);
  const next = reduceObjectSelection(initial, requireObjectAction(objectControls, { kind: "lens", id: "topography" }));
  assert.equal(initial.lensId, "surface"); assert.equal(next.lensId, "topography");
  assert.equal(Object.isFrozen(next), true);
  assert.throws(() => requireObjectAction(objectControls, { kind: "cycle", name: "speed", value: 9 }), /Unknown/);
});
