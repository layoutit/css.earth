import assert from "node:assert/strict";
import { test } from "node:test";
import runtimeDefinition from "../../../../src/planets/ceres/prepared/runtime.json" with {type:"json"};
import { requirePreparedPresentation } from "../../../../src/platform/prepared-presentation-contract.mjs";
import { preparePlanetarySystem } from "../../../../src/platform/prepare-planetary-system.mjs";
import { prepareEclipticPresentationFrame } from "../../../../src/platform/solar-presentation-frame.mjs";
import { prepareHeliocentricView } from "../../../../src/platform/prepare-heliocentric-view.mjs";
const { id: _id, controls: _controls, ...presentation } = runtimeDefinition;
const PREPARED_PRESENTATION = {...presentation, schema:"cssearth-prepared-presentation@3"};

test("Ceres supplies the existing shared runtime contract", () => {
  requirePreparedPresentation(PREPARED_PRESENTATION, { controls: runtimeDefinition.controls });
  assert.equal(runtimeDefinition.id, "ceres");
  assert.equal(runtimeDefinition.heliocentricView.plan.bodyId, "ceres");
  assert.equal(runtimeDefinition.tree.nodes.filter(n => n.className?.includes("polycss-camera")).length, 1);
});

for (const [id, radius] of [["ceres", 469.7], ["pluto", 1188.3]]) {
  test(`${id} can be an observer without duplicating itself in the system`, async () => {
    const frame = prepareEclipticPresentationFrame(id);
    const system = await preparePlanetarySystem({ bodyId: id, presentationFrame: frame, kilometersPerUnit: radius / 230 });
    assert.ok(system.bodies.every(body => body.id !== id));
    assert.equal(system.bodies.length, 12);
    assert.ok(system.bodies.every(body => body.position.every(Number.isFinite)));
    const view = prepareHeliocentricView({ bodyId: id, presentationFrame: frame, bodyRadiusUnits: 230,
      bodyRadiusKilometers: radius, sunSprite: { imagePixels: 512, opaqueCoreDiameterShare: 0.5 }, system });
    assert.deepEqual(view.orbit.vertices[0], [0, 0, 0]);
  });
}
