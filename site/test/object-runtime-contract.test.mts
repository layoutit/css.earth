import { parsePreparedObjectRuntime } from "@cssearth/renderer";
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';
import assert from "node:assert/strict";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
const moonDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon'));
const objectControls = moonDefinition.controls;
import { initialObjectSelection, reduceObjectSelection, requireObjectAction } from '@cssearth/renderer/testing';
import { requireObjectRuntimeDefinition } from "@cssearth/bake/contract";

function definition(overrides: Record<string, unknown> = {}) {
  return { ...moonDefinition, assets: structuredClone(moonDefinition.assets), ...overrides };
}

test("validates actions against the real controls of fixed bodies", async () => {
  // The action code is the same for every object; each object's controls are checked when it is prepared.
  for (const id of ["earth", "moon", "saturn"]) {
    const {controls} = parsePreparedObjectRuntime(await loadObjectTestDefinition(id));
    for (const dataset of controls.datasets?.controls ?? []) {
      const action = requireObjectAction(controls, { kind: "dataset", id: dataset.id });
      assert.equal(action.kind, "dataset");
      assert.ok(action.kind === "dataset");
      assert.equal(action.id, dataset.id);
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
  assert.throws(() => requireObjectRuntimeDefinition(definition({ initialSelection: { datasetId: "topography", speed: 1 } })), /unsupported/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ schema: "cssearth-object-runtime@1" })), /data-only/);
  assert.throws(() => requireObjectRuntimeDefinition(definition({ controls: { datasets: { controls: [{ id: "a" }, { id: "a" }] }, settings: null } })), /IDs/);
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
  const next = reduceObjectSelection(initial, requireObjectAction(objectControls, { kind: "dataset", id: "topography" }));
  assert.equal(initial.datasetId, "surface"); assert.equal(next.datasetId, "topography");
  assert.equal(Object.isFrozen(next), true);
  assert.throws(() => requireObjectAction(objectControls, { kind: "cycle", name: "speed", value: 9 }), /Unknown/);
});
