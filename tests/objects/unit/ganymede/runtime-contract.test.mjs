import assert from "node:assert/strict";
import { test } from "node:test";
import runtimeDefinition from "../../../../src/planets/ganymede/prepared/runtime.json" with {type:"json"};
const {id: objectId, controls, ...presentation} = runtimeDefinition;
const PREPARED_PRESENTATION = {...presentation, schema:PREPARED_PRESENTATION_SCHEMA};
import { requirePreparedPresentation, PREPARED_PRESENTATION_SCHEMA } from "../../../../src/platform/prepared-presentation-contract.mts";
import { preparePlanetarySystem } from "../../../../src/platform/prepare-planetary-system.mts";
import { prepareEclipticPresentationFrame } from "../../../../src/platform/solar-presentation-frame.mts";
import { prepareHeliocentricView } from "../../../../src/platform/prepare-heliocentric-view.mts";
import { ASTRONOMICAL_UNIT_KILOMETERS } from "../../../../src/platform/solar-geometry.mts";

test("Ganymede mounts through the shared prepared object contract", () => {
  requirePreparedPresentation(PREPARED_PRESENTATION, { controls: runtimeDefinition.controls });
  assert.equal(runtimeDefinition.id, "ganymede");
  assert.equal(runtimeDefinition.tree.nodes.filter(node => node.className?.includes("polycss-camera")).length, 1);
  assert.deepEqual(runtimeDefinition.controls.lenses.controls.map(lens => lens.id), ["normal", "enhanced", "geology"]);
  for (const variant of PREPARED_PRESENTATION.variants) {
    const lighting = variant.materials.find(material => material.track === "lighting");
    assert.equal(lighting.enabled, true, "Every lens retains the shared lighting control");
    assert.equal(lighting.mode, variant.when.shadows ? "frames" : "fixed");
  }
});

// Two different parent systems exercise the same preparation path. Distances
// are independent, deliberately broad observational bounds (NASA fact sheets).
for (const [id, parent, radius, distanceKm] of [
  ["ganymede", "jupiter", 2631.2, 1070000], ["moon", "earth", 1737.4, 384400],
]) {
  test(`${id}'s orbit surrounds ${parent}, while the Sun keeps its separate position`, async () => {
    const frame = prepareEclipticPresentationFrame(id), kmPerUnit = radius / 230;
    const system = await preparePlanetarySystem({ bodyId: id, presentationFrame: frame, kilometersPerUnit: kmPerUnit });
    const view = prepareHeliocentricView({ bodyId: id, presentationFrame: frame,
      bodyRadiusUnits: 230, bodyRadiusKilometers: radius,
      sunSprite: { imagePixels: 512, opaqueCoreDiameterShare: 0.5 }, system });
    const position = system.bodies.find(body => body.id === parent).position;
    assert.equal(view.orbit.centerBodyId, parent);
    // System marker positions are rounded to whole scene units.
    assert.ok(Math.hypot(...view.orbit.focus.map((value, i) => value - position[i])) <= Math.sqrt(3) / 2);
    assert.ok(Math.abs(Math.hypot(...position) * kmPerUnit / distanceKm - 1) < 0.08);
    assert.ok(Math.abs(view.orbit.semiMajorAxisAu * ASTRONOMICAL_UNIT_KILOMETERS / distanceKm - 1) < 0.02);
    assert.deepEqual(view.orbit.vertices[0], [0, 0, 0]);
    for (const vertex of view.orbit.vertices) {
      const distance = Math.hypot(...vertex.map((value, i) => value - position[i])) * kmPerUnit;
      assert.ok(distance > distanceKm * 0.85 && distance < distanceKm * 1.15);
    }
    assert.ok(view.sun.distanceAu > (id === "ganymede" ? 4.8 : 0.95));
    assert.equal(system.bodies.length, 13);
    assert.ok(system.bodies.every(body => body.id !== id));
  });
}
