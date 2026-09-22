import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { prepareHyperbolicPath } from "./prepare-hyperbolic-path.mts";

// Independent polar conic: a=-10 au, e=2 has p=a(1-e²)=30 au.
// At true anomaly pi/2 the body is at (0,30,0) relative to its focus.
const input = {
  semiMajorAxisUnits: -10, eccentricity: 2, trueAnomalyRad: Math.PI / 2,
  unitsPerAu: 1, heliocentricDistanceAu: 30, focus: [0, -30, 0],
  perihelionDirection: [1, 0, 0], perihelionMotion: [0, 1, 0],
};
const path = prepareHyperbolicPath(input);

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
    assert.ok(vertex, "Both path endpoints exist");
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

test("the sampler rejects closed, inconsistent or misplaced conics", () => {
  for (const change of [{ eccentricity: 1 }, { semiMajorAxisUnits: 10 },
    { trueAnomalyRad: Math.PI }, { focus: [0, -31, 0] }]) {
    assert.throws(() => prepareHyperbolicPath({ ...input, ...change }));
  }
});
