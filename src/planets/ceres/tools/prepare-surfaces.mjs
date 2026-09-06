#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { createSourceManifest } from "../../../platform/source-manifest.mjs";
import { packProjectiveSurfaceRaster } from "../../../platform/projective-surface-raster.mjs";
import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from "../../../platform/prepare-missing-coverage.mjs";
import { reprojectSolidBodySurfaceRaster } from "../../../platform/prepare-solid-body-surface.mjs";

// The same 16-band, 32-pixel-gutter layout as Mercury's canonical 4K surface.
// This prepares textures only; it does not create a runtime or register Ceres.
const width = 4096, height = 2048, bandCount = 16, gutter = 32;
const sourceRoot = resolve(import.meta.dirname, "../source");
const publicRoot = resolve(import.meta.dirname, "../../../../public/scenes/ceres");
const preparedRoot = resolve(import.meta.dirname, "../.prepared");
const source = await createSourceManifest({ planetId: "ceres", planetName: "Ceres", sourceRoot });
await source.verify();
await mkdir(publicRoot, { recursive: true });
await mkdir(preparedRoot, { recursive: true });
const surfaces = [];
for (const entry of source.manifest.inputs.filter(input => input.consumers.includes("surfaces"))) {
  const input = await readFile(resolve(sourceRoot, entry.path));
  const metadata = await sharp(input).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height) {
    throw new Error(`Ceres source dimensions changed: ${entry.path}`);
  }
  // Read validity before interpolation. Exactly black pixels connected to the
  // southern image edge use the same gray cartographic grid as Pluto.
  const sourceRaster = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sourceMissing = blackFillCoverage(sourceRaster.data, sourceRaster.info, { southConnected: true });
  const rgb = await sharp(input).resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .removeAlpha().raw().toBuffer();
  const missing = sampleCoverage(sourceMissing, sourceRaster.info, width, height);
  const display = paintMissingCoverage(rgb, { width, height, channels: 3 }, missing);
  const rgba = await sharp(display, { raw: { width, height, channels: 3 } }).ensureAlpha().raw().toBuffer();
  const projected = reprojectSolidBodySurfaceRaster(rgba, { width, height, latitudeSegments: bandCount });
  const packed = packProjectiveSurfaceRaster(projected, { width, height, bandCount, gutter });
  const { data, ...layout } = packed;
  const normalized = sharp(rgba, { raw: { width, height, channels: 4 } });
  const stem = `ceres-${entry.lensId}`;
  const map = await emit(`${stem}-map.webp`, normalized.clone());
  const surface = await emit(`${stem}-surface@2x.webp`, sharp(data, {
    raw: { width: packed.packedWidth, height: packed.packedHeight, channels: 4 },
  }));
  const thumbnail = await emit(`${stem}-thumbnail.webp`, normalized.clone().resize(96, 48));
  surfaces.push({
    id: entry.lensId, label: entry.label, falseColor: entry.falseColor,
    source: { id: entry.id, sha256: entry.expectedSha256, width: entry.width, height: entry.height },
    projection: entry.projection, coverage: entry.coverage,
    map, surface, thumbnail, layout,
  });
}
await writeFile(resolve(preparedRoot, "surfaces.json"), JSON.stringify({
  objectId: "ceres", surfaces,
}, null, 2) + "\n");
console.log(`Prepared ${surfaces.length} Ceres surfaces: public/scenes/ceres; metadata: src/planets/ceres/.prepared/surfaces.json`);

async function emit(filename, pipeline) {
  // Lossless encoding preserves the resampled pixels through packing and delivery.
  const bytes = await pipeline.webp({ lossless: true, effort: 4 }).toBuffer();
  await writeFile(resolve(publicRoot, filename), bytes);
  const { width, height } = await sharp(bytes).metadata();
  return { url: `/scenes/ceres/${filename}`, width, height, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
}
