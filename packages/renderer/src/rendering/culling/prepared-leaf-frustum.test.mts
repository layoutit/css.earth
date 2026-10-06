import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedLeafBounds } from '@cssearth/objects';
import { createPreparedLeafFrustum, preparedLeafMayContribute } from './prepared-leaf-frustum.ts';

const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const viewport = { focalPixels: 600, widthPixels: 1000, heightPixels: 800, principalOffsetPixels: [0, 0] as const };
const box = (x: number, y: number, z: number, radius = 1) => {
  const bounds = { min: [x-radius, y-radius, z-radius] as const, max: [x+radius, y+radius, z+radius] as const };
  validatePreparedLeafBounds(bounds); return bounds;
};

test('five clip planes reject wholly outside bounds while retaining grazing and eye-crossing images', () => {
  const planes = createPreparedLeafFrustum(rotation, [0,0,0], viewport);
  for (const [x,y,z] of [[503,0,0],[-503,0,0],[0,403,0],[0,-403,0],[0,0,603]]) assert.equal(preparedLeafMayContribute(box(x,y,z,0), planes), false);
  for (const [x,y,z,r] of [[501,0,0,0],[-501,0,0,0],[0,401,0,0],[0,-401,0,0],[0,0,600,5],[0,0,0,0]]) assert.equal(preparedLeafMayContribute(box(x,y,z,r), planes), true);
});
test('off-axis perspective and finite translation affect clipping, with conservative legacy fallback', () => {
  const planes = createPreparedLeafFrustum(rotation, [300,0,0], { ...viewport, principalOffsetPixels: [200,0] });
  assert.equal(preparedLeafMayContribute(box(0,0,0), planes), true);
  assert.equal(preparedLeafMayContribute(box(250,0,0), planes), false);
  assert.equal(preparedLeafMayContribute(undefined, planes), true);
  assert.equal(preparedLeafMayContribute(box(1e9,0,0), createPreparedLeafFrustum(rotation, [0,0,0], { focalPixels:600, principalOffsetPixels:[0,0] })), true);
});
