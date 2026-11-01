import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invert3, planeToScreen, turnBetween, warpBetween, warpPlane, type CameraView } from './cloud-warp.js';

/** A camera on a sphere round the origin, turned about y by `degrees` and looking at the origin. */
const camera = (degrees: number, distance = 10): CameraView => {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { px: distance * s, py: 0, pz: distance * c, r: [c, 0, s, 0, -1, 0, -s, 0, c], focal: 500, centerX: 200, centerY: 300, width: 400, height: 600 };
};
const project = (v: CameraView, [x, y, z]: readonly number[]) => {
  const X = x! - v.px, Y = y! - v.py, Z = z! - v.pz, depth = -(v.r[2]! * X + v.r[5]! * Y + v.r[8]! * Z);
  return [v.focal * (v.r[0]! * X + v.r[3]! * Y + v.r[6]! * Z) / depth + v.centerX, v.focal * (v.r[1]! * X + v.r[4]! * Y + v.r[7]! * Z) / depth + v.centerY];
};
const disc = { right: [1, 0, 0], up: [0, 1, 0] };

test('the warp carries every point of its plane exactly where the new camera sees it', () => {
  const from = camera(10), to = camera(35, 8), inverse = invert3(planeToScreen(from, disc))!;
  const { h, held } = warpBetween(from, disc, inverse, to);
  assert.ok(held);
  for (const point of [[0, 0, 0], [2, 1, 0], [-3, 2, 0], [1, -3, 0]]) {
    const [x, y] = project(from, point), w = h[6] * x! + h[7] * y! + h[8], [X, Y] = project(to, point);
    assert.ok(Math.abs((h[0] * x! + h[1] * y! + h[2]) / w - X!) < 1e-6);
    assert.ok(Math.abs((h[3] * x! + h[4] * y! + h[5]) / w - Y!) < 1e-6);
  }
});

test('the plane is the disc, until the disc is seen nearly edge-on', () => {
  assert.equal(warpPlane(camera(30), disc, .35), disc);
  assert.notEqual(warpPlane(camera(80), disc, .35), disc);
  assert.deepEqual(warpPlane(camera(80), undefined, .35).up, [0, -1, 0]);
});

test('a turn past the plane no longer holds; a small one scales little', () => {
  const from = camera(0), plane = warpPlane(from, disc, .35), inverse = invert3(planeToScreen(from, plane))!;
  const near = warpBetween(from, plane, inverse, camera(2));
  assert.ok(near.held && near.scale < 1.1);
  assert.ok(!warpBetween(from, plane, inverse, camera(120)).held);
  assert.ok(Math.abs(turnBetween(camera(0), camera(30)) - Math.PI / 6) < 1e-9);
});
