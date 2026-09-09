import assert from "node:assert/strict";
import { test } from "node:test";
import runtimeDefinition from "../../../../src/planets/callisto/prepared/runtime.json" with {type:"json"};
const {id: objectId, controls, ...presentation} = runtimeDefinition;
const PREPARED_PRESENTATION = {...presentation, schema:PREPARED_PRESENTATION_SCHEMA};
import { requirePreparedPresentation, PREPARED_PRESENTATION_SCHEMA } from "../../../../src/platform/prepared-presentation-contract.mjs";
import { ASTRONOMICAL_UNIT_KILOMETERS } from "../../../../src/platform/solar-geometry.mjs";

test("Callisto uses one shared scene, two sourced lenses and shared shadows", () => {
  requirePreparedPresentation(PREPARED_PRESENTATION, {controls:runtimeDefinition.controls});
  assert.equal(runtimeDefinition.id,"callisto");
  assert.equal(runtimeDefinition.tree.nodes.filter(node => node.className?.includes("polycss-camera")).length,1);
  assert.deepEqual(runtimeDefinition.controls.lenses.controls.map(lens => lens.id),["normal","enhanced"]);
  for (const variant of runtimeDefinition.variants) {
    const lighting = variant.materials.find(material => material.track === "lighting");
    assert.equal(lighting.enabled,true);
    assert.equal(lighting.mode,variant.when.shadows ? "frames" : "fixed");
  }
});

test("Callisto's prepared orbit surrounds Jupiter at its physical distance", () => {
  const view = runtimeDefinition.heliocentricView.plan;
  const parent = view.system.bodies.find(body => body.id === "jupiter");
  assert.equal(view.orbit.centerBodyId,"jupiter");
  assert.ok(Math.abs(view.orbit.semiMajorAxisAu * ASTRONOMICAL_UNIT_KILOMETERS / 1883000 - 1) < .02);
  assert.ok(Math.hypot(...view.orbit.focus.map((value,i) => value - parent.position[i])) <= Math.sqrt(3)/2);
  assert.ok(view.sun.distanceAu > 4.8);
  assert.ok(view.system.bodies.every(body => body.id !== "callisto"));
  const parentResource = runtimeDefinition.assets.entries.find(entry => entry.key === "parent-marker");
  assert.equal(parentResource.url,"/scenes/callisto/callisto-parent-jupiter.webp");
});
