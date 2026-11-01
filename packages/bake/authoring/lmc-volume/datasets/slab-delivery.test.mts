import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slabLeaf, SLAB_BOX_DIVISOR, SLAB_IMAGE_DIVISOR } from './slab-delivery.mts';

const leaf = { id: 'x-5', centerUnits: [1, 0, 0], texturePath: 'l36-near/x/005.png', widthPx: 2054, heightPx: 436, boundsCssPixels: { min: [0, 0, 0], max: [1, 1, 1] },
  style: { width: '1027px', height: '218px', transform: 'matrix3d(0.97773,0,0,0,0,0,-0.982248,0,0,-1,0,0,-502.064844,50,107.065116,1)', backgroundSize: '1027px 218px', backgroundPosition: '0px 0px' } } as never;
const corner = (s: { width: string; height: string; transform: string }) => { const m = s.transform.slice(9, -1).split(',').map(Number), w = parseFloat(s.width), h = parseFloat(s.height); return [0, 1, 2].map(i => m[12 + i]! + w * m[i]! + h * m[4 + i]!); };

test('a slab keeps its place on screen with a smaller box and image', () => {
  const next = slabLeaf(leaf) as never as typeof leaf & { style: { width: string; height: string; transform: string; backgroundSize: string }; widthPx: number };
  assert.equal(next.style.width, `${Math.round(1027 / SLAB_BOX_DIVISOR)}px`);
  assert.equal(next.style.backgroundSize, `${next.style.width} ${next.style.height}`);
  assert.equal(next.widthPx, 2054 / SLAB_IMAGE_DIVISOR);
  corner(next.style).forEach((v, i) => assert.ok(Math.abs(v - corner((leaf as never as { style: typeof next.style }).style)[i]!) < 1e-3));
});
