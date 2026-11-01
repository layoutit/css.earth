import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PreparedCssVolume } from '@cssearth/objects';
import { slabLeaf, SLAB_BOX_DIVISOR, SLAB_IMAGE_DIVISOR } from './slab-delivery.mts';

const leaf = {
  id: 'x-5',
  centerUnits: [1, 0, 0],
  texturePath: 'l36-near/x/005.png',
  widthPx: 2054,
  heightPx: 436,
  boundsCssPixels: { min: [0, 0, 0], max: [1, 1, 1] },
  style: {
    width: '1027px',
    height: '218px',
    transform: 'matrix3d(0.97773,0,0,0,0,0,-0.982248,0,0,-1,0,0,-502.064844,50,107.065116,1)',
    backgroundSize: '1027px 218px',
    backgroundPosition: '0px 0px',
  },
} as unknown as PreparedCssVolume['stacks'][number]['leaves'][number];
const corner = (s: { width: string; height: string; transform: string }) => {
  const m = s.transform.slice(9, -1).split(',').map(Number),
    w = parseFloat(s.width),
    h = parseFloat(s.height);
  return [0, 1, 2].map(i => m[12 + i]! + w * m[i]! + h * m[4 + i]!);
};

const SOURCE = { width: 2054, height: 436 };

test('a slab keeps its place on screen with a smaller box and image', () => {
  const next = slabLeaf(leaf, SOURCE);
  assert.equal(next.style.width, `${Math.round(1027 / SLAB_BOX_DIVISOR)}px`);
  assert.equal(next.style.backgroundSize, `${next.style.width} ${next.style.height}`);
  assert.equal(next.widthPx, 2054 / SLAB_IMAGE_DIVISOR);
  corner(next.style).forEach((v, i) => assert.ok(Math.abs(v - corner(leaf.style)[i]!) < 1e-3));
});

test('a slab already in this form installs unchanged', () => {
  const once = slabLeaf(leaf, SOURCE);
  assert.deepEqual(slabLeaf(once, SOURCE), once);
});
