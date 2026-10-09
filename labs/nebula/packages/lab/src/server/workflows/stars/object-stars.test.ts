import assert from 'node:assert/strict';
import test from 'node:test';
import { presentPhysicalPoseInVolume, cssViewFromOrientation, worldQuaternionFromRotation } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { fieldRadiusDeg, fieldStarPoints, MOST_CONE_DEG, objectSky, readCone, viewingSizePx } from './object-stars.ts';

const PC = 3.0856775814913673e16;
const unitAt = (raDeg: number, decDeg: number) => { const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180; return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)] as [number, number, number]; };
const at = (raDeg: number, decDeg: number, pc: number) => unitAt(raDeg, decDeg).map(value => value * pc * PC) as [number, number, number];
const star = (sourceId: string, overrides: Record<string, unknown> = {}) => ({ sourceId, raDeg: 120, decDeg: 30, pmRaMasYr: 1, pmDecMasYr: -1, parallaxMas: 10, parallaxErrorMas: .1,
  photGMeanMag: 12, bpRp: .8, ruwe: 1, distancePc: 100, distanceLowerPc: 99, distanceUpperPc: 101, ...overrides });
// A Cas A-like bank: 3.4 kpc away, 4 pc reach, its local axes turned off the ICRS ones.
const frame: DensityVolumeFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: at(350.85, 58.81, 3400),
  localToReferenceXyzw: [0.2046049773629414, 0.1743348855486145, 0.6246861957307384, 0.7331516267338697], metersPerUnit: PC, boundsUnits: { min: [-4, -4, -3], max: [4, 4, 3] } };
const cone = (stars: ReturnType<typeof star>[]) => ({ query: 'q', service: 'https://dc.g-vo.org/tap', retrievedAt: '2026-10-09T00:00:00Z', truncated: false, stars });

test('the object’s place on the sky comes from its frame origin, and its field from its reach', () => {
  const sky = objectSky(frame);
  assert.ok(Math.abs(sky.raDeg - 350.85) < 1e-9 && Math.abs(sky.decDeg - 58.81) < 1e-9 && Math.abs(sky.distancePc - 3400) < 1e-6);
  assert.ok(Math.abs(sky.extentPc - 4) < 1e-12);
  assert.ok(Math.abs(fieldRadiusDeg(sky) - Math.atan(1.5 * 4 / 3400) * 180 / Math.PI) < 1e-12);
  // A near nebula's field is held inside the widest cone.
  assert.equal(fieldRadiusDeg({ distancePc: 10, extentPc: 2 }), MOST_CONE_DEG);
  assert.throws(() => objectSky({ ...frame, referenceFrame: 'lab-image-relative-unscaled', originM: [0, 0, 0] }), /Sun-centred/);
});

test('the cone answer is read field by field', () => {
  const answer = cone([star('1')]);
  assert.equal(readCone(answer), answer);
  assert.throws(() => readCone(cone([star('1', { raDeg: '120' })])), /star 0/);
  assert.throws(() => readCone({ ...answer, truncated: 'no' }), /gaia-cone answer/);
});

test('every field star is drawn on the camera’s screen where the sky shows it, whatever its distance', () => {
  // Stars across the field at 100 pc (in front of the camera's place) and 10 kpc (far behind the nebula), and one outside it.
  const sky = objectSky(frame), field = fieldRadiusDeg(sky);
  const offsets = [[0, 0], [.3, .2], [-.5, .4], [.6, -.6], [-.2, -.7]].map(([east, north]) => [east! * field, north! * field] as const);
  const stars = offsets.flatMap(([east, north], index) => [100, 10000].map(distancePc => star(`${index}-${distancePc}`, {
    raDeg: sky.raDeg + east / Math.cos(sky.decDeg * Math.PI / 180), decDeg: sky.decDeg + north, distancePc, photGMeanMag: 10 + index })));
  stars.push(star('outside', { raDeg: sky.raDeg, decDeg: sky.decDeg + 2 * field }));
  const points = fieldStarPoints(frame, readCone(cone(stars)));
  assert.equal(points.length, 10);
  assert.ok(points.every(point => point.opacity === 1 && point.sizePx >= 2 && point.sizePx <= 9));
  // The lab's Earth view: the eye on the line toward the Sun, three bank radii from the origin, looking at it.
  const toSun = unitAt(sky.raDeg, sky.decDeg).map(value => -value);
  const eyeM = frame.originM.map((value, axis) => value + toSun[axis]! * 3 * 4 * PC) as [number, number, number];
  const forward = toSun.map(value => -value), north = unitAt(sky.raDeg, sky.decDeg + 90 - 1e-9);
  const up = north.map((value, axis) => value - forward[axis]! * north.reduce((sum, item, i) => sum + item * forward[i]!, 0));
  const upLength = Math.hypot(...up), screenUp = up.map(value => value / upLength);
  const right = [forward[1]! * screenUp[2]! - forward[2]! * screenUp[1]!, forward[2]! * screenUp[0]! - forward[0]! * screenUp[2]!, forward[0]! * screenUp[1]! - forward[1]! * screenUp[0]!];
  // The camera's axes in the reference frame, as a rotation's columns: x right, y up, z back (it looks down -z).
  const orientationXyzw = worldQuaternionFromRotation([right[0]!, screenUp[0]!, -forward[0]!, right[1]!, screenUp[1]!, -forward[1]!, right[2]!, screenUp[2]!, -forward[2]!]);
  const local = presentPhysicalPoseInVolume({ positionM: eyeM, orientationXyzw }, frame), rotation = cssViewFromOrientation(local.orientationXyzw);
  const screen = (position: readonly number[]) => {
    const [x, y, z] = position.map((value, axis) => value - local.positionUnits[axis]!) as [number, number, number];
    const depth = -(rotation[6]! * x + rotation[7]! * y + rotation[8]! * z);
    return { depth, x: (rotation[0]! * x + rotation[1]! * y + rotation[2]! * z) / depth, y: (rotation[3]! * x + rotation[4]! * y + rotation[5]! * z) / depth };
  };
  const centre = screen([0, 0, 0]);
  assert.ok(centre.depth > 0 && Math.abs(centre.x) < 1e-9 && Math.abs(centre.y) < 1e-9);
  points.forEach((point, index) => {
    const placed = screen(point.positionUnits), [east, north] = offsets[Math.floor(index / 2)]!;
    assert.ok(placed.depth > 0, `${point.id} is in front of the camera`);
    // On screen in the direction of its sky offset (east to the left, north up; within the meridians' convergence), and the
    // near and far copies on one place.
    const angle = Math.atan2(-placed.y, -placed.x), skyAngle = Math.atan2(north, east);
    if (east !== 0 || north !== 0) assert.ok(Math.abs(Math.atan2(Math.sin(angle - skyAngle), Math.cos(angle - skyAngle))) < 1e-2, point.id);
    const twin = screen(points[index ^ 1]!.positionUnits);
    assert.ok(Math.hypot(placed.x - twin.x, placed.y - twin.y) < 1e-9, `${point.id} sits on its sight line whatever its distance`);
  });
});

test('a brighter star is drawn larger, inside 2–9 px', () => {
  assert.equal(viewingSizePx(8), 9);
  assert.equal(viewingSizePx(15), 2);
  assert.equal(viewingSizePx(17), 2);
  assert.ok(viewingSizePx(11) > viewingSizePx(12));
});
