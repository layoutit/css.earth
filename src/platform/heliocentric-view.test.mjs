import assert from "node:assert/strict";
import test from "node:test";

import { orbitTrailWeights } from "./prepare-heliocentric-view.mjs";
import {
  validatePreparedHeliocentricView,
  projectHeliocentricView,
  validatePreparedPlanetarySystem,
} from "./heliocentric-view.mjs";
import { PREPARED_MERCURY_SCENE } from "../planets/mercury/runtime/preparedScene.mjs";

const plan = PREPARED_MERCURY_SCENE.heliocentricView;
const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
// Looking down the ecliptic pole: the whole (near-coplanar) system fills the
// view edge-on to none of its axes, so every body's orbit and marker land
// inside the frustum at a large enough distance.
const LOOKING_DOWN_THE_POLE = Object.freeze([1, 0, 0, 0, 0, -1, 0, 1, 0]);
const VIEWPORT = { viewportWidth: 1440, viewportHeight: 900 };
const FOCAL = 1247;

function project(options) {
  return projectHeliocentricView(plan, { focal: FOCAL, ...VIEWPORT, ...options });
}

test("omits the system projection unless asked for, then projects every body in plan order", () => {
  const withoutSystem = project({ rotation: IDENTITY, distance: 5 * plan.units.bodyRadiusUnits });
  assert.equal(withoutSystem.system, null);

  const distance = plan.system.maximumExtentUnits * 3;
  const withSystem = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true });
  assert.notEqual(withSystem.system, null);
  assert.deepEqual(withSystem.system.bodies.map((body) => body.id),
    plan.system.bodies.map((body) => body.id));
});

test("a visible marker lands within half a pixel of one of its own orbit's segment endpoints", () => {
  const distance = plan.system.maximumExtentUnits * 3;
  const projection = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true });
  for (const body of projection.system.bodies) {
    if (!body.marker.visible) continue;
    const [mx, my] = body.marker.screen;
    const closest = Math.min(...body.orbitSegments.flatMap(([x0, y0, x1, y1]) => [
      Math.hypot(x0 - mx, y0 - my),
      Math.hypot(x1 - mx, y1 - my),
    ]));
    assert.ok(closest <= 0.5,
      `${body.id}: marker is ${closest}px from the nearest orbit endpoint`);
  }
});

test("at a distance that fits the whole system, every marker is visible with its trailing half-orbit", () => {
  const distance = plan.system.maximumExtentUnits * 3;
  const projection = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true });
  assert.equal(projection.system.bodies.length, 7);
  for (const body of projection.system.bodies) {
    assert.equal(body.marker.classification, "visible");
    assert.ok(body.marker.visible);
    // The trail: exactly the chords with a positive weight, none ahead of
    // the body, each segment carrying its weight, the last one at the body.
    const weighted = plan.system.bodies.find(({ id }) => id === body.id).orbit.trail
      .filter((weight) => weight > 0).length;
    assert.equal(body.orbitSegments.length, weighted, `${body.id} segments`);
    assert.ok(weighted > 40 && weighted <= 60, `${body.id} trail chords ${weighted}`);
    const weights = body.orbitSegments.map((segment) => segment[4]);
    assert.ok(weights.every((weight, index) => index === 0 || weight >= weights[index - 1]),
      `${body.id} trail must strengthen toward the body`);
    assert.ok(weights.at(-1) > 0.99 && weights[0] < 0.05, `${body.id} trail ends ${weights[0]}..${weights.at(-1)}`);
    // The strongest segment ends at the marker: the trail terminates at the body.
    const [, , x1, y1] = body.orbitSegments.at(-1);
    assert.ok(Math.hypot(x1 - body.marker.screen[0], y1 - body.marker.screen[1]) < 1e-6);
  }
});

test("orbitTrailWeights fades linearly backwards from the body and weighs the leading half nothing", () => {
  const offsets = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4);
  const trail = orbitTrailWeights(offsets);
  // Chord mid-offsets: pi/8, 3pi/8, ... ; behind = 2pi - mid; weight 1 - behind/pi.
  assert.deepEqual(trail, [0, 0, 0, 0, 0.125, 0.375, 0.625, 0.875]);
  assert.throws(() => orbitTrailWeights([0.1, 0.2]), TypeError);
  assert.throws(() => orbitTrailWeights([0, 2, 1]), TypeError);
  assert.throws(() => orbitTrailWeights([0, 7]), TypeError);
  // The plan's own rings validate only as trails: a closed loop is refused.
  const loop = { ...plan, orbit: { ...plan.orbit, trail: plan.orbit.trail.map(() => 1) } };
  assert.throws(() => validatePreparedHeliocentricView(loop), TypeError);
});

test("a close default framing never throws and always returns finite segment geometry", () => {
  const distance = 5 * plan.units.bodyRadiusUnits;
  const projection = project({ rotation: IDENTITY, distance, system: true });
  assert.notEqual(projection.system, null);
  for (const body of projection.system.bodies) {
    assert.ok([
      "outside-viewport",
      "behind-camera",
      "behind-body",
      "visible",
    ].includes(body.marker.classification));
    for (const segment of body.orbitSegments) {
      for (const component of segment) assert.ok(Number.isFinite(component));
    }
  }
});

test("validatePreparedPlanetarySystem rejects every drifted variant of the real system", () => {
  const good = plan.system;
  assert.equal(validatePreparedPlanetarySystem(good, plan), good);

  const badObserver = { ...good, observer: "venus" };
  assert.throws(() => validatePreparedPlanetarySystem(badObserver, plan),
    /Prepared planetary system is incompatible/u);

  const badSun = {
    ...good,
    sun: { position: [good.sun.position[0] + 1, good.sun.position[1], good.sun.position[2]] },
  };
  assert.throws(() => validatePreparedPlanetarySystem(badSun, plan),
    /Prepared planetary system is incompatible/u);

  const badExtent = { ...good, maximumExtentUnits: plan.orbit.maximumExtentUnits - 1 };
  assert.throws(() => validatePreparedPlanetarySystem(badExtent, plan),
    /Prepared planetary system is incompatible/u);

  const badVertexZero = {
    ...good,
    bodies: [
      {
        ...good.bodies[0],
        orbit: {
          ...good.bodies[0].orbit,
          vertices: [[1, 2, 3], ...good.bodies[0].orbit.vertices.slice(1)],
        },
      },
      ...good.bodies.slice(1),
    ],
  };
  assert.throws(() => validatePreparedPlanetarySystem(badVertexZero, plan),
    /Prepared planetary system is incompatible/u);

  const duplicateBodies = { ...good, bodies: [good.bodies[0], good.bodies[0], ...good.bodies.slice(2)] };
  assert.throws(() => validatePreparedPlanetarySystem(duplicateBodies, plan),
    /Prepared planetary system is incompatible/u);

  const badRuntimeFlag = { ...good, runtimeGeometryDerivation: true };
  assert.throws(() => validatePreparedPlanetarySystem(badRuntimeFlag, plan),
    /Prepared planetary system is incompatible/u);
});
