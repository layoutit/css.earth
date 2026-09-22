import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import cwebpPath from "cwebp-bin";
import sharp from "sharp";
import {
  optimizePreparedDisplayLosslessWebp,
  optimizePreparedLosslessWebp,
} from "./prepared-webp.mts";

assert.equal(typeof cwebpPath, 'string');
const encoder = String(cwebpPath);
const run = promisify(execFile);

test("lossless optimization preserves transparent RGB consumed by later edge interpolation", async t => {
  const directory = await mkdtemp(resolve(tmpdir(), "cssearth-prepared-webp-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const width = 64, height = 64, raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgba = x < 32 ? [180, 110, 45, 255] : [222, 195, 255, 0];
    raw.set(rgba, (y * width + x) * 4);
  }
  const source = resolve(directory, "source.png"), input = resolve(directory, "input.webp");
  await sharp(raw, { raw: { width, height, channels: 4 } }).png().toFile(source);
  await run(encoder, ["-quiet", "-lossless", "-m", "0", "-exact", source, "-o", input]);
  const decode = () => sharp(input).ensureAlpha().raw().toBuffer();
  const original = await decode();
  assert.deepEqual(original, raw, "the fixture must retain its fully transparent RGB");
  // This is the existing preparation contract: interpolate unassociated RGBA
  // across the edge, then composite the sample. Clearing hidden RGB changes the
  // visible result even though each source texel looks unchanged in isolation.
  const visibleEdge = (data: Uint8Array) => {
    const left = (32 * width + 31) * 4, right = left + 4;
    const alpha = (data[left + 3] + data[right + 3]) / (2 * 255);
    return [0, 1, 2].map(channel => (data[left + channel] + data[right + channel]) / 2 * alpha);
  };
  const expected = visibleEdge(original);
  const result = await optimizePreparedLosslessWebp(input), optimized = await decode();
  assert.deepEqual(visibleEdge(optimized), expected, "optimization changed a visible prepared edge");
  assert.deepEqual(optimized, original, "lossless preparation must preserve every RGBA byte");
  assert.ok(result.savedBytes >= 0);
  assert.equal((await readdir(directory)).filter(name => name.includes("candidate")).length, 0);
  const first = await readFile(input);
  await optimizePreparedLosslessWebp(input);
  assert.deepEqual(await readFile(input), first, "repeat optimization must retain the accepted output");
});

test("terminal display policy retains the established encoded bytes and visible RGBA", async t => {
  const directory = await mkdtemp(resolve(tmpdir(), "cssearth-display-webp-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const width = 64, height = 64, raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    raw.set(x < 32 ? [180, 110, 45, 255] : [x * 7 % 256, y * 11 % 256, (x + y) * 13 % 256, 0], (y * width + x) * 4);
  }
  const source = resolve(directory, "source.png"), input = resolve(directory, "input.webp");
  const established = resolve(directory, "established.webp");
  await sharp(raw, { raw: { width, height, channels: 4 } }).png().toFile(source);
  await run(encoder, ["-quiet", "-lossless", "-m", "0", "-exact", source, "-o", input]);
  const before = await readFile(input);
  // This is the pre-existing terminal display command, independent of the API.
  await run(encoder, ["-quiet", "-lossless", "-z", "9", input, "-o", established]);
  const candidate = await readFile(established);
  assert.ok(candidate.length < before.length, "the fixture must exercise publication of the display encoding");
  const expected = candidate.length < before.length ? candidate : before;
  await optimizePreparedDisplayLosslessWebp(input);
  assert.deepEqual(await readFile(input), expected, "the accepted display encoding changed");
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer();
  for (let offset = 0; offset < raw.length; offset += 4) {
    assert.equal(decoded[offset + 3], raw[offset + 3]);
    if (raw[offset + 3] > 0) assert.deepEqual(decoded.subarray(offset, offset + 3), raw.subarray(offset, offset + 3));
  }
  await optimizePreparedDisplayLosslessWebp(input);
  assert.deepEqual(await readFile(input), expected, "repeat display optimization changed encoded bytes");
  assert.equal((await readdir(directory)).filter(name => name.includes("candidate")).length, 0);
});
