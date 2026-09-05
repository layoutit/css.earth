import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mjs";
import { PREPARED_PRESENTATION_SCHEMA, PREPARED_OBJECT_RUNTIME_SCHEMA, requirePreparedData, requirePreparedPresentation } from "./prepared-presentation-contract.mjs";
import { requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";

export function presentationFixture(definition) {
  const { camera, sky, sun, inputSelector, assets, controls } = definition;
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera, sky, sun, inputSelector, assets,
    tree: { camera: 0, scene: 1, nodes: [
      { parent: -1, tag: "div", className: "polycss-camera", style: "perspective:1000000px", properties: [], attributes: {} },
      { parent: 0, tag: "div", className: "polycss-scene", style: "", properties: [], attributes: {} },
      { parent: 1, tag: "div", className: "polycss-mesh", style: "", properties: [], attributes: {} },
      { parent: 1, tag: "s", className: "", style: "", properties: [], attributes: {} },
    ], registrations: [{ bodySystem: 2, lightingOverlays: [3] }], stageClasses: [] },
    variants: controls.lenses.controls.map(lens => ({ when: { lensId: lens.id }, required: [], writes: [], materials: [] })),
    materials: [], viewBindings: [], animations: [], observations: { constants: {}, materials: [], counts: [] } };
}
const { runtimeDefinition: moon } = await import("../planets/moon/runtime/definition.mjs");
const fixture = () => structuredClone(presentationFixture(moon));

test("v2 binds the actual eleven control, camera, sky and resource contracts", async () => {
  for (const object of OBJECTS) {
    const { runtimeDefinition } = await import(`../planets/${object.id}/runtime/definition.mjs`);
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
    plan => { plan.tree.registrations[0].lightingOverlays = [99]; },
    plan => { plan.variants[0].required = ["missing"]; },
    plan => { plan.variants[0].writes = [{ kind: "style", target: 0, name: "transform", value: "none" }]; },
    plan => { plan.viewBindings = [{ kind: "counter-rotation", target: 1, systemTransform: null }]; },
    plan => { plan.viewBindings = [{ kind: "evaluate", target: 3, property: "transform" }]; },
    plan => { plan.tree.nodes[3].style = "filter:blur(2px)"; },
    plan => { plan.tree.nodes[3].attributes.onclick = "alert(1)"; },
  ];
  for (const mutate of mutations) { const plan = fixture(); mutate(plan); assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls })); }
});

test("finite material tables cover frame sources, row policies, remaps and bindings", () => {
  const plan = fixture();
  const address = { resource: "curvature", frame: 0, row: 0, backgroundPosition: "0px 0px", backgroundSize: "1024px 1024px" };
  const track = { id: "lighting", target: 3, frame: { source: "sun-z", minimum: -1, maximum: 1, count: 1, baseFrame: 0, remap: null }, defaultPose: [],
    banks: [{ id: "normal", frames: [address], default: address, fixed: address }],
    demand: { mode: "current", prewarm: "none", capacity: 3, framesPerRow: 16, defaultFrame: 0, initialRows: [0], holdHiddenNeighborhood: false, fallback: "hold" },
    rotation: null, frameAttribute: null, modeAttribute: null, quoted: true };
  plan.materials = [track];
  for (const variant of plan.variants) variant.materials = [{ track: "lighting", bank: "normal", mode: "frames", enabled: true, rotationEnabled: true, frameOverride: null, clearWhenHidden: false, fixedMode: "shadowless" }];
  for (const source of ["sun-z", "prepared-light-z", "scene-pitch", "reference-sun-z"]) {
    track.frame.source = source;
    for (const mode of ["current", "directional", "visible-directional", "away-enabled-or-lens-change", "neighborhood"]) {
      track.demand.mode = mode;
      for (const fallback of ["hold", "same-column", "nearest-frame"]) {
        track.demand.fallback = fallback; requirePreparedPresentation(plan, { controls: moon.controls });
      }
    }
  }
  track.frame.remap = { kind: "phase-plateau", lowerTransition: [-0.8, -0.4], plateau: [-0.4, 0.2], upperTransition: [0.2, 0.6], plateauViewZ: 0.2 };
  requirePreparedPresentation(plan, { controls: moon.controls });
  track.frame.remap.kind = "expression"; assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls }), /remap/);
  track.frame.remap = null; track.banks[0].frames = [];
  assert.throws(() => requirePreparedPresentation(plan, { controls: moon.controls }), /every material frame/);
});
