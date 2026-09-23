import { expect, test } from 'vitest';
import { createPreparedFacing, frontFacing, sceneEye } from './prepared-facing.js';
import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';

test('recovers the observer under rotation, translation and scene scale', () => {
  const r = [0, 0, 1, 0, 1, 0, -1, 0, 0];
  const p = physicalProjectionFromCamera(r, [-12, -8, 4], 2, { focalPixels: 600, principalOffsetPixels: [21, -7] });
  expect(sceneEye(p)).toEqual([2, 4, 6]);
  expect(frontFacing([0, 0, 1, -5], sceneEye(p)!)).toBe(true);
  expect(frontFacing([0, 0, -1, 5], sceneEye(p)!)).toBe(false);
  expect(frontFacing([0, 0, 1, -6.0000001], sceneEye(p)!)).toBe(true);
});

test('retained facing writes only transitions, preserves layout and restores visibility', () => {
  const writes: string[] = [];
  let visibility = '';
  const node = { style: { get visibility() { return visibility; }, set visibility(value) { visibility = value; writes.push(value); } } } as HTMLElement;
  const publish = createPreparedFacing([{ target: 0, plane: [0, 0, 1, 0], tolerance: 2 ** -23 }], [node]);
  const projection = (z: number) => physicalProjectionFromCamera([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, z], 1,
    { focalPixels: 600, principalOffsetPixels: [0, 0] });
  publish(projection(5)); publish(projection(5));
  expect(writes).toEqual(['hidden']);
  expect(node.style.display).toBeUndefined();
  publish(projection(-5)); publish(projection(-5));
  expect(writes).toEqual(['hidden', '']);
  publish(projection(5)); publish(projection(-5));
  expect(writes).toEqual(['hidden', '', 'hidden', '']);
});

test('keeps backfaces inside Chromium scale-dependent cofactor tolerance', () => {
  const node = { style: { visibility: '' } } as HTMLElement;
  const publish = createPreparedFacing([{ target: 0, plane: [0, 0, 1, 0], tolerance: 2 ** -23 }], [node]);
  const projection = (scale: number) => physicalProjectionFromCamera([1,0,0,0,1,0,0,0,1], [0,0,5 * scale], scale,
    { focalPixels: 600, principalOffsetPixels: [0,0] });
  // The observer and facing direction are identical. Only determinant scale
  // changes; the browser must retain the tiny transform's native raster edge.
  publish(projection(1)); expect(node.style.visibility).toBe('hidden');
  publish(projection(0.001)); expect(node.style.visibility).toBe('');
});
