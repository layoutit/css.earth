import { readPreparedFixture } from '../../fixtures.mjs';
const PREPARED_MOON_LENSES = await readPreparedFixture('moon', 'lenses');
const PREPARED_MOON_SCENE = await readPreparedFixture('moon', 'scene');
const PREPARED_MOON_SKY_SUN = await readPreparedFixture('moon', 'sun');
const PREPARED_MOON_STARFIELD = await readPreparedFixture('moon', 'sky');
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";





import { verifyMoonSourceManifest } from "./preparation-fixture.mjs";

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

test("prepares sourced surface, numeric LOLA, preserved GRAIL, and Diviner lenses", async () => {
  assert.equal(PREPARED_MOON_LENSES.schema, "cssmoon-prepared-lenses@1");
  assert.equal(PREPARED_MOON_LENSES.defaultLens, "surface");
  assert.equal(PREPARED_MOON_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_MOON_LENSES.runtimeRasterization, false);
  assert.equal(PREPARED_MOON_LENSES.material.schema,
    "cssmoon-prepared-curvature-material@1");
  assert.equal(PREPARED_MOON_LENSES.material.runtimeRasterization, false);
  assert.deepEqual(PREPARED_MOON_LENSES.controls.map(({ id }) => id),
    ["surface", "topography", "crust", "rock-abundance", "silicate-signature", "geology"]);
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
  const controls = JSON.parse(await readFile(new URL("../../../../src/planets/moon/prepared/controls.json", import.meta.url), "utf8"));
  for (const id of ["topography", "rock-abundance", "silicate-signature"]) {
    const legend = controls.lenses.controls.find(lens => lens.id === id).legend;
    const metadata = await sharp(fileURLToPath(new URL(`../../../../public${legend.src}`, import.meta.url))).metadata();
    assert.deepEqual([metadata.width, metadata.height], [256, 16]);
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
  assert.equal(source.inputCount, 18);
  const manifest = JSON.parse(await readFile(
    new URL("../../../../src/planets/moon/runtime-assets.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.schema, "cssmoon-runtime-assets@1");
  assert.equal(manifest.assets.length, 61);
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
    readFile(new URL("../../../../src/renderers/css/dist/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/moon-surfaces.css", import.meta.url), "utf8"),
  ]);
  const { auditObjectRuntimeOwnership } = await import("../../../../tools/check-object-runtime-ownership.mjs");
  const { OBJECTS } = await import("../../../../site/objects.mjs");
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "moon") });
  assert.equal(audit.complete, true);
  assert.ok(audit.sharedClosure.includes("src/renderers/css/solar-system/cubic-sky-runtime.ts"));
  assert.ok(audit.sharedClosure.includes("src/renderers/css/solar-system/directional-sun-runtime.ts"));
  assert.doesNotMatch(client, /createElement\(["']canvas/u);
  assert.doesNotMatch(client, /createElementNS/u);
  assert.doesNotMatch(styles,
    /clip-path|mask(?:-image)?\s*:|filter\s*:|linear-gradient|radial-gradient|mix-blend-mode/u);
});
