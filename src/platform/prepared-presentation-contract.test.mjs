import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mts";
import { PREPARED_PRESENTATION_SCHEMA, PREPARED_OBJECT_RUNTIME_SCHEMA, requirePreparedData, requirePreparedPresentation } from "./prepared-presentation-contract.mts";
import { requireObjectRuntimeDefinition } from "../../tools/object-runtime-contract.mts";

export function presentationFixture(definition) {
  const { camera, sky, sun, assets, controls } = definition;
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera, sky, sun, assets,
    tree: { camera: 0, scene: 1, properties: [], nodes: [
      { parent: -1, tag: "div", className: "polycss-camera", style: "perspective:1000000px", properties: [], attributes: {} },
      { parent: 0, tag: "div", className: "polycss-scene", style: "", properties: [], attributes: {} },
      { parent: 1, tag: "div", className: "polycss-mesh", style: "", properties: [], attributes: {} },
      { parent: 1, tag: "s", className: "", style: "", properties: [], attributes: {} },
    ],  stageClasses: [] },
    variants: (controls.lenses?.controls ?? [{ id: null }]).map(lens => ({ when: controls.lenses ? { lensId: lens.id } : {}, required: [], writes: [], materials: [] })),
    materials: [], viewBindings: [], animations: [] };
}
const moon = await loadObjectTestDefinition('moon');
const fixture = () => structuredClone(presentationFixture(moon));

test("v2 binds every registered object's actual control, camera, sky and resource contracts", async () => {
  for (const object of OBJECTS) {
    const runtimeDefinition = await loadObjectTestDefinition(object.id);
    const plan = presentationFixture(runtimeDefinition);
    requirePreparedPresentation(plan, { controls: runtimeDefinition.controls });
    requireObjectRuntimeDefinition({ ...plan, schema: PREPARED_OBJECT_RUNTIME_SCHEMA, id: object.id, controls: runtimeDefinition.controls });
  }
});
test("prepared data rejects callbacks, getters, nonfinite values and cycles without executing them", () => {
  for (const value of [() => {}, { callback() {} }, { value: NaN }, { value: undefined }, new Map()]) assert.throws(() => requirePreparedData(value), /JSON/);
  let calls = 0; const getter = { get value() { calls++; return 1; } };
  assert.throws(() => requirePreparedData(getter), /executable/); assert.equal(calls, 0);
  const cycle = {}; cycle.self = cycle; assert.throws(() => requirePreparedData(cycle), /JSON/);
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
  const mutations = [
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
  const {id,controls:objectControls,...runtime}=await loadObjectTestDefinition('uranus');
  const PREPARED_PRESENTATION={...runtime,schema:PREPARED_PRESENTATION_SCHEMA};
  requirePreparedPresentation(PREPARED_PRESENTATION, { controls: objectControls });
  for (const change of [
    plan => { plan.materials[0].frame.thresholds[1] = -2; },
    plan => { plan.materials[0].frame.thresholds[1] = plan.materials[0].frame.thresholds[0]; },
    plan => { plan.materials[0].frame.indices.pop(); },
    plan => { plan.materials[0].frame.indices[0] = 999999; },
    plan => { plan.materials[0].frame.lightBasis = [1,0,0,0,1,0,0,0,1]; },
    plan => { plan.materials[0].banks[0].frames[0].prewarm = ["undeclared"]; },
    plan => { plan.materials[0].demand = { mode: "neighborhood" }; },
    plan => { plan.materials[0].frame.source = "scene-pitch"; },
  ]) {
    const plan = structuredClone(PREPARED_PRESENTATION); change(plan);
    assert.throws(() => requirePreparedPresentation(plan, { controls: objectControls }));
  }
});

test("ellipsoid material rotation requires its immutable prepared system transform", async () => {
  const { id, controls, ...runtime } = await loadObjectTestDefinition('jupiter');
  const plan = { ...runtime, schema: PREPARED_PRESENTATION_SCHEMA };
  requirePreparedPresentation(plan, { controls });
  const rotation = plan.materials.find(track => track.rotation?.kind === 'ellipsoid')?.rotation;
  assert.ok(rotation, 'The actual Jupiter material uses ellipsoid rotation');
  delete rotation.systemTransform;
  assert.throws(() => requirePreparedPresentation(plan, { controls }), /ellipsoid system transform/);
});

for (const target of ["camera", "scene"]) test(`an existing prepared native animation cannot target the ${target}`, async () => {
  const { default: mercury } = await import("../../src/planets/mercury/prepared/runtime.json", {with: {type: "json"}});
  const definition = structuredClone(mercury);
  requireObjectRuntimeDefinition(definition);
  const animation = definition.animations.find(entry => entry.id === "mercury-interior-presentation-orbit");
  assert.ok(animation, "Use Mercury's actual prepared native transform animation");
  animation.target = definition.tree[target];
  assert.throws(() => requireObjectRuntimeDefinition(definition), /animation.*(?:camera|scene)/i);
});
