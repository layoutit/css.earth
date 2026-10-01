import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectCatalogPosition } from './galaxy-catalog-layout.js';

const world = { referenceFrame: 'test', epochJdTt: 1,
  pose: { positionM: [0, 0, 0] as const, orientationXyzw: [0, 0, 0, 1] as const } };
const viewport = { focalPixels: 100, principalOffsetPixels: [2, -3] as const };
test('projects prepared metre coordinates in the shared observer including translation and the principal point', () => {
  // The identity pose looks down -z with +y up; a point above the axis lands above the principal point on a y-down screen.
  assert.partialDeepStrictEqual(projectCatalogPosition([10, 20, -100], world, viewport), { x: 12, y: -23 });
  const moved = { ...world, pose: { ...world.pose, positionM: [10, 0, 0] as const } };
  assert.partialDeepStrictEqual(projectCatalogPosition([10, 20, -100], moved, viewport), { x: 2, y: -23 });
  assert.equal(projectCatalogPosition([0, 0, 100], world, viewport), null);
});
