/**
 * The Earth view turns the camera only. Through the shipped publication chain the eye must sit on the object's
 * Sun-ward side, looking along the line of sight, with the photograph's up (or celestial north) up on screen. The
 * eye is read through the engine's `fromEyeM`, never by subtracting the pose position.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { earthViewRotation } from '@cssearth/volume-viewer/camera/inspection-camera';
import { fromEyeM, rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { inspectionCameraRenderer } from './inspection-camera-renderer';

/** Executable fixture: the column-major DOMMatrix members `rotationFromMatrix3d` reads. */
class TestMatrix {
  readonly values: number[];
  constructor(values: number[]) { this.values = values; }
  get m11() { return this.values[0]!; } get m21() { return this.values[4]!; } get m31() { return this.values[8]!; }
  get m12() { return this.values[1]!; } get m22() { return this.values[5]!; } get m32() { return this.values[9]!; }
  get m13() { return this.values[2]!; } get m23() { return this.values[6]!; } get m33() { return this.values[10]!; }
}
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= TestMatrix;

const unit = (v: readonly number[]) => { const length = Math.hypot(...v); return v.map(value => value / length); };
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);
const onSky = (v: readonly number[], line: readonly number[]) => unit(v.map((value, i) => value - dot(v, line) * line[i]!));

/** The Homunculus plates frame as prepared: its local axes are tilted against both the sky and the line of sight. */
const homunculus: DensityVolumeFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
  originM: [-34662603585005190000, 11756401314058086000, -62597823284558320000],
  localToReferenceXyzw: [-0.5623141049283225, 0.7844947792054218, 0.21252195592185388, -0.1523325541348456],
  metersPerUnit: 30856775814913670, boundsUnits: { min: [-.18, -.18, -.14], max: [.18, .18, .14] } };
/** Picture up of its photograph plane (corner 0 minus corner 3 of the prepared z-detail leaf). */
const homunculusPhotoUp = [0.03130456158881058 - 0.1790121635492047, 0.1794575479746773 + 0.03163274434119836, -0.07942881800317991 - 0.13688172264846798];
const rotated: DensityVolumeFrame = { ...homunculus, originM: [3e19, -4e19, 1.2e20], localToReferenceXyzw: unit([0.3, -0.2, 0.6, 0.71]) as never };

function view(frame: DensityVolumeFrame, upUnits?: readonly number[]) {
  const rotation = earthViewRotation(frame, upUnits);
  const { world } = inspectionCameraRenderer.publication(frame, rotation, 2, .2, { width: 1000, height: 800, focal: 1150 });
  const axes = worldRotationFromQuaternion(world.pose.orientationXyzw);
  return { toObject: unit(fromEyeM(world.pose, frame.originM)), forward: rotateWorldPosition(axes, [0, 0, -1]), up: rotateWorldPosition(axes, [0, 1, 0]) };
}
const local = (frame: DensityVolumeFrame, v: readonly number[]) => rotateWorldPosition(worldRotationFromQuaternion(frame.localToReferenceXyzw), [v[0]!, v[1]!, v[2]!]);

for (const [name, frame, upUnits] of [['Homunculus, photograph up', homunculus, homunculusPhotoUp], ['Homunculus, north up', homunculus, undefined],
  ['a rotated frame, north up', rotated, undefined]] as const) {
  test(`Earth view of ${name}: the eye looks from the Sun's side along the line of sight, up kept`, () => {
    const away = unit(frame.originM), seen = view(frame, upUnits);
    assert.ok(dot(seen.toObject, away) > 1 - 1e-9, `The eye is not on the Sun-ward line (${dot(seen.toObject, away)}).`);
    assert.ok(dot(seen.forward, away) > 1 - 1e-9, `The camera does not look along the line of sight (${dot(seen.forward, away)}).`);
    const expectedUp = onSky(upUnits ? local(frame, upUnits) : [0, 0, 1], away);
    assert.ok(dot(seen.up, expectedUp) > 1 - 1e-9, `Screen up is not the requested up (${dot(seen.up, expectedUp)}).`);
  });
}

test('the photograph up differs from north for the Homunculus, so the two Earth views differ only by a roll', () => {
  const photo = view(homunculus, homunculusPhotoUp), north = view(homunculus);
  const rollDeg = Math.acos(Math.min(1, dot(photo.up, north.up))) * 180 / Math.PI;
  // The prepared observation states north 34.98° counter-clockwise of the picture's up.
  assert.ok(Math.abs(rollDeg - 34.98) < .5, `Photograph roll ${rollDeg.toFixed(2)}° does not match the prepared observation.`);
  assert.ok(dot(photo.forward, north.forward) > 1 - 1e-12);
});
