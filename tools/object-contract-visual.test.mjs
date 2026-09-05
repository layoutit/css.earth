import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assertSceneCoverage, compareCaptures, stableCapture } from "./object-contract-visual.mjs";
import { saturnSceneCoverage } from "./saturn-scene-coverage.mjs";

test("capture rejects an unstable stream and waits past an incomplete first frame", async () => {
  const options = { validate: (png) => assert.equal(png.toString(), "complete") };
  const frames = ["clipped", "complete", "complete", "complete"].map((value) => Buffer.from(value));
  const result = await stableCapture(async () => frames.shift(), options);
  assert.equal(result.attempts, 4);
  assert.equal(result.png.toString(), "complete");
  const lateFrames = [...Array.from({ length: 12 }, (_, index) => String(index % 2)), "complete", "complete", "complete"];
  const settled = await stableCapture(async () => Buffer.from(lateFrames.shift()), options);
  assert.equal(settled.attempts, 15);
  assert.equal(settled.png.toString(), "complete");
  let frame = 0;
  await assert.rejects(stableCapture(async () => Buffer.from(String(frame++)), options), /did not stabilize/);
  await assert.rejects(stableCapture(async () => Buffer.from("clipped")), /independent validator/);
});

test("persistent clipping cannot pass the independent Saturn coverage gate", async () => {
  for (const width of [390, 820, 1440]) for (const scale of [1, 2]) {
    const coverage = saturnSceneCoverage(width, scale);
    const raw = { width: coverage.width, height: coverage.height, channels: 3 };
    const complete = Buffer.alloc(raw.width * raw.height * 3, 120);
    const encode = (data) => sharp(data, { raw }).png().toBuffer();
    const validate = (png) => assertSceneCoverage(png, coverage);
    const png = await encode(complete);
    await stableCapture(async () => png, { validate });
    // Independently erase each body/ring probe, including the upper ring lost
    // in the old base capture. Identical baseline/candidate clips must fail.
    for (const region of coverage.regions) {
      const clipped = Buffer.from(complete);
      for (let y = region.y; y < region.y + region.height; y++) clipped.fill(0, (y * raw.width + region.x) * 3, (y * raw.width + region.x + region.width) * 3);
      const bad = await encode(clipped);
      assert.equal((await compareCaptures(bad, bad)).unexpectedPixels, 0);
      await assert.rejects(stableCapture(async () => bad, { validate }), /Incomplete scene/);
    }
  }
});

test("shell comparison allows marker pixels but rejects a missing scene tile", async () => {
  const raw = { width: 100, height: 100, channels: 3 };
  const reference = Buffer.alloc(100 * 100 * 3, 90);
  const png = (data) => sharp(data, { raw }).png().toBuffer();
  const markerChange = Buffer.from(reference);
  markerChange[0] = 0;
  const regions = [{ x: 0, y: 0, width: 4, height: 4 }];
  const allowed = await compareCaptures(await png(reference), await png(markerChange), regions);
  assert.equal(allowed.changedPixels, 1);
  assert.equal(allowed.unexpectedPixels, 0);
  assert.equal(allowed.excludedPixels, 16);
  // Same shape of failure as the rejected Saturn baseline: a missing rectangle
  // of renderer pixels, outside the small navigation marker regions.
  const clipped = Buffer.from(markerChange);
  for (let y = 20; y < 40; y++) clipped.fill(0, (y * 100 + 50) * 3, (y * 100 + 80) * 3);
  const invalid = await compareCaptures(await png(reference), await png(clipped), regions);
  assert.equal(invalid.unexpectedPixels, 600);
  const scene = await compareCaptures(await png(reference), await png(markerChange));
  assert.equal(scene.unexpectedPixels, 1);
  await assert.rejects(compareCaptures(await png(reference), await png(reference), [{ x: -1, y: 0, width: 4, height: 4 }]), /Invalid marker/);
});
