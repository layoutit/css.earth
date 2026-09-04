import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PREPARED_MOON_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_MOON_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_MOON_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_MOON_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { verifyMoonSourceManifest } from "../tools/source-manifest.mjs";

test("publishes one prepared retained Moon scene", () => {
  assert.equal(PREPARED_MOON_SCENE.schema,
    "cssmoon-prepared-retained-scene@1");
  assert.equal(PREPARED_MOON_SCENE.body.latitudeSegments, 16);
  assert.equal(PREPARED_MOON_SCENE.body.longitudeSegments, 32);
  assert.equal(PREPARED_MOON_SCENE.body.bands.length, 16);
  assert.equal(PREPARED_MOON_SCENE.body.bands.flatMap(({ leaves }) => leaves)
    .length, 452);
  assert.equal(PREPARED_MOON_SCENE.counts.retainedLeafCount, 452);
  assert.equal(PREPARED_MOON_SCENE.counts.materialLeafCount, 1);
  assert.equal(PREPARED_MOON_SCENE.counts.retainedSkyboxFaceCount, 6);
  assert.equal(PREPARED_MOON_SCENE.counts.directionalSunLeafCount, 1);
  assert.equal(PREPARED_MOON_SCENE.counts.runtimeGeometryPreparation, false);
  assert.equal(PREPARED_MOON_SCENE.counts.runtimeRasterization, false);
  assert.equal(PREPARED_MOON_SCENE.camera.cameraModel,
    "accumulated-matrix3d");
  assert.equal(PREPARED_MOON_SCENE.camera.defaultControlYawDegrees, 0);
  assert.equal(PREPARED_MOON_SCENE.camera.pitchBounded, false);
  assert.equal(PREPARED_MOON_SCENE.camera.yawBounded, false);
});

test("prepares sourced surface, LOLA, and GRAIL observation lenses", async () => {
  assert.equal(PREPARED_MOON_LENSES.schema, "cssmoon-prepared-lenses@1");
  assert.equal(PREPARED_MOON_LENSES.defaultLens, "surface");
  assert.equal(PREPARED_MOON_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_MOON_LENSES.runtimeRasterization, false);
  assert.equal(PREPARED_MOON_LENSES.material.schema,
    "cssmoon-prepared-curvature-material@1");
  assert.equal(PREPARED_MOON_LENSES.material.runtimeRasterization, false);
  assert.deepEqual(PREPARED_MOON_LENSES.controls.map(({ id }) => id),
    ["surface", "topography", "crust"]);
  for (const lens of PREPARED_MOON_LENSES.controls) {
    for (const [url, width, height] of [
      [lens.surfaceUrl, 1024, 512],
      [lens.surface2xUrl, 2048, 1024],
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
    [PREPARED_MOON_LENSES.material.one, 512],
    [PREPARED_MOON_LENSES.material.two, 1024],
  ]) {
    const path = fileURLToPath(new URL(`../../../../public${url}`,
      import.meta.url));
    const metadata = await sharp(path).metadata();
    assert.deepEqual([metadata.width, metadata.height], [width, width]);
  }
});

test("keeps the Moon cubic sky and directional Sun fully prepared", () => {
  assert.equal(PREPARED_MOON_STARFIELD.schema,
    "cssearth-prepared-cubic-sky@2");
  assert.equal(PREPARED_MOON_STARFIELD.faces.length, 6);
  assert.equal(PREPARED_MOON_STARFIELD.runtimeRasterization, false);
  assert.equal(PREPARED_MOON_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_MOON_SKY_SUN.billboard, true);
  assert.equal(PREPARED_MOON_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_MOON_SKY_SUN.runtimeRasterization, false);
});

test("binds the checked Moon sources and runtime asset closure", async () => {
  const source = await verifyMoonSourceManifest();
  assert.equal(source.inputCount, 10);
  const manifest = JSON.parse(await readFile(
    new URL("../runtime-assets.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.schema, "cssmoon-runtime-assets@1");
  assert.equal(manifest.assets.length, 43);
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(
      `../../../../public/scenes/moon/${asset.filename}`,
      import.meta.url,
    ));
    assert.equal(bytes.byteLength, asset.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),
      asset.sha256);
  }
});

test("keeps runtime scene work retained and CSS-only", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /createRetainedCubicSkyOrbit/u);
  assert.match(client, /mountRetainedDirectionalSun/u);
  assert.doesNotMatch(client, /createElement\(["']canvas/u);
  assert.doesNotMatch(client, /createElementNS/u);
  assert.doesNotMatch(styles,
    /clip-path|mask(?:-image)?\s*:|filter\s*:|linear-gradient|radial-gradient|mix-blend-mode/u);
});
