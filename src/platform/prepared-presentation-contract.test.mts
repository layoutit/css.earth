import { parsePreparedObjectRuntime, type ObjectRuntimeDefinition } from "@cssearth/renderer";
import { requireRecord, requireArray } from "@cssearth/core";
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS as OBJECTS } from "../../site/objects.mts";
import { PREPARED_PRESENTATION_SCHEMA, PREPARED_OBJECT_RUNTIME_SCHEMA, requirePreparedData, requirePreparedPresentation } from "./prepared-presentation-contract.mts";
import { requireObjectRuntimeDefinition } from "../../tools/contract/object-runtime-contract.mts";

type FixtureVariant = { when: Record<string, string | number | boolean | null>; required: string[]; writes: unknown[]; materials: unknown[] };
export function presentationFixture(definition: ObjectRuntimeDefinition) {
  const { camera, sky, sun, assets, controls } = definition;
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera, sky, sun, assets,
    tree: { camera: 0, scene: 1, properties: [], nodes: [
      { parent: -1, tag: "div", className: "polycss-camera", style: "perspective:1000000px", properties: [], attributes: {} as Record<string, string> },
      { parent: 0, tag: "div", className: "polycss-scene", style: "", properties: [], attributes: {} as Record<string, string> },
      { parent: 1, tag: "div", className: "polycss-mesh", style: "", properties: [], attributes: {} as Record<string, string> },
      { parent: 1, tag: "s", className: "", style: "", properties: [], attributes: {} as Record<string, string> },
    ],  stageClasses: [] },
    variants: (controls.lenses?.controls ?? [{ id: null }]).map((lens): FixtureVariant => ({ when: controls.lenses ? { lensId: lens.id } : {}, required: [], writes: [], materials: [] })),
    materials: [], viewBindings: new Array<unknown>(), animations: [] };
}
const moon = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon'));
const fixture = () => structuredClone(presentationFixture(moon));

test("v2 binds every registered object's actual control, camera, sky and resource contracts", async () => {
  for (const object of OBJECTS) {
    const runtimeDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition(object.id));
    const plan = presentationFixture(runtimeDefinition);
    requirePreparedPresentation(plan, { controls: runtimeDefinition.controls });
    requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: object.id, controls: runtimeDefinition.controls });
  }
});
test("prepared data rejects callbacks, getters, nonfinite values and cycles without executing them", () => {
  for (const value of [() => {}, { callback() {} }, { value: NaN }, { value: undefined }, new Map()]) assert.throws(() => requirePreparedData(value), /JSON/);
  let calls = 0; const getter = { get value() { calls++; return 1; } };
  assert.throws(() => requirePreparedData(getter), /executable/); assert.equal(calls, 0);
  const cycle: { self?: object } = {}; cycle.self = cycle; assert.throws(() => requirePreparedData(cycle), /JSON/);
});
test("selection is an exhaustive exclusive-lens table, never an independent interior flag", () => {
  const plan = fixture();
  plan.variants[0].when.interior = true;
  assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls }), /unsupported selection key/);
  delete plan.variants[0].when.interior; plan.variants.push(plan.variants[0]);
  assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls }), /exactly once/);
  plan.variants.pop(); plan.variants.pop();
  assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls }), /exactly once/);
});
test("unknown nodes, resources, camera writers and unsupported tree styles fail", () => {
  const mutations: ((plan: ReturnType<typeof fixture>) => void)[] = [
    plan => { plan.tree.nodes[2].parent = 3; },
    plan => { plan.tree.nodes[3].className = "polycss-camera"; },
    plan => { plan.variants[0].required = ["missing"]; },
    plan => { plan.variants[0].writes = [{ kind: "style", target: 0, name: "transform", value: "none" }]; },
    plan => { plan.viewBindings = [{ kind: "counter-rotation", target: 1, systemTransform: null }]; },
    plan => { plan.viewBindings = [{ kind: "evaluate", target: 3, property: "transform" }]; },
    plan => { plan.tree.nodes[3].style = "filter:blur(2px)"; },
    plan => { plan.tree.nodes[3].attributes.onclick = "alert(1)"; },
  ];
  for (const mutate of mutations) { const plan = fixture(); mutate(plan); assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls })); }
});

test("preparation rejects malformed phase tables and undeclared neighbors", async () => {
  const {id,controls:objectControls,...runtime}=parsePreparedObjectRuntime(await loadObjectTestDefinition('uranus'));
  const PREPARED_PRESENTATION={...runtime,schema:PREPARED_PRESENTATION_SCHEMA};
  requirePreparedPresentation(PREPARED_PRESENTATION, { controls: objectControls });
  // Mutate cloned JSON records deliberately, retaining runtime validation at the test boundary.
  const material = (plan: Record<string, unknown>) => requireRecord(requireArray(plan.materials)[0]);
  const frame = (plan: Record<string, unknown>) => requireRecord(material(plan).frame);
  const changes: ((plan: Record<string, unknown>) => void)[] = [
    plan => { requireArray(frame(plan).thresholds)[1] = -2; },
    plan => { const thresholds = requireArray(frame(plan).thresholds); thresholds[1] = thresholds[0]; },
    plan => { requireArray(frame(plan).indices).pop(); },
    plan => { requireArray(frame(plan).indices)[0] = 999999; },
    plan => { frame(plan).lightBasis = [1,0,0,0,1,0,0,0,1]; },
    plan => { const bank = requireRecord(requireArray(material(plan).banks)[0]); requireRecord(requireArray(bank.frames)[0]).prewarm = ["undeclared"]; },
    plan => { material(plan).demand = { mode: "neighborhood" }; },
    plan => { frame(plan).source = "scene-pitch"; },
  ];
  for (const change of changes) {
    const plan = structuredClone(PREPARED_PRESENTATION); change(plan);
    assert.throws(() => requirePreparedPresentation(plan, { controls: objectControls }));
  }
});

test("ellipsoid material rotation requires its immutable prepared system transform", async () => {
  const { id, controls, ...runtime } = parsePreparedObjectRuntime(await loadObjectTestDefinition('jupiter'));
  const plan = { ...runtime, schema: PREPARED_PRESENTATION_SCHEMA };
  requirePreparedPresentation(plan, { controls });
  const rotation = plan.materials.find(track => track.rotation?.kind === 'ellipsoid')?.rotation;
  assert.ok(rotation, 'The actual Jupiter material uses ellipsoid rotation');
  Reflect.deleteProperty(rotation, "systemTransform");
  assert.throws(() => requirePreparedPresentation(plan, { controls }), /ellipsoid system transform/);
});

for (const target of ["camera", "scene"] as const) test(`an existing prepared native animation cannot target the ${target}`, async () => {
  const { default: mercury } = await import("../../src/objects/mercury/prepared/runtime.json", {with: {type: "json"}});
  const definition = structuredClone(mercury);
  requireObjectRuntimeDefinition(definition);
  const animation = definition.animations.find(entry => entry.id === "mercury-interior-presentation-orbit");
  assert.ok(animation, "Use Mercury's actual prepared native transform animation");
  animation.target = definition.tree[target];
  assert.throws(() => requireObjectRuntimeDefinition(definition), /animation.*(?:camera|scene)/i);
});
