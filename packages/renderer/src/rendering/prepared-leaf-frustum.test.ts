import { expect, test } from 'vitest';
import { createPreparedLeafFrustum, preparedLeafMayContribute, validatePreparedLeafBounds } from './prepared-leaf-frustum.js';
import { compileLeafBounds } from '@cssearth/bake/volume-leaves';

const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const viewport = { focalPixels: 600, widthPixels: 1000, heightPixels: 800, principalOffsetPixels: [0, 0] as const };
const box = (x: number, y: number, z: number, radius = 1) => ({ min: [x-radius, y-radius, z-radius] as const, max: [x+radius, y+radius, z+radius] as const });

test('prepared image bounds include the compiled edge extension', () => {
  const bounds = compileLeafBounds('0,1,0,0,-2,0,0,0,0,0,1,0,10,20,30,1', 4, 3)!;
  expect(bounds).toEqual({ min: [4,20,30], max: [10,24,30] });
  expect(() => validatePreparedLeafBounds(bounds)).not.toThrow();
  expect(compileLeafBounds('1,0,0,0.1,0,1,0,0,0,0,1,0,0,0,0,1', 4, 3)).toBeUndefined();
});
test('five clip planes reject wholly outside bounds while retaining grazing and eye-crossing images', () => {
  const planes = createPreparedLeafFrustum(rotation, [0,0,0], viewport);
  for (const [x,y,z] of [[503,0,0],[-503,0,0],[0,403,0],[0,-403,0],[0,0,603]]) expect(preparedLeafMayContribute(box(x,y,z,0), planes)).toBe(false);
  for (const [x,y,z,r] of [[501,0,0,0],[-501,0,0,0],[0,401,0,0],[0,-401,0,0],[0,0,600,5],[0,0,0,0]]) expect(preparedLeafMayContribute(box(x,y,z,r), planes)).toBe(true);
});
test('off-axis perspective and finite translation affect clipping, with conservative legacy fallback', () => {
  const planes = createPreparedLeafFrustum(rotation, [300,0,0], { ...viewport, principalOffsetPixels: [200,0] });
  expect(preparedLeafMayContribute(box(0,0,0), planes)).toBe(true);
  expect(preparedLeafMayContribute(box(250,0,0), planes)).toBe(false);
  expect(preparedLeafMayContribute(undefined, planes)).toBe(true);
  expect(preparedLeafMayContribute(box(1e9,0,0), createPreparedLeafFrustum(rotation, [0,0,0], { focalPixels:600, principalOffsetPixels:[0,0] }))).toBe(true);
});
test('reject malformed prepared bounds', () => {
  for (const b of [{min:[0,0,0],max:[-1,0,0]}, {min:[0,0,0],max:[Infinity,0,0]}, {min:[0,0],max:[1,1,1]}, {min:[0,0,0],max:[1,1,1], extra:true}]) expect(() => validatePreparedLeafBounds(b)).toThrow();
});
