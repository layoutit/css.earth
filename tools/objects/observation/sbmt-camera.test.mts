import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectSbmtArchivedCamera, sbmtSumToArchivedCamera } from './sbmt-camera.mts';
import type { SbmtSumPointing } from './sbmt-pointing.mts';

const pointing: SbmtSumPointing = {
  sumId: 'D7175061219G', timeUtc: '2022 SEP 26 23:14:12.737', sampleCount: 1024, lineCount: 1024,
  lowerDnThreshold: 9728, upperDnThreshold: 65535, focalLengthMillimetres: 2628.3343,
  opticalAxisSampleLineCenter: [512.5, 512.5], spacecraftToObjectCenterBodyFixed: [-12.27887246, 68.40586016, 11.37922398],
  sampleAxisBodyFixed: [-0.7323769102, -0.01896764178, -0.6806352106],
  lineAxisBodyFixed: [-0.6578520959, -0.2381637704, 0.7144988723],
  boresightBodyFixed: [-0.1756550066, 0.9710397763, 0.1619477432],
  sunDirectionBodyFixed: [-0.7579943922, -0.6312103893, -0.1643713657],
  kMatrix: [[76.9229, 0, 0], [0.0031, -76.9262, 0]], distortion: [0, 0, 0, 0],
  sigmaVso: [0.015, 0.015, 0.015], sigmaPtg: [0.0001, 0.0001, 0.0001], landmarks: [], limbFits: [],
};

const approximately = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('adapts the documented SUM gnomonic projection without removing skew or signed line scale', () => {
  const camera = sbmtSumToArchivedCamera(pointing);
  assert.deepEqual(camera.positionKm, [12.27887246, -68.40586016, -11.37922398]);
  const eye = camera.positionKm;
  // SUM's native optical axis is (512.5,512.5); the adapter's array center is
  // therefore (511.5,511.5), preserving the source convention without a fit.
  const centerRay = camera.rayMatrix.map(row => row[0] * 511.5 + row[1] * 511.5 + row[2]) as [number, number, number];
  const point = [eye[0] + 10 * centerRay[0], eye[1] + 10 * centerRay[1], eye[2] + 10 * centerRay[2]] as const;
  const centerProjection = projectSbmtArchivedCamera(camera, point);
  assert.ok(centerProjection);
  approximately(centerProjection[0], 511.5); approximately(centerProjection[1], 511.5);

  // The zero-based corner (0,0) maps to native SUM sample/line (1,1).
  const cornerRay = camera.rayMatrix.map(row => row[2]) as [number, number, number];
  const cornerPoint = [eye[0] + 10 * cornerRay[0], eye[1] + 10 * cornerRay[1], eye[2] + 10 * cornerRay[2]] as const;
  const cornerProjection = projectSbmtArchivedCamera(camera, cornerPoint);
  assert.ok(cornerProjection);
  approximately(cornerProjection[0] + 1, 1); approximately(cornerProjection[1] + 1, 1);

  // Native SUM (400,600) is zero-based array center (399,599).
  const ray = camera.rayMatrix.map(row => row[0] * 399 + row[1] * 599 + row[2]) as [number, number, number];
  const offAxisPoint = [eye[0] + ray[0] * 10, eye[1] + ray[1] * 10, eye[2] + ray[2] * 10] as const;
  const projected = projectSbmtArchivedCamera(camera, offAxisPoint);
  assert.ok(projected);
  approximately(projected[0], 399); approximately(projected[1], 599);
});

test('refuses SUM fields whose documented projection model is unavailable', () => {
  assert.throws(() => sbmtSumToArchivedCamera({ ...pointing, kMatrix: [[76.9229, 0, 1], [0.0031, -76.9262, 0]] }), /third-column/);
  assert.throws(() => sbmtSumToArchivedCamera({ ...pointing, distortion: [0.01, 0, 0, 0] }), /distortion model/);
});
