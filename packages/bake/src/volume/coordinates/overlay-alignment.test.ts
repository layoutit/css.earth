import assert from 'node:assert/strict';
import { test } from 'vitest';
import { transferOverlayAlignment } from './overlay-alignment.ts';
import type { OverlayPlacement } from './overlay-placement.ts';

type Vec3 = [number, number, number];
const close = (actual: readonly number[], expected: readonly number[]) => actual.forEach((value, axis) =>
  assert.ok(Math.abs(value - expected[axis]!) < 1e-10, `axis ${axis}: ${value} !== ${expected[axis]}`));

function transformPoint(point: Vec3, pivot: Vec3, placement: OverlayPlacement, pixelsPerKpc: number): Vec3 {
  const radians = Math.PI / 180, [px, py, pz] = point.map((value, axis) => value - pivot[axis]!) as Vec3;
  const ax = placement.rotationX * radians, ay = placement.rotationY * radians, az = placement.rotationZ * radians;
  const x = px, y = Math.cos(ax) * py - Math.sin(ax) * pz, z = Math.sin(ax) * py + Math.cos(ax) * pz;
  const xx = Math.cos(ay) * x + Math.sin(ay) * z, zz = -Math.sin(ay) * x + Math.cos(ay) * z;
  const rotated = [Math.cos(az) * xx - Math.sin(az) * y, Math.sin(az) * xx + Math.cos(az) * y, zz];
  return rotated.map((value, axis) => pivot[axis]! + value * placement.scale +
    [placement.x, placement.y, placement.z][axis]! * pixelsPerKpc) as Vec3;
}

test('one affine alignment maps the same sky point identically around different image pivots', () => {
  const placement: OverlayPlacement = { x: 1.25, y: -2.5, z: .75,
    rotationX: 31, rotationY: -22, rotationZ: 47, scale: 1.8 };
  const referencePivot: Vec3 = [104, -38, 16], imagePivot: Vec3 = [-23, 71, -9], pixelsPerKpc = 20;
  const transferred = transferOverlayAlignment(placement, referencePivot, imagePivot, pixelsPerKpc);
  close(transformPoint(referencePivot, imagePivot, transferred, pixelsPerKpc),
    transformPoint(referencePivot, referencePivot, placement, pixelsPerKpc));
  assert.notDeepEqual([transferred.x, transferred.y, transferred.z], [placement.x, placement.y, placement.z],
    'pivot compensation must include the scale and 3D rotation');
});

test('alignment rejects a placement missing any affine property', () => {
  const placement: OverlayPlacement = { x: 1, y: 2, z: 3, rotationX: 4, rotationY: 5, rotationZ: 6, scale: 2 };
  for (const key of Object.keys(placement) as (keyof OverlayPlacement)[]) {
    const mutant = { ...placement } as Partial<OverlayPlacement>;
    delete mutant[key];
    assert.throws(() => transferOverlayAlignment(mutant as OverlayPlacement, [1, 2, 3], [4, 5, 6], 10),
      /finite positions and angles, and a positive size/, `missing ${key} must fail`);
  }
});
