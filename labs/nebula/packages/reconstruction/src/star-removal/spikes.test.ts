import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeSpikedStars } from './spikes.ts';

test('a bright star and its six spikes are taken out, and a red filament the spikes cross keeps its light', () => {
  const W = 400, H = 400, cx = 200, cy = 200, original = new Uint8Array(W * H * 3);
  const put = (img: Uint8Array, x: number, y: number, rgb: readonly number[]) => { const p = (y * W + x) * 3; for (let c = 0; c < 3; c++) img[p + c] = Math.min(255, img[p + c]! + rgb[c]!); };
  // A dim sky, a red filament down the column x = 300, and a saturated star with spikes on lines at 0, 60 and 120 degrees.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { put(original, x, y, [10, 10, 12]); if (Math.abs(x - 300) <= 1) put(original, x, y, [150, 40, 30]); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = Math.hypot(x - cx, y - cy); if (r < 8) put(original, x, y, [245, 245, 255]); else if (r < 40) put(original, x, y, [30, 40, 120].map(v => v * 8 / r)); }
  for (const deg of [0, 60, 120, 180, 240, 300]) for (let r = 8; r < 190; r += 0.25) for (const d of [-1, 0, 1]) {
    const t = deg * Math.PI / 180, x = Math.round(cx + r * Math.cos(t) - d * Math.sin(t)), y = Math.round(cy - r * Math.sin(t) - d * Math.cos(t));
    if (x >= 0 && y >= 0 && x < W && y < H) { const p = (y * W + x) * 3, light = 90 * Math.max(0.2, 1 - r / 200); original[p] = Math.max(original[p]!, 10 + light * 0.4); original[p + 1] = Math.max(original[p + 1]!, 10 + light * 0.6); original[p + 2] = Math.max(original[p + 2]!, 12 + light); }
  }
  // NOX's copy: the core hollowed, the spikes left.
  const starless = Uint8Array.from(original); for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) if (Math.hypot(x - cx, y - cy) < 8) { const p = (y * W + x) * 3; starless[p] = 20; starless[p + 1] = 20; starless[p + 2] = 30; }
  const result = removeSpikedStars(starless, original, W, H, 3, 0.8);
  assert.equal(result.stars.length, 1);
  assert.ok(result.angles.length === 3 && [0, 60, 120].every((deg, i) => Math.abs(result.angles[i]! - deg) <= 1), `the spikes lie at ${result.angles.join(", ")}°`);
  const blue = (x: number, y: number) => starless[(y * W + x) * 3 + 2]!;
  // Along every spike, 60 px out, the blue is back near the sky's.
  for (const deg of [0, 60, 120, 180, 240, 300]) { const t = deg * Math.PI / 180, x = Math.round(cx + 60 * Math.cos(t)), y = Math.round(cy - 60 * Math.sin(t)); assert.ok(blue(x, y) < 25, `the spike at ${deg}° keeps ${blue(x, y)} of blue`); }
  // The filament where the 0° spike crosses it keeps its red.
  assert.ok(starless[(cy * W + 300) * 3]! >= 150, `the filament keeps ${starless[(cy * W + 300) * 3]} of red`);
});
