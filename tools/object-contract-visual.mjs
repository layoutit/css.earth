import assert from "node:assert/strict";
import sharp from "sharp";

// Require repeated identical captures. The caller supplies the bounded settling
// interval so unit tests do not need a browser or timers.
export async function stableCapture(capture, { maxAttempts = 24, requiredMatches = 3 } = {}) {
  assert.ok(Number.isInteger(requiredMatches) && requiredMatches >= 2);
  assert.ok(Number.isInteger(maxAttempts) && maxAttempts >= requiredMatches);
  let previous, matches = 0;
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const png = await capture();
    matches = previous?.equals(png) ? matches + 1 : 1;
    if (matches >= requiredMatches) return { png, attempts };
    previous = png;
  }
  throw new Error(`Visual capture did not stabilize in ${maxAttempts} attempts.`);
}

// Regions are physical-pixel rectangles for intentional marker-raster changes
// only. Keep the raw diff, and count every changed pixel outside those rectangles.
export async function compareCaptures(reference, candidate, regions = []) {
  const a = await sharp(reference).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(candidate).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(a.info, b.info, "Capture dimensions changed");
  const { width, height } = a.info;
  const mask = new Uint8Array(width * height);
  for (const { x, y, width: w, height: h } of regions) {
    assert.ok([x, y, w, h].every(Number.isInteger) && x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, "Invalid marker exclusion");
    for (let row = y; row < y + h; row++) mask.fill(1, row * width + x, row * width + x + w);
  }
  const diff = Buffer.alloc(a.data.length);
  let changedPixels = 0, unexpectedPixels = 0;
  for (let i = 0; i < diff.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 3; c++) {
      diff[i + c] = Math.abs(a.data[i + c] - b.data[i + c]);
      changed ||= diff[i + c] !== 0;
    }
    diff[i + 3] = 255;
    changedPixels += Number(changed);
    unexpectedPixels += Number(changed && !mask[i / 4]);
  }
  return {
    changedPixels, unexpectedPixels,
    excludedPixels: mask.reduce((sum, pixel) => sum + pixel, 0),
    diff: await sharp(diff, { raw: a.info }).png().toBuffer(),
  };
}
