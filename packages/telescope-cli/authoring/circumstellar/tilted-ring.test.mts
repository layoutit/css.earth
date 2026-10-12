import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileDiscDensity, type DiscModel, type SkyPlane } from './disc-envelope.mts';
import { rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/engine';
import { normaliseColumns } from './disc-aligned-grid.mts';
import { RING_SHEETS_PER_HEIGHT, measureTiltedRing, mutualTiltDeg, parseTiltedRing, planeNormal, reachAbovePlane, ringLightBeyond, tiltedRingDensity, tiltedRingGrid, type TiltedRing } from './tilted-ring.mts';

const ring: TiltedRing = { citation: 'a paper', url: 'https://example.org/paper', inclinationDeg: 25, positionAngleDeg: 105, nearSidePositionAngleDeg: 195, nearSideSource: 'its figure',
  skyCentreArcsec: [0.2, -0.1], skyCentreSource: 'its table', heightUnits: 0.6, heightSource: 'its model' };
const outer = { inclinationDeg: 37, positionAngleDeg: 0, nearSidePositionAngleDeg: 90 };

test('a plane tilts its stated side toward the observer', () => {
  // Height above the plane is -x e + y n + z t for a sky point x west, y north, z toward the observer.
  const depthAt = (plane: typeof outer, east: number, north: number) => { const [e, n, t] = planeNormal(plane); return -(east * e + north * n) / t; };
  assert.ok(depthAt(outer, 1, 0) > 0 && depthAt(outer, -1, 0) < 0, 'the eastern side of the outer plane is nearer');
  assert.ok(Math.abs(depthAt(outer, 0, 1)) < 1e-12, 'its line of nodes runs north to south');
  assert.ok(depthAt(ring, 0, -1) > 0 && depthAt(ring, 0, 1) < 0, 'the southern side of the ring is nearer');
  // Both node conventions of one line give the same plane.
  planeNormal({ ...outer, positionAngleDeg: 180 }).forEach((value, axis) => assert.ok(Math.abs(value - planeNormal(outer)[axis]!) < 1e-12));
});

test('the angle between two planes is the one their inclinations and nodes give', () => {
  // cos = cos i1 cos i2 + sin i1 sin i2 cos(node difference), for inclinations 155 and 143 with nodes 105 degrees apart.
  const d = Math.PI / 180, expected = Math.acos(Math.cos(155 * d) * Math.cos(143 * d) + Math.sin(155 * d) * Math.sin(143 * d) * Math.cos(105 * d)) / d;
  assert.ok(Math.abs(mutualTiltDeg(ring, outer) - expected) < 1e-9);
  assert.ok(Math.abs(expected - 48.85) < 0.01);
});

test('the ring is the light above its gap, and no more', () => {
  // A sky of one flat level with a gaussian ring about an offset centre, and a brighter outer ring past a gap.
  const size = 128, halfUnits = 32, step = 0.5, level = 2, cx = -0.2, cy = -0.1, plane = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, s = Math.hypot(x - cx, y - cy);
    plane[j * size + i] = level + 40 * Math.exp(-(((s - 6) / 1) ** 2) / 2) + 10 * Math.exp(-(((Math.hypot(x, y) - 24) / 2) ** 2) / 2);
  }
  const sky: SkyPlane = { size, halfUnits, step, plane, background: 0, noise: 1, backgroundPixels: 0, mosaicArcsecPerPixel: 1, starPixel: [0, 0], unit: '' };
  const measure = measureTiltedRing(sky, ring, 1, 24);
  assert.ok(Math.abs(measure.ridgeUnits - 6) <= step && measure.endsUnits > 9 && measure.endsUnits < 20);
  assert.ok(Math.abs(measure.gapLevel - level) < 0.05, `the gap level is the flat level: ${measure.gapLevel}`);
  assert.ok(Math.abs(measure.brightness(cx + 6, cy) - 40) < 1.5 && measure.brightness(cx + measure.endsUnits + step, cy) === 0);
  // Along one sight line through the ridge, the ring's integral stands to a disc of that level as 40 stands to the level.
  const model: DiscModel = { radiusUnits: 24, gaussianWidthUnits: 2, gaussianHeightUnits: 0.4, centreUnits: [0, 0], ...outer };
  const disc = profileDiscDensity(model, [{ radiusUnits: 0, value: level }, { radiusUnits: 30, value: level }]), tilted = tiltedRingDensity(ring, measure, model);
  let discColumn = 0, ringColumn = 0;
  for (let z = -30; z <= 30; z += 0.01) { discColumn += disc(cx + 6, cy, z); ringColumn += tilted(cx + 6, cy, z); }
  assert.ok(Math.abs(ringColumn / discColumn / (measure.brightness(cx + 6, cy) / level) - 1) < 0.01, `the columns stand as ${ringColumn / discColumn}`);
  // The ridge of radius 6, on planes 49 degrees apart, climbs at most 6 sin 49 / cos 25 from the other plane, plus three heights.
  const reach = reachAbovePlane(ring, measure, outer), d = Math.PI / 180, climb = 6 * Math.sin(mutualTiltDeg(ring, outer) * d) / Math.cos(25 * d);
  assert.ok(reach > climb && reach < climb + 3 * ring.heightUnits + 1.2, `the ridge reaches ${reach}`);
  // A grid as tall as that leaves out only the faint skirt beyond the ridge; a short one cuts the ring, a tall one nothing.
  const cut = (halfHeight: number) => ringLightBeyond(sky, ring, measure, outer, halfHeight);
  assert.ok(cut(reach) > 0 && cut(reach) < 0.02, `past the ridge's reach: ${cut(reach)}`);
  assert.ok(cut(2) > 0.3 && cut(2) < 1, `a grid 2 units tall: ${cut(2)}`);
  assert.ok(cut(40) < 1e-9);
});

test('a tilted ring states its plane, its centre and its height', () => {
  assert.deepEqual(parseTiltedRing({ ...ring }, 'ring'), ring);
  assert.throws(() => parseTiltedRing({ ...ring, heightUnits: 0 }, 'ring'), /positive height/);
  assert.throws(() => parseTiltedRing({ ...ring, skyCentreArcsec: [0.2] }, 'ring'));
});

test('the ring\'s own grid lies on its plane and is cut into close sheets', () => {
  const size = 64, halfUnits = 32, step = 1, plane = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step;
    plane[j * size + i] = 2 + 40 * Math.exp(-(((Math.hypot(x, y) - 6) / 1.5) ** 2) / 2) + 10 * Math.exp(-(((Math.hypot(x, y) - 24) / 2) ** 2) / 2);
  }
  const sky: SkyPlane = { size, halfUnits, step, plane, background: 0, noise: 1, backgroundPixels: 0, mosaicArcsecPerPixel: 1, starPixel: [0, 0], unit: '' };
  const centred = { ...ring, skyCentreArcsec: [0, 0] as const }, measure = measureTiltedRing(sky, centred, 1, 24);
  const share = tiltedRingDensity(centred, measure, { gaussianHeightUnits: 0.4, inclinationDeg: 37 });
  const own = tiltedRingGrid(sky, [plane], share, centred, measure, share, normaliseColumns(sky, [plane], share));
  // Six heights either side, four sheets to a height.
  assert.equal(own.sheets, 48); assert.equal(own.sheetsApartUnits, centred.heightUnits / RING_SHEETS_PER_HEIGHT);
  assert.equal(own.grid.bounds.max[2], 6 * centred.heightUnits);
  assert.ok(Math.abs(own.grid.bounds.max[2] * 2 / own.sheets - own.sheetsApartUnits) < 1e-12);
  // The grid's z is the ring's normal, x west.
  const normal = rotateWorldPosition(worldRotationFromQuaternion(own.grid.frame.localToReferenceXyzw), [0, 0, 1]), [east, north, toward] = planeNormal(centred);
  assert.ok(Math.abs(normal[0] + east) < 1e-9 && Math.abs(normal[1] - north) < 1e-9 && Math.abs(normal[2] - toward) < 1e-9);
  assert.ok(own.grid.peak > 0 && own.grid.filledVoxels > 0 && own.grid.bounds.max[0] < halfUnits);
});
