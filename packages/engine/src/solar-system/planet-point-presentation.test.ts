import assert from 'node:assert/strict';
import { test } from 'vitest';
import { planetPointPresentation, planetOrbitLabelPriority, validPreparedPlanetPoint,
  PREPARED_PLANET_POINT_SCHEMA } from './planet-point-presentation.js';
import type { PreparedPlanetPoint } from './planet-point-presentation.js';

const point: PreparedPlanetPoint = {
  schema: PREPARED_PLANET_POINT_SCHEMA, minimumLogDistance: 0, logDistanceStep: 2,
  distanceCount: 2, phaseCount: 2,
  samples: [1, 1, -2, 3, 0.5, 0, 5, 0.75, 2, 7, 0.25, 4],
  policy: {minimumRadiusPx: 0.6, skipRadiusPx: 0.4, maximumRadiusPx: 10, minimumAlpha: 0.25},
};
test('prepared radiance interpolates independently in logarithmic distance and phase', () => {
  assert.equal(validPreparedPlanetPoint(point), true);
  assert.deepEqual(planetPointPresentation(point, 10, Math.PI / 2), {
    radiusPx: 4, diameterPx: 8, alpha: 0.71875, magnitude: 1,
  });
  assert.equal(planetPointPresentation(point, 0.001, -1).radiusPx, 1);
  assert.equal(planetPointPresentation(point, 1e9, Math.PI * 2).radiusPx, 7);
  assert.equal(planetPointPresentation(point, 10, Math.PI / 2, 100).radiusPx, 10);
  assert.equal(planetPointPresentation(point, 10, Math.PI / 2, 0.01).alpha, 0.25);
  assert.equal(validPreparedPlanetPoint({...point, samples: point.samples.slice(1)}), false);
});
test('orbital label priority combines apparent magnitude and eligible orbit weight', () => {
  const policy = {radiusUnits: 1, angularFadeInRadians: 0.01, angularFullRadians: 0.02,
    nearDistanceUnits: 10, farDistanceUnits: 20, minimumEligibility: 0.12};
  assert.equal(planetOrbitLabelPriority(policy, 100, 20, 3), 17);
  assert.equal(planetOrbitLabelPriority(policy, 100, 10, 3), -3);
  assert.equal(planetOrbitLabelPriority(policy, 100, 11, 3), -3);
  assert.equal(planetOrbitLabelPriority(policy, 100, 15, 3), 7);
});
