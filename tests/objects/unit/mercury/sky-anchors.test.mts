import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import sharp from "sharp";

import {
  ESO_PANORAMA,
  ESO_PANORAMA_ANCHORS,
} from "../../../../src/platform/eso-panorama-registration.mts";

// Re-measures the anchor pixel positions recorded in the panorama
// registration against the acquired ESO image, so the registration can never
// drift from the source it claims to describe. Skipped when the reacquirable
// image is absent (it is not tracked); `pnpm acquire:planets` restores it.
const PANORAMA_PATH = fileURLToPath(new URL(
  "../../../../src/objects/mercury/source/stars/eso0932a.tif",
  import.meta.url,
));
const SCALE = 4;

test("the registered anchor blobs sit where the ESO panorama has them", async (context) => {
  try {
    await access(PANORAMA_PATH);
  } catch {
    context.skip("ESO panorama not acquired");
    return;
  }
  const width = ESO_PANORAMA.size[0] / SCALE;
  const height = ESO_PANORAMA.size[1] / SCALE;
  const { data, info } = await sharp(PANORAMA_PATH).removeAlpha()
    .resize(width, height).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3);
  const luminance = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    luminance[index] = (data[index * 3] + data[index * 3 + 1] +
      data[index * 3 + 2]) / 3;
  }
  // Compact extended objects stand out as local mean minus wide mean.
  const detail = subtract(
    boxBlur(luminance, width, height, 6),
    boxBlur(luminance, width, height, 30),
  );
  for (const anchor of ESO_PANORAMA_ANCHORS) {
    const expectedX = anchor.pixel[0] / SCALE;
    const expectedY = anchor.pixel[1] / SCALE;
    let peak = -Infinity;
    let peakX = 0;
    let peakY = 0;
    const search = 40;
    for (let dy = -search; dy <= search; dy += 1) {
      for (let dx = -search; dx <= search; dx += 1) {
        const x = (Math.round(expectedX) + dx + width) % width;
        const y = Math.round(expectedY) + dy;
        if (y < 0 || y >= height) continue;
        const value = detail[y * width + x];
        if (value > peak) {
          peak = value;
          peakX = Math.round(expectedX) + dx;
          peakY = y;
        }
      }
    }
    // A real blob, not noise, within 1.5 degrees (6 px here) of the record.
    assert.ok(peak > 8, `${anchor.name}: detail peak ${peak}`);
    assert.ok(Math.hypot(peakX - expectedX, peakY - expectedY) <= 6,
      `${anchor.name}: found at ${peakX * SCALE}, ${peakY * SCALE}, ` +
      `recorded ${anchor.pixel}`);
  }
});

function boxBlur(source: number[]|Float32Array<ArrayBuffer>, width: number, height: number, radius: number) {
  const rows = new Float32Array(width * height);
  const size = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let d = -radius; d <= radius; d += 1) {
      sum += source[y * width + ((d + width) % width)];
    }
    for (let x = 0; x < width; x += 1) {
      rows[y * width + x] = sum / size;
      sum += source[y * width + ((x + radius + 1) % width)] -
        source[y * width + ((x - radius + width) % width)];
    }
  }
  const output = new Float32Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let sum = 0;
      let count = 0;
      for (let d = -radius; d <= radius; d += 1) {
        const row = y + d;
        if (row < 0 || row >= height) continue;
        sum += rows[row * width + x];
        count += 1;
      }
      output[y * width + x] = sum / count;
    }
  }
  return output;
}

function subtract(a:Float32Array, b:Float32Array) {
  const output = new Float32Array(a.length);
  for (let index = 0; index < a.length; index += 1) {
    output[index] = a[index] - b[index];
  }
  return output;
}
