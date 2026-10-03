import assert from 'node:assert/strict';
import test from 'node:test';
import { removeStarHaloes } from './haloes.ts';

// A 240 px picture: a target whose light falls off from the centre, on a sky of 20, with one bright star's glow.
const width = 240, height = 240, centre: [number, number] = [120, 120];
const target = (x: number, y: number) => 20 + 80 * Math.exp(-Math.hypot(x - centre[0], y - centre[1]) / 30);
const picture = (glowAt?: [number, number]) => {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const glow = glowAt ? 120 * Math.exp(-Math.hypot(x - glowAt[0], y - glowAt[1]) / 5) : 0;
    rgb.fill(Math.round(Math.min(255, target(x, y) + glow)), (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  return rgb;
};
const at = (rgb: Uint8Array, x: number, y: number) => rgb[(y * width + x) * 3]!;

test('a bright star\'s glow is measured on the picture and filled from the ring around it', () => {
  const rgb = picture([190, 120]), before = Uint8Array.from(rgb);
  const [removal] = removeStarHaloes(rgb, width, height, [{ id: 'star', x: 190, y: 120, gMag: 9 }], centre);
  assert.equal(removal?.outcome, 'filled');
  assert.ok(removal!.radiusPx! >= 15 && removal!.radiusPx! <= 36, `radius ${removal!.radiusPx}`);
  // The glow stood 120 levels above the target's light; what replaces it is within a few levels of that light.
  assert.equal(at(before, 190, 120), Math.round(target(190, 120) + 120));
  assert.ok(Math.abs(at(rgb, 190, 120) - target(190, 120)) <= 4, `${at(rgb, 190, 120)} against ${target(190, 120)}`);
  // Nothing outside the filled radius changes.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    if (Math.hypot(x - 190, y - 120) >= removal!.radiusPx!) assert.equal(at(rgb, x, y), at(before, x, y));
});

test('a star with no glow left is not touched, and one at the picture\'s edge is reported', () => {
  const rgb = picture(), before = Uint8Array.from(rgb);
  const removals = removeStarHaloes(rgb, width, height, [{ id: 'faint', x: 60, y: 200, gMag: 13.5 }, { id: 'edge', x: 1, y: 120, gMag: 8 }], centre);
  assert.deepEqual(removals.map(removal => [removal.id, removal.outcome]), [['edge', 'at-the-edge'], ['faint', 'nothing-left']]);
  assert.deepEqual(rgb, before);
});

test('a buffer of the wrong size is refused', () => {
  assert.throws(() => removeStarHaloes(new Uint8Array(10), width, height, [], centre), /not 240 x 240 packed RGB/);
});

test('a glow NOX hollowed into a ring is still found and filled', () => {
  // The star's centre is back at the target's light; a ring of glow 14 px out is left.
  const rgb = picture(), before = Uint8Array.from(rgb);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ring = 60 * Math.exp(-(((Math.hypot(x - 190, y - 120) - 14) / 4) ** 2));
    rgb[(y * width + x) * 3] = Math.round(Math.min(255, at(before, x, y) + ring));
  }
  const [removal] = removeStarHaloes(rgb, width, height, [{ id: 'hollow', x: 190, y: 120, gMag: 10 }], centre);
  assert.equal(removal?.outcome, 'filled');
  assert.ok(Math.abs(at(rgb, 204, 120) - target(204, 120)) <= 4, `${at(rgb, 204, 120)} against ${target(204, 120)}`);
});
