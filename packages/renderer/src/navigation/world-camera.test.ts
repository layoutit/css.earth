import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createSelectionFlight, sampleSelectionFlight } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import mercuryDefinition from "../../../../src/objects/mercury/prepared/runtime.json" with {type: "json"};
import venusDefinition from "../../../../src/objects/venus/prepared/runtime.json" with {type: "json"};
import mercurySolar from "../../../../src/objects/mercury/source/presentation/solar-system.json" with {type: "json"};
import venusSolar from "../../../../src/objects/venus/source/presentation/solar-system.json" with {type: "json"};
import { prepareEclipticPresentationFrame } from '../../../../src/platform/solar-presentation-frame.mts';
import { ASTRONOMICAL_UNIT_KILOMETERS, BODY_FIXED_SUN_DIRECTIONS, BODY_FIXED_TO_ICRF_MATRICES,
  BODY_ORBITS, SOLAR_GEOMETRY_EPOCH_JD_TT } from '../../../../src/platform/solar-geometry.mts';
import { worldCameraFromCenteredPresentation, worldCameraFromPresentation, presentWorldCamera } from './world-camera.js';
import type { PreparedWorldCameraFrame, WorldCameraViewport } from './world-camera.js';

// Independent oracle: checked-in ephemerides, the real preparation basis and the authored body radii,
// without importing the new shared frame preparer or transport's matrix helpers. The solved system node
// crosses the body's own x axis with north (#294), so the presentation map is already a reflection: no
// axis swap is applied here.
function preparedFrame(id: 'mercury' | 'venus', radiusM: number, radiusUnits: number): PreparedWorldCameraFrame {
  const bodyFixedToIcrf = BODY_FIXED_TO_ICRF_MATRICES[id];
  const basis = prepareEclipticPresentationFrame(id).basis;
  const directionToIcrf = (vector: readonly number[]) => [0, 1, 2].map(row =>
    [0, 1, 2].reduce((sum, column) => sum + bodyFixedToIcrf[row * 3 + column] * vector[column], 0));
  const origin = directionToIcrf(BODY_FIXED_SUN_DIRECTIONS[id]);
  const distanceM = BODY_ORBITS[id].heliocentricDistanceAu * ASTRONOMICAL_UNIT_KILOMETERS * 1000;
  const columns = basis.map(axis => directionToIcrf(axis));
  return { referenceFrame: 'sun-icrf', epochJdTt: SOLAR_GEOMETRY_EPOCH_JD_TT,
    originM: [-origin[0] * distanceM, -origin[1] * distanceM, -origin[2] * distanceM],
    presentationToReference: [0, 1, 2].flatMap(row => columns.map(column => column[row])),
    bodyRadiusM: radiusM, metersPerUnit: radiusM / radiusUnits };
}
const mercuryRadiusUnits = mercuryDefinition.camera.logicalBodyDiameter / 2;
const mercury = preparedFrame('mercury', mercurySolar.bodyRadiusKilometers * 1000, mercuryRadiusUnits);
const venus = preparedFrame('venus', venusSolar.bodyRadiusKilometers * 1000, venusDefinition.camera.logicalBodyDiameter / 2);
// Measured from installed Chrome with the actual Mercury shell at 1440 x1000.
const viewport: WorldCameraViewport = { focalPixels: 1247.08, principalOffsetPixels: [-170, 0] };
const initialDistance = 1250.2459507895273;
const pitch = mercuryDefinition.camera.initialScenePitchDegrees * Math.PI / 180;
const initialRotation = [1, 0, 0, 0, Math.cos(pitch), -Math.sin(pitch), 0, Math.sin(pitch), Math.cos(pitch)];
// A real accumulated orientation can contain roll; it is not just the two controls.
const rolledRotation = multiply(axisRotation(2, .49), multiply(axisRotation(0, -.81), axisRotation(1, 1.17)));

function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-10): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= tolerance,
    `${index}: ${value} differs from ${expected[index]} by ${Math.abs(value - expected[index])}`));
}
function axisRotation(axis: number, angle: number): number[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return axis === 0 ? [1, 0, 0, 0, c, -s, 0, s, c]
    : axis === 1 ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
}
function multiply(a: readonly number[], b: readonly number[]): number[] {
  return [0, 1, 2].flatMap(row => [0, 1, 2].map(column =>
    [0, 1, 2].reduce((sum, k) => sum + a[row * 3 + k] * b[k * 3 + column], 0)));
}
function eyeInMeters(rotation: readonly number[], relative: PositionM): PositionM {
  const component = (row: number) => [0, 1, 2].reduce((sum, col) => sum + rotation[row * 3 + col] * relative[col], 0);
  return [component(0), component(1), component(2)];
}
function cross(a: readonly number[], b: readonly number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function unit(vector: readonly number[]): number[] {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
}
// Where a CSS translate lands on screen through the shared perspective origin.
function cssProject(translate: readonly number[], { focalPixels: focal, principalOffsetPixels: [ox, oy] }: WorldCameraViewport): number[] {
  const depth = focal - translate[2];
  return [ox + (translate[0] - ox) * focal / depth, oy + (translate[1] - oy) * focal / depth];
}
// The sphere's tangent cone traced ray by ray through the same pinhole; its extents are the drawn silhouette.
function silhouetteOracle(center: readonly number[], radius: number, { focalPixels: focal, principalOffsetPixels: [ox, oy] }: WorldCameraViewport) {
  const distance = Math.hypot(...center), axis = center.map(value => value / distance);
  const alpha = Math.asin(radius / distance);
  const e1 = unit(cross(axis, Math.abs(axis[0]) < .9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(axis, e1);
  const planar = Math.hypot(center[0], center[1]);
  const radial = planar > 0 ? [center[0] / planar, center[1] / planar] : [1, 0];
  let nearest = Infinity, farthest = -Infinity, across = 0;
  for (let index = 0; index < 20000; index++) {
    const phi = 2 * Math.PI * index / 20000;
    const ray = [0, 1, 2].map(component => axis[component] * Math.cos(alpha) +
      (e1[component] * Math.cos(phi) + e2[component] * Math.sin(phi)) * Math.sin(alpha));
    const x = focal * ray[0] / -ray[2], y = focal * ray[1] / -ray[2];
    const along = x * radial[0] + y * radial[1];
    nearest = Math.min(nearest, along);
    farthest = Math.max(farthest, along);
    across = Math.max(across, Math.abs(y * radial[0] - x * radial[1]));
  }
  const middle = (nearest + farthest) / 2;
  return { radialSemiAxis: (farthest - nearest) / 2, tangentialSemiAxis: across,
    centre: [ox + middle * radial[0], oy + middle * radial[1]] };
}

test('actual Mercury centred pose round-trips with its principal point, physical size and accumulated roll', () => {
  for (const rotation of [initialRotation, rolledRotation]) {
    const world = worldCameraFromCenteredPresentation({ rotation, distanceUnits: initialDistance }, mercury, viewport);
    const result = presentWorldCamera(world, mercury, viewport);
    close(result.rotation, rotation, 2e-15);
    close(result.centerPixels!, [0, 0], 3e-9);
    close(cssProject(result.translateCssPixels, viewport), result.centerPixels!, 3e-9);
    assert.ok(Math.abs(result.distanceM - initialDistance * mercury.metersPerUnit) < 3e-5);
    const oracle = silhouetteOracle(result.bodyCenterUnits, mercuryRadiusUnits, viewport);
    close([result.silhouette!.tangentialSemiAxis, result.silhouette!.radialSemiAxis],
      [oracle.tangentialSemiAxis, oracle.radialSemiAxis], 1e-5);
    close(result.silhouette!.centre, oracle.centre, 1e-5);
    const again = worldCameraFromPresentation(result, mercury);
    close(again.pose.positionM, world.pose.positionM, 3e-5);
    close(again.pose.orientationXyzw, world.pose.orientationXyzw, 1e-15);
    const css = result.sceneMatrix.slice(9, -1).split(',').map(Number);
    close([css[0], css[4], css[8], css[1], css[5], css[9], css[2], css[6], css[10]], rotation, 5.1e-13);
  }
});

test('selecting actual Venus transports the same observer without recentering or a unit-scale jump', () => {
  const world = worldCameraFromCenteredPresentation({ rotation: rolledRotation, distanceUnits: 2e7 }, mercury, viewport);
  const source = presentWorldCamera(world, mercury, viewport);
  const target = presentWorldCamera(world, venus, viewport);
  const returned = worldCameraFromPresentation(target, venus);
  close(returned.pose.positionM, world.pose.positionM, .001);
  const quaternionDot = returned.pose.orientationXyzw.reduce((sum, value, index) => sum + value * world.pose.orientationXyzw[index], 0);
  assert.ok(Math.abs(Math.abs(quaternionDot) - 1) < 1e-15);
  assert.ok(Math.hypot(...target.centerPixels!) > 1, 'Selecting another centre must not re-aim the eye.');
  // Directly transform the body-to-body ICRF separation through the source frame.
  const difference: PositionM = [venus.originM[0] - mercury.originM[0], venus.originM[1] - mercury.originM[1], venus.originM[2] - mercury.originM[2]];
  const referenceToPresentation = [0, 1, 2].flatMap(row => [0, 1, 2].map(col => mercury.presentationToReference[col * 3 + row]));
  const referenceToEye = multiply(source.rotation, referenceToPresentation);
  const displacement = eyeInMeters(referenceToEye, difference);
  const sourceEye = source.bodyCenterUnits.map(component => component * mercury.metersPerUnit);
  const expectedEye = displacement.map((component, axis) => component + sourceEye[axis]);
  close(target.bodyCenterUnits.map(component => component * venus.metersPerUnit), expectedEye, .0005);
  // Changing only the prepared unit ladder must preserve every pixel and physical radius.
  const differentUnits = presentWorldCamera(world, { ...venus, metersPerUnit: venus.metersPerUnit / 7 }, viewport);
  close(differentUnits.centerPixels!, target.centerPixels!, 1e-10);
  close([differentUnits.silhouette!.tangentialSemiAxis], [target.silhouette!.tangentialSemiAxis], 1e-12);
  assert.ok(Math.abs(differentUnits.distanceM - target.distanceM) < .0001);
});

test('one engine flight is continuous from Mercury space to a near Venus orbit and is interruptible', () => {
  const from = worldCameraFromCenteredPresentation({ rotation: initialRotation, distanceUnits: 2e7 }, mercury, viewport);
  const to = worldCameraFromCenteredPresentation({ rotation: rolledRotation, distanceUnits: 1400 }, venus, viewport);
  const flight = createSelectionFlight({ from: from.pose, to: to.pose, focusPositionM: venus.originM });
  let last = from;
  for (let index = 0; index <= 40; index++) {
    const sample = sampleSelectionFlight(flight, flight.durationS * index / 40);
    last = { ...from, pose: sample };
    const target = presentWorldCamera(last, venus, viewport);
    const returned = worldCameraFromPresentation(target, venus);
    close(returned.pose.positionM, sample.positionM, .001);
    close(presentWorldCamera(returned, mercury, viewport).rotation,
      presentWorldCamera(last, mercury, viewport).rotation, 1e-14);
    if (target.silhouette) assert.ok(Number.isFinite(target.silhouette.tangentialSemiAxis));
  }
  close(last.pose.positionM, to.pose.positionM);
  const end = presentWorldCamera(last, venus, viewport);
  close(end.centerPixels!, [0, 0], 2e-9);
  assert.ok(end.silhouette!.tangentialSemiAxis > 200);
  const halfway = sampleSelectionFlight(flight, flight.durationS / 2);
  const redirected = createSelectionFlight({ from: halfway, to: from.pose, focusPositionM: mercury.originM });
  assert.deepEqual(sampleSelectionFlight(redirected, 0).positionM, halfway.positionM);
  close(sampleSelectionFlight(redirected, 0).orientationXyzw, halfway.orientationXyzw);
});

test('invalid reference metadata, reflected or scaled rotations and nonfinite cameras are rejected', () => {
  const input = { rotation: initialRotation, distanceUnits: initialDistance };
  const world = worldCameraFromCenteredPresentation(input, mercury, viewport);
  for (const frame of [{ ...mercury, epochJdTt: mercury.epochJdTt + 1 }, { ...mercury, referenceFrame: 'other' },
    { ...mercury, metersPerUnit: 0 }, { ...mercury, bodyRadiusM: -1 },
    { ...mercury, presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1] }]) {
    assert.throws(() => presentWorldCamera(world, frame, viewport), TypeError);
  }
  assert.throws(() => worldCameraFromCenteredPresentation({ ...input, rotation: [2, 0, 0, 0, 1, 0, 0, 0, 1] }, mercury, viewport), TypeError);
  assert.throws(() => worldCameraFromCenteredPresentation({ ...input, distanceUnits: NaN }, mercury, viewport), TypeError);
  assert.throws(() => presentWorldCamera(world, mercury, { ...viewport, focalPixels: -1 }), TypeError);
  assert.throws(() => worldCameraFromPresentation({ rotation: initialRotation, bodyCenterUnits: [NaN, 0, 0] }, mercury), TypeError);
});

test('a translated sphere behind or crossing the eye remains transportable without a fabricated silhouette', () => {
  const centres: PositionM[] = [[0, 0, 1000], [0, 0, -100], [0, 0, 0]];
  for (const bodyCenterUnits of centres) {
    const local = { rotation: initialRotation, bodyCenterUnits };
    const world = worldCameraFromPresentation(local, mercury);
    const presented = presentWorldCamera(world, mercury, viewport);
    assert.equal(presented.silhouette, null);
    close(presented.bodyCenterUnits, bodyCenterUnits, 2e-9);
  }
});
