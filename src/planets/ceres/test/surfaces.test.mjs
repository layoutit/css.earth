import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { createSourceManifest } from "../../../platform/source-manifest.mjs";

import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from "../../../platform/prepare-missing-coverage.mjs";
import { reprojectSolidBodySurfaceRaster } from "../../../platform/prepare-solid-body-surface.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const root = resolve(import.meta.dirname, "../../../..");
const source = await createSourceManifest({ planetId: "ceres", planetName: "Ceres", sourceRoot });
const prepared = JSON.parse(await readFile(resolve(import.meta.dirname, "../.prepared/surfaces.json")));

test("downloaded Dawn rasters match their pinned sources and reject corruption", async () => {
  await source.verify();
  for (const entry of source.manifest.inputs.filter(input => input.consumers.includes("surfaces"))) {
    const bytes = Buffer.from(await readFile(resolve(sourceRoot, entry.path)));
    bytes[0] ^= 1;
    assert.throws(() => source.assertBytes(entry, bytes), /hash drifted/);
  }
});

test("observed map pixels remain intact, gaps use the shared grid, and bands retain seam gutters", async () => {
  assert.deepEqual(prepared.surfaces.map(s => s.id), source.manifest.inputs.filter(input => input.consumers.includes("surfaces")).map(s => s.lensId));
  for (const lens of prepared.surfaces) {
    const entry = source.manifest.inputs.find(input => input.lensId === lens.id);
    const decoded = {};
    for (const kind of ["map", "surface", "thumbnail"]) {
      const asset = lens[kind];
      const bytes = await readFile(resolve(root, "public", asset.url.slice(1)));
      assert.equal(bytes.length, asset.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([info.width, info.height], [asset.width, asset.height]);
      decoded[kind] = data;
    }
    const { width, height, gutter, bands, packedWidth } = lens.layout;
    const input = resolve(sourceRoot, entry.path);
    const raw = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const missing = sampleCoverage(blackFillCoverage(raw.data, raw.info, { southConnected: true }), raw.info, width, height);
    const original = await sharp(input).resize(width, height, { fit: "fill", kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
    const marked = paintMissingCoverage(original, { width, height, channels: 3 }, missing);
    let gapCount = 0;
    for (let i = 0; i < width * height; i++) {
      if (missing[i]) gapCount++;
      for (let c = 0; c < 3; c++) if (decoded.map[i * 4 + c] !== (missing[i] ? marked : original)[i * 3 + c])
        assert.fail(`${lens.id}: pixel ${i} changed outside the declared coverage treatment`);
    }
    assert.ok(gapCount > 0, `${lens.id}: the published south-polar gap must be marked`);
    const projected = reprojectSolidBodySurfaceRaster(decoded.map, { width, height, latitudeSegments: bands.length });
    for (const band of bands) {
      for (const y of [-gutter, 0, band.height - 1, band.height + gutter - 1]) {
        for (const x of [0, gutter - 1, gutter, packedWidth - gutter - 1, packedWidth - 1]) {
          const sourceY = Math.max(0, Math.min(height - 1, band.y + band.height - 1 - y));
          const sourceX = (x - gutter + width) % width;
          const expected = (sourceY * width + sourceX) * 4;
          const actual = ((band.packedY + y) * packedWidth + x) * 4;
          assert.deepEqual(decoded.surface.subarray(actual, actual + 4), projected.subarray(expected, expected + 4));
        }
      }
    }
  }
});
