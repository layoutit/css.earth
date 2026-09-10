import assert from 'node:assert/strict';
import { test } from 'vitest';
import { prepareHyperbolicPath } from '../../../platform/prepare-hyperbolic-path.mjs';
import reference from '../../../../src/planets/mercury/prepared/runtime.json' with {type: 'json'};
import { parsePreparedObjectRuntime } from '../validation/index.js';
import { projectHeliocentricView, validatePreparedHeliocentricView, type HeliocentricViewPlan } from './heliocentric-view.js';

const path = prepareHyperbolicPath({ semiMajorAxisUnits: -10, eccentricity: 2,
  trueAnomalyRad: Math.PI / 2, unitsPerAu: 1, heliocentricDistanceAu: 30,
  focus: [0, -30, 0], perihelionDirection: [1, 0, 0], perihelionMotion: [0, 1, 0] });
const plan: HeliocentricViewPlan = {
  schema: 'cssearth-prepared-heliocentric-view@1', bodyId: 'mercury',
  units: { kilometersPerUnit: 149597870.7, bodyRadiusUnits: 1e-8 },
  sun: { direction: [0, -1, 0], position: [0, -30, 0], distanceUnits: 30, radiusUnits: .00465,
    sprite: { worldDiameterUnits: .05, imagePixels: 128 } },
  orbit: { ...path, semiMajorAxisUnits: -10, eccentricity: 2,
    normal: [0, 0, 1], perihelionDirection: [1, 0, 0],
    vertexCount: path.vertices.length, maximumExtentUnits: Math.max(...path.vertices.map(v => Math.hypot(...v))) },
  runtimeGeometryDerivation: false,
};
const camera = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], distance: 2000, focal: 1000,
  viewportWidth: 2000, viewportHeight: 2000 };

test('strict runtime transport accepts an explicitly open path and rejects invented closing edges', () => {
  const definition = { ...reference, heliocentricView: { ...reference.heliocentricView, plan } };
  assert.equal(parsePreparedObjectRuntime(definition), definition);
  for (const change of [{ trail: [...path.trail, 1] }, { closed: true }, { bodyVertexIndex: 0 }, { displayExtentAu: Infinity }]) {
    assert.throws(() => validatePreparedHeliocentricView({ ...plan, orbit: { ...plan.orbit, ...change } }));
  }
});

test('CSS projection preserves the two open endpoints even when session trail weights request a ring', () => {
  const expected = path.vertices.slice(0, -1).map((start, index) => {
    const end = path.vertices[index + 1];
    return [start[0] / 2, start[1] / 2, end[0] / 2, end[1] / 2];
  }).filter(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0) >= .05);
  const projected = projectHeliocentricView(plan, { ...camera,
    trailWeights: { own: Array(path.vertices.length).fill(1) } });
  assert.equal(projected.orbitSegments.length, expected.length);
  projected.orbitSegments.forEach((segment, index) => {
    assert.ok(segment.slice(0, 4).every((value, axis) => Math.abs(value - expected[index][axis]) < 1e-8));
    assert.equal(segment[4], 1);
  });
});

test('unbound system markers project without an orbit, label policy or line geometry', () => {
  const source = reference.heliocentricView.plan;
  const body = { ...source.system.bodies[0], eccentricity: 2, semiMajorAxisUnits: -100, orbit: null };
  const markerPlan = { ...source, system: { ...source.system, bodies: [body] } };
  assert.equal(validatePreparedHeliocentricView(markerPlan), markerPlan);
  const projected = projectHeliocentricView(markerPlan, { ...camera,
    distance: source.system.maximumExtentUnits * 3, system: true });
  assert.equal(projected.system?.bodies.length, 1);
  assert.deepEqual(projected.system?.bodies[0].orbitSegments, []);
  assert.equal(projected.system?.bodies[0].marker.labelPriority, 0);
});
