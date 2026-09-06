import { readPreparedFixture } from '../../fixtures.mjs';
const PREPARED_PLUTO_LENSES = await readPreparedFixture('pluto', 'lenses');
const PREPARED_PLUTO_SCENE = await readPreparedFixture('pluto', 'scene');
const PREPARED_PLUTO_SKY_SUN = await readPreparedFixture('pluto', 'sun');
const PREPARED_PLUTO_STARFIELD = await readPreparedFixture('pluto', 'sky');
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";





import { verifyPlutoSourceManifest } from "./preparation-fixture.mjs";

test("publishes one prepared retained Pluto scene", () => {
  assert.equal(PREPARED_PLUTO_SCENE.schema,
    "csspluto-prepared-retained-scene@1");
  assert.equal(PREPARED_PLUTO_SCENE.body.latitudeSegments, 16);
  assert.equal(PREPARED_PLUTO_SCENE.body.longitudeSegments, 32);
  assert.equal(PREPARED_PLUTO_SCENE.body.bands.length, 16);
  assert.equal(PREPARED_PLUTO_SCENE.body.bands.flatMap(({ leaves }) => leaves)
    .length, 452);
  assert.equal(PREPARED_PLUTO_SCENE.counts.retainedLeafCount, 452);
  assert.equal(PREPARED_PLUTO_SCENE.counts.materialLeafCount, 1);
  assert.equal(PREPARED_PLUTO_SCENE.counts.retainedSkyboxFaceCount, 6);
  assert.equal(PREPARED_PLUTO_SCENE.counts.directionalSunLeafCount, 1);
  assert.equal(PREPARED_PLUTO_SCENE.counts.runtimeGeometryPreparation, false);
  assert.equal(PREPARED_PLUTO_SCENE.counts.runtimeRasterization, false);
  assert.equal(PREPARED_PLUTO_SCENE.camera.cameraModel,
    "accumulated-matrix3d");
  assert.equal(PREPARED_PLUTO_SCENE.camera.defaultControlYawDegrees, 0);
  assert.equal(PREPARED_PLUTO_SCENE.camera.pitchBounded, false);
  assert.equal(PREPARED_PLUTO_SCENE.camera.yawBounded, false);
});

test("bakes Pluto homographies into textures while keeping scene frames affine", () => {
  const leaves = PREPARED_PLUTO_SCENE.body.bands.flatMap(({ leaves }) => leaves);
  let projectiveFaces = 0;
  for (const leaf of leaves) {
    const layer = leaf.projectiveTextureLayer;
    if (layer) {
      assert.equal(layer.textureMatrix, "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1");
      const frame = layer.frameMatrix.split(",").map(Number);
      assert.deepEqual([frame[3], frame[7], frame[11], frame[15]], [0, 0, 0, 1]);
    }
    const matrix = leaf.style.match(/matrix3d\(([^)]+)\)/u)?.[1].split(",").map(Number);
    assert.equal(matrix?.length, 16);
    assert.ok(matrix.every(Number.isFinite));
    // A projective denominator must stay positive across all four corners.
    for (const x of [0, leaf.leafWidth]) for (const y of [0, leaf.leafHeight]) {
      assert.ok(matrix[3] * x + matrix[7] * y + matrix[15] > 0);
    }
    if (layer) projectiveFaces++;
  }
  assert.equal(projectiveFaces, 448);
});

test("prepares sourced MVIC color, USGS elevation, and LORRI/MVIC lenses", async () => {
  assert.equal(PREPARED_PLUTO_LENSES.schema, "csspluto-prepared-lenses@1");
  assert.equal(PREPARED_PLUTO_LENSES.defaultLens, "surface");
  assert.equal(PREPARED_PLUTO_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_PLUTO_LENSES.runtimeRasterization, false);
  assert.equal(PREPARED_PLUTO_LENSES.material.schema,
    "csspluto-prepared-curvature-material@1");
  assert.equal(PREPARED_PLUTO_LENSES.material.runtimeRasterization, false);
  assert.deepEqual(PREPARED_PLUTO_LENSES.controls.map(({ id }) => id),
    ["surface", "topography", "monochrome"]);
  for (const lens of PREPARED_PLUTO_LENSES.controls) {
    for (const [url, width, height] of [
      [lens.surfaceUrl, 2112, 924],
      [lens.surface2xUrl, 4224, 1848],
      [lens.polesUrl, 512, 128],
      [lens.poles2xUrl, 1024, 256],
      [lens.thumbnailUrl, 96, 96],
    ]) {
      const path = fileURLToPath(new URL(`../../../../public${url}`,
        import.meta.url));
      const metadata = await sharp(path).metadata();
      assert.deepEqual([metadata.width, metadata.height], [width, height]);
    }
  }
  for (const [url, width] of [
    [PREPARED_PLUTO_LENSES.material.one, 512],
    [PREPARED_PLUTO_LENSES.material.two, 1024],
  ]) {
    const path = fileURLToPath(new URL(`../../../../public${url}`,
      import.meta.url));
    const metadata = await sharp(path).metadata();
    assert.deepEqual([metadata.width, metadata.height], [width, width]);
  }
});

test("keeps the Pluto cubic sky and directional Sun fully prepared", () => {
  assert.equal(PREPARED_PLUTO_STARFIELD.schema,
    "cssearth-prepared-cubic-sky@2");
  assert.equal(PREPARED_PLUTO_STARFIELD.faces.length, 6);
  assert.equal(PREPARED_PLUTO_STARFIELD.runtimeRasterization, false);
  assert.equal(PREPARED_PLUTO_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_PLUTO_SKY_SUN.billboard, true);
  assert.equal(PREPARED_PLUTO_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_PLUTO_SKY_SUN.runtimeRasterization, false);
});

test("binds the checked Pluto sources and runtime asset closure", async () => {
  const source = await verifyPlutoSourceManifest();
  assert.equal(source.inputCount, 9);
  const manifest = JSON.parse(await readFile(
    new URL("../../../../src/planets/pluto/runtime-assets.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.schema, "csspluto-runtime-assets@1");
  assert.equal(manifest.assets.length, 43);
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(
      `../../../../public/scenes/pluto/${asset.filename}`,
      import.meta.url,
    ));
    assert.equal(bytes.byteLength, asset.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),
      asset.sha256);
  }
});

test("keeps runtime scene work retained and CSS-only", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../../../../src/renderers/css/dist/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/pluto-surfaces.css", import.meta.url), "utf8"),
  ]);
  const { auditObjectRuntimeOwnership } = await import("../../../../tools/check-object-runtime-ownership.mjs");
  const { OBJECTS } = await import("../../../../site/objects.mjs");
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "pluto") });
  assert.equal(audit.complete, true);
  assert.ok(audit.sharedClosure.includes("src/renderers/css/solar-system/cubic-sky-runtime.ts"));
  assert.ok(audit.sharedClosure.includes("src/renderers/css/solar-system/directional-sun-runtime.ts"));
  assert.doesNotMatch(client, /createElement\(["']canvas/u);
  assert.doesNotMatch(client, /createElementNS/u);
  assert.doesNotMatch(styles,
    /clip-path|mask(?:-image)?\s*:|filter\s*:|linear-gradient|radial-gradient|mix-blend-mode/u);
});
