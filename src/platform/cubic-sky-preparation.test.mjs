import assert from "node:assert/strict";
import test from "node:test";

import { prepareStandardCubicSkyPixels } from
  "./cubic-sky-preparation.mjs";

test("prepares a quieter sky without changing high-contrast source pixels", () => {
  const highContrast = Buffer.from([
    220, 90, 40,
    120, 160, 240,
    0, 0, 0,
  ]);
  const original = Buffer.from(highContrast);
  const standard = prepareStandardCubicSkyPixels(highContrast);

  assert.deepEqual(highContrast, original);
  assert.notEqual(standard, highContrast);
  assert.deepEqual([...standard.slice(6)], [0, 0, 0]);
  assert.ok(luminance(standard, 0) < luminance(highContrast, 0));
  assert.ok(luminance(standard, 3) < luminance(highContrast, 3));
  assert.ok(chroma(standard, 0) < chroma(highContrast, 0));
  assert.ok(chroma(standard, 3) < chroma(highContrast, 3));
});

test("rejects malformed cubic-sky pixel buffers", () => {
  assert.throws(
    () => prepareStandardCubicSkyPixels(Buffer.from([0, 0])),
    /invalid/u,
  );
  assert.throws(
    () => prepareStandardCubicSkyPixels(new Uint8Array([0, 0, 0])),
    /invalid/u,
  );
});

function luminance(pixels, offset) {
  return 0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] +
    0.0722 * pixels[offset + 2];
}

function chroma(pixels, offset) {
  const channels = [...pixels.slice(offset, offset + 3)];
  return Math.max(...channels) - Math.min(...channels);
}
