import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMapSpherePreview, mapSpherePreviewRays } from './map-sphere-preview.ts';

// Every surface point is one grey; the northern (+z) half is what a cutaway opens.
const view = { sizePx: 16, elevationDeg: 0, azimuthDeg: 0, samples: 1 };
const rays = mapSpherePreviewRays(view), grey = new Uint8Array(rays.near.length).fill(200);
const pixel = (rgba: Buffer, x: number, y: number) => [...rgba.subarray((y * view.sizePx + x) * 4, (y * view.sizePx + x) * 4 + 4)];
const compose = (cut: Parameters<typeof composeMapSpherePreview>[0]['cut']) =>
  composeMapSpherePreview({ view, rays, nearColours: grey, farColours: grey, limb: null, cut });

test('the whole shell is opaque inside its outline and transparent outside it', () => {
  const whole = compose(null);
  assert.deepEqual(pixel(whole, 8, 12), [200, 200, 200, 255]);
  assert.equal(pixel(whole, 0, 0)[3], 0);
});

test('a cutaway shows the open half as the inside wall and the rest at the outside opacity', () => {
  const cut = compose({ hemisphere: 'north', interiorOpacity: 0.5, exteriorOpacity: 0.75 });
  // Seen edge-on from the equator, the upper half is open: only the far wall's inside, the southern half, is behind it.
  // Straight ahead through the opening the far wall is northern too, so nothing is drawn there but black space.
  assert.deepEqual(pixel(cut, 8, 3), [0, 0, 0, 255]);
  // Below the equator the outside (75%) covers the inside copy (50%) over black: 200 * (0.75 + 0.25 * 0.5).
  assert.deepEqual(pixel(cut, 8, 12), [175, 175, 175, 255]);
});
