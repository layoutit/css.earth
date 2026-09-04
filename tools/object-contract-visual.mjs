import assert from "node:assert/strict";
import sharp from "sharp";

// Stability alone is not completeness. Every caller must explicitly validate
// its settled frame; the scene audit uses independent pinned coverage probes.
export async function stableCapture(capture, { validate, maxAttempts = 24, requiredMatches = 3 } = {}) {
  assert.equal(typeof validate, "function", "Capture needs an independent validator");
  assert.ok(Number.isInteger(requiredMatches) && requiredMatches >= 2);
  assert.ok(Number.isInteger(maxAttempts) && maxAttempts >= requiredMatches);
  let previous, matches = 0;
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const png = await capture();
    matches = previous?.equals(png) ? matches + 1 : 1;
    if (matches >= requiredMatches) return { png, attempts, validation: await validate(png) };
    previous = png;
  }
  throw new Error(`Visual capture did not stabilize in ${maxAttempts} attempts.`);
}

// Physical-pixel probes must be fixed independently of the frames being tested.
// This is a missing-region sentinel, not whole-image or native-renderer parity.
export async function assertSceneCoverage(png, { width, height, regions, threshold = 60 }) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, width, "Scene coverage width changed");
  assert.equal(info.height, height, "Scene coverage height changed");
  assert.ok(regions.length > 0, "Scene coverage needs independent regions");
  return regions.map(({ name, x, y, width: w, height: h, minimumFraction }) => {
    assert.ok([x, y, w, h].every(Number.isInteger) && x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, "Invalid scene coverage region");
    assert.ok(minimumFraction > 0 && minimumFraction <= 1, "Invalid scene coverage floor");
    let visible = 0;
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const i = (row * width + col) * 4;
      if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold && data[i + 3] === 255) visible++;
    }
    const fraction = visible / (w * h);
    assert.ok(fraction >= minimumFraction, `Incomplete scene: ${name} coverage ${fraction.toFixed(4)} < ${minimumFraction}`);
    return { name, visible, pixels: w * h, fraction, minimumFraction };
  });
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
