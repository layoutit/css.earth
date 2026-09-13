import assert from "node:assert/strict";
import test from "node:test";

import { orbitTrailWeights } from "./prepare-heliocentric-view.mts";
import {
  trailWeightsForSpans,
  validatePreparedHeliocentricView,
  projectHeliocentricView,
  validatePreparedPlanetarySystem,
} from "./heliocentric-view.mts";
import PREPARED_MERCURY_SCENE from "../../src/objects/mercury/prepared/scene.json" with {type: "json"};

const plan = PREPARED_MERCURY_SCENE.heliocentricView;
const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
// Looking down the ecliptic pole: the whole (near-coplanar) system fills the
// view edge-on to none of its axes, so every body's orbit and marker land
// inside the frustum at a large enough distance.
const LOOKING_DOWN_THE_POLE = Object.freeze([1, 0, 0, 0, 0, -1, 0, 1, 0]);
const VIEWPORT = { viewportWidth: 1440, viewportHeight: 900 };
const FOCAL = 1247;

function project(options: Pick<Parameters<typeof projectHeliocentricView>[1], "rotation" | "distance"> & Partial<Parameters<typeof projectHeliocentricView>[1]>) {
  return projectHeliocentricView(plan, { focal: FOCAL, ...VIEWPORT, ...options });
}

test("omits the system projection unless asked for, then projects every body in plan order", () => {
  const withoutSystem = project({ rotation: IDENTITY, distance: 5 * plan.units.bodyRadiusUnits });
  assert.equal(withoutSystem.system, null);

  const distance = plan.system.maximumExtentUnits * 3;
  const withSystem = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true });
  assert.notEqual(withSystem.system, null);
  assert.ok(withSystem.system);
  assert.deepEqual(withSystem.system.bodies.map((body) => body.id),
    plan.system.bodies.map((body) => body.id));
});

test("a visible marker lands within half a pixel of one of its own orbit's segment endpoints", () => {
  const distance = plan.system.maximumExtentUnits * 3;
  const projection = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true });
  assert.ok(projection.system);
  for (const body of projection.system.bodies) {
    if (!body.marker.visible) continue;
    assert.ok(body.marker.screen);
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
  assert.ok(projection.system);
  assert.equal(projection.system.bodies.length, 12);
  for (const body of projection.system.bodies) {
    assert.equal(body.marker.classification, "visible");
    assert.ok(body.marker.visible);
    // The trail: exactly the chords with a positive weight, none ahead of
    // the body, each segment carrying its weight, the last one at the body.
    const sourceBody = plan.system.bodies.find(({ id }) => id === body.id);
    assert.ok(sourceBody);
    const weighted = sourceBody.orbit.trail.filter((weight) => weight > 0).length;
    assert.equal(body.orbitSegments.length, weighted, `${body.id} segments`);
    // Five eighths of the ring: solid for three eighths, fading a quarter.
    assert.ok(weighted >= 74 && weighted <= 76, `${body.id} trail chords ${weighted}`);
    const weights = body.orbitSegments.map((segment) => segment[4]);
    assert.ok(weights.every((weight, index) => index === 0 || weight >= weights[index - 1]),
      `${body.id} trail must strengthen toward the body`);
    const lastWeight = weights.at(-1);
    assert.ok(lastWeight !== undefined);
    assert.ok(lastWeight > 0.99 && weights[0] < 0.05, `${body.id} trail ends ${weights[0]}..${weights.at(-1)}`);
    // Solid over the three eighths of a turn nearest the body.
    assert.ok(weights.slice(-44).every((weight) => weight === 1), `${body.id} solid span`);
    // The strongest segment ends at the marker: the trail terminates at the body.
    const lastSegment = body.orbitSegments.at(-1);
    assert.ok(lastSegment);
    assert.ok(body.marker.screen);
    const [, , x1, y1] = lastSegment;
    assert.ok(Math.hypot(x1 - body.marker.screen[0], y1 - body.marker.screen[1]) < 1e-6);
  }
});

test("orbitTrailWeights fades linearly backwards from the body and weighs the leading half nothing", () => {
  const offsets = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4);
  const trail = orbitTrailWeights(offsets);
  // Chord mid-offsets (k + 0.5) pi/4; behind = (7.5 - k) / 8 turns. Solid
  // for three eighths behind (chords 5..7), fading over the next quarter
  // (chords 3, 4: 0.5 and 1 turn... behind 0.5625 -> 0.25, 0.4375 -> 0.75),
  // nothing beyond five eighths (chords 0..2).
  assert.deepEqual(trail, [0, 0, 0, 0.25, 0.75, 1, 1, 1]);
  // The runtime re-weights the prepared rings from their chord angles: with
  // the prepared spans it reproduces the prepared trail exactly.
  assert.deepEqual(trailWeightsForSpans(plan.orbit.chordBehindTurns, plan.orbit.trailSpans), plan.orbit.trail);
  for (const body of plan.system.bodies) {
    assert.deepEqual(trailWeightsForSpans(body.orbit.chordBehindTurns, body.orbit.trailSpans), body.orbit.trail, body.id);
  }
  assert.throws(() => trailWeightsForSpans(plan.orbit.chordBehindTurns, { solidTurns: 0.5, fadeTurns: 0.5 }), TypeError);
  // The spans are data: a shorter, half-turn trail that fades immediately.
  assert.deepEqual(orbitTrailWeights(offsets, { solidTurns: 0, fadeTurns: 0.5 }),
    [0, 0, 0, 0, 0.125, 0.375, 0.625, 0.875]);
  assert.throws(() => orbitTrailWeights(offsets, { solidTurns: 0.8, fadeTurns: 0.3 }), TypeError);
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
  assert.ok(projection.system);
  assert.notEqual(projection.system, null);
  assert.ok(projection.system);
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

test("a visible rectangle narrower than the root decides which markers count as on screen", () => {
  const distance = plan.system.maximumExtentUnits * 3;
  const whole = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true });
  // The shell lays the root out past the stage's edge: only the part of the
  // root left of x = 50 is on screen; every projection is unchanged.
  const visibleRect = { left: -720, top: -450, right: 50, bottom: 450 };
  const clipped = project({ rotation: LOOKING_DOWN_THE_POLE, distance, system: true, visibleRect });
  assert.ok(clipped.system);
  assert.ok(whole.system);
  assert.equal(clipped.system.bodies.length, whole.system.bodies.length);
  let changed = 0;
  for (const [index, body] of clipped.system.bodies.entries()) {
    const reference: NonNullable<ReturnType<typeof project>["system"]>["bodies"][number] = whole.system.bodies[index];
    assert.deepEqual(body.marker.screen, reference.marker.screen, `${body.id} projects the same`);
    assert.ok(body.marker.screen);
    const inside = body.marker.screen[0] >= visibleRect.left && body.marker.screen[0] <= visibleRect.right &&
      body.marker.screen[1] >= visibleRect.top && body.marker.screen[1] <= visibleRect.bottom;
    assert.equal(body.marker.classification, inside ? reference.marker.classification : "outside-viewport", body.id);
    assert.equal(body.marker.visible, inside && reference.marker.visible, body.id);
    if (body.marker.classification !== reference.marker.classification) changed += 1;
  }
  assert.ok(changed > 0, "markers in the root's off-screen strip are outside");
  assert.ok(changed < clipped.system.bodies.length, "markers on screen stay visible");
  for (const rect of [{ left: 0, top: 0, right: 0, bottom: 10 }, { left: "0", top: 0, right: 1, bottom: 1 }, { left: 0, top: 5, right: 1, bottom: 1 }]) {
    assert.throws(() => Reflect.apply(project, undefined, [{ rotation: LOOKING_DOWN_THE_POLE, distance, system: true, visibleRect: rect }]), /invalid/u);
  }
});
