import assert from "node:assert/strict";
import test from "node:test";
import { prepareHyperbolicPath } from "./prepare-hyperbolic-path.mts";
import { projectHeliocentricView, validatePreparedHeliocentricView } from "./heliocentric-view.mts";

// Independent polar conic: a=-10 au, e=2 has p=a(1-e²)=30 au.
// At true anomaly pi/2 the body is at (0,30,0) relative to its focus.
const input = {
  semiMajorAxisUnits: -10, eccentricity: 2, trueAnomalyRad: Math.PI / 2,
  unitsPerAu: 1, heliocentricDistanceAu: 30, focus: [0, -30, 0],
  perihelionDirection: [1, 0, 0], perihelionMotion: [0, 1, 0],
};
const path = prepareHyperbolicPath(input);
const plan = {
  schema: "cssearth-prepared-heliocentric-view@1", bodyId: "test-body",
  units: { kilometersPerUnit: 149597870.7, bodyRadiusUnits: 1e-8 },
  sun: { direction: [0, -1, 0], position: input.focus, distanceUnits: 30, radiusUnits: .00465,
    sprite: { worldDiameterUnits: .05, imagePixels: 128 } },
  orbit: { ...path, semiMajorAxisUnits: -10, eccentricity: 2,
    normal: [0, 0, 1], perihelionDirection: [1, 0, 0],
    vertexCount: path.vertices.length, maximumExtentUnits: Math.max(...path.vertices.map(v => Math.hypot(...v))) },
  runtimeGeometryDerivation: false,
};

test("finite open path follows the independent polar conic and includes exact periapsis and body", () => {
  assert.equal(path.closed, false);
  assert.equal(path.displayExtentAu, 600);
  assert.equal(path.trail.length, path.vertices.length - 1);
  assert.deepEqual(path.chordBehindTurns, []);
  assert.equal(path.trailSpans, null);
  assert.deepEqual(path.vertices[path.bodyVertexIndex], [0, 0, 0]);
  assert.ok(path.bodyVertexIndex > 0 && path.bodyVertexIndex < path.vertices.length - 1);
  assert.ok(path.vertices.some(v => Math.hypot(v[0] - 10, v[1] + 30, v[2]) < 1e-7));
  for (const vertex of path.vertices) {
    const [x, y, z] = vertex.map((value, axis) => value - input.focus[axis]);
    const radius = Math.hypot(x, y, z);
    // Prepared coordinates round to 1e-6 scene units. Error in r+2x is at
    // most (sqrt(3)+2)*0.5e-6 units, independent of the sampled conic.
    assert.ok(Math.abs(radius + 2 * x - 30) < 2e-6, "r(1+e cosν)=p");
    assert.ok(radius <= 600 + 1e-6);
  }
  for (const vertex of [path.vertices[0], path.vertices.at(-1)]) {
    assert.ok(Math.abs(Math.hypot(...vertex.map((value, axis) => value - input.focus[axis])) - 600) < 1e-6);
  }
});

test("window expands to include distant source epochs without inventing an apoapsis", () => {
  // Polar equation fixes cosν from r=900 au independently of the sampler.
  const radius = 900, cosNu = (30 / radius - 1) / 2, sinNu = Math.sqrt(1 - cosNu ** 2);
  const distant = prepareHyperbolicPath({ ...input, trueAnomalyRad: Math.acos(cosNu),
    heliocentricDistanceAu: radius, focus: [-radius * cosNu, -radius * sinNu, 0] });
  assert.equal(distant.displayExtentAu, 1125);
  assert.deepEqual(distant.vertices[distant.bodyVertexIndex], [0, 0, 0]);
  assert.ok(distant.bodyVertexIndex < distant.vertices.length - 1);
});

test("projection draws every visible adjacent chord and no endpoint-closing chord", () => {
  assert.equal(validatePreparedHeliocentricView(plan), plan);
  const projection = projectHeliocentricView(plan, {
    rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], distance: 2000, focal: 1000,
    viewportWidth: 2000, viewportHeight: 2000,
  });
  // Some refined chords are below the existing .05px rendering threshold.
  const expected = path.vertices.slice(0, -1).map((start, index) => {
    const end = path.vertices[index + 1];
    return [start[0] / 2, start[1] / 2, end[0] / 2, end[1] / 2];
  }).filter(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0) >= .05);
  assert.equal(projection.orbitSegments.length, expected.length);
  projection.orbitSegments.forEach((segment, index) => {
    assert.ok(segment.slice(0, 4).every((value, axis) => Math.abs(value - expected[index][axis]) < 1e-8));
    assert.equal(segment[4], 1);
  });
});

test("validation rejects false closing edges, turn metadata and misplaced epoch vertices", () => {
  for (const change of [{ trail: [...path.trail, 1] }, { closed: true },
    { bodyVertexIndex: 0 }, { displayExtentAu: Infinity },
    { trailSpans: { solidTurns: .375, fadeTurns: .25 } }, { eccentricity: 1 }]) {
    assert.throws(() => validatePreparedHeliocentricView({ ...plan, orbit: { ...plan.orbit, ...change } }));
  }
  for (const change of [{ eccentricity: 1 }, { semiMajorAxisUnits: 10 },
    { trueAnomalyRad: Math.PI }, { focus: [0, -31, 0] }]) {
    assert.throws(() => prepareHyperbolicPath({ ...input, ...change }));
  }
});
