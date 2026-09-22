import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PreparedCubicSkyPlan } from '../../src/platform/cubic-sky-contract.mts';
import { focusedCameraProjection } from './focused-camera.mts';

const prepared = (path: string): unknown => JSON.parse(readFileSync(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8'));

test("an object camera without its own projection shares the sky's focal length", () => {
  const sky = prepared('earth/prepared/sky.json') as PreparedCubicSkyPlan;
  const projection = focusedCameraProjection(sky);
  assert.equal(projection.cssPerspective, sky.projection?.cssPerspective);
  assert.equal(projection.focalLengthOverViewportWidth, sky.projection?.focalLengthOverViewportWidth);
  const runtime = prepared('earth/prepared/runtime.json') as { camera: { projection: unknown } };
  assert.deepEqual(runtime.camera.projection, projection, "Earth's prepared camera is this tool's output");
});

test('without a matching sky projection the focal length follows the camera field of view', () => {
  const projection = focusedCameraProjection({ cameraContract: { source: 'test', sourcePath: 'test', qualification: 'test',
    rotationResponse: -1, zoomResponse: 0, horizontalFovDegrees: 90, focalLengthOverViewportWidth: 0.5 } } as unknown as PreparedCubicSkyPlan);
  assert.ok(Math.abs(projection.focalLengthOverViewportWidth - 0.5) < 1e-12);
  assert.match(projection.cssPerspective, /^50(\.\d+)?cqw$/);
});
