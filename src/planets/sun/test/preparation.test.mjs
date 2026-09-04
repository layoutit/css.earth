import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { validateRuntimeAssetManifest } from "../../../platform/runtime-asset-closure.mjs";
import { PREPARED_SUN_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_SUN_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_SUN_PANEL } from "../site/preparedPanel.mjs";
import { PREPARED_SUN_TITLE } from "../site/preparedTitle.mjs";
import { verifySunSourceManifest } from "../tools/source-manifest.mjs";
import { verifySunRasterReproduction } from "../tools/verify-reproduction.mjs";

test("binds the exact Sun source and runtime closures", async () => {
  assert.deepEqual(await verifySunSourceManifest(), {
    inputCount: 36,
    generatedIntermediateCount: 0,
    documentCount: 2,
  });
  const runtime = JSON.parse(await readFile(
    new URL("../runtime-assets.json", import.meta.url),
    "utf8",
  ));
  assert.equal(validateRuntimeAssetManifest("sun", runtime), true);
  assert.equal(runtime.assets.length, 60);
});

test("publishes prepared Sun content, lenses, and scene", () => {
  assert.equal(PREPARED_SUN_PANEL.sourceId, 108082);
  assert.equal(PREPARED_SUN_TITLE.label, "Sun");
  assert.equal(PREPARED_SUN_TITLE.source, "Inter Variable 4.001 git-9221beed3");
  assert.equal(PREPARED_SUN_PANEL.facts.length, 4);
  assert.deepEqual(PREPARED_SUN_LENSES.controls.map(({ id }) => id), [
    "photosphere",
    "magnetic",
    "chromosphere",
    "corona",
  ]);
  assert.equal(PREPARED_SUN_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_SUN_SCENE.runtimeGeometry, false);
  assert.equal(PREPARED_SUN_SCENE.runtimeRasterization, false);
  assert.equal(PREPARED_SUN_SCENE.counts.textureLeafCount, 514);
  assert.equal(PREPARED_SUN_SCENE.counts.polarLeafCount, 66);
  assert.match(PREPARED_SUN_SCENE.body.sourceProjection, /Carrington full-surface maps/);
  assert.match(PREPARED_SUN_SCENE.body.continuumPreparation, /central-meridian/);
  assert.match(
    PREPARED_SUN_SCENE.body.polarPreparation,
    /Saturn-standard retained 32-segment polar band/,
  );
  assert.equal(PREPARED_SUN_SCENE.body.sourceRotation, 2311);
  assert.equal(PREPARED_SUN_SCENE.animation.flatDiscRotation, false);
  assert.equal(PREPARED_SUN_SCENE.limbMaterial.surfaceReplacement, false);
  assert.equal("material" in PREPARED_SUN_SCENE, false);
  assert.equal(
    PREPARED_SUN_SCENE.starfield.model,
    "prepared-photographic-full-sky-retained-css-cubemap",
  );
  assert.equal(PREPARED_SUN_SCENE.starfield.faces.length, 6);
  assert.equal(PREPARED_SUN_SCENE.starfield.sun, undefined);
  assert.equal(PREPARED_SUN_SCENE.camera.cameraModel, "accumulated-matrix3d");
  assert.equal(PREPARED_SUN_SCENE.camera.pitchBounded, false);
  assert.equal(PREPARED_SUN_SCENE.camera.yawBounded, false);
});

test("preserves both HMI magnetic polarities in the prepared magnetic lens", async () => {
  const source = await readFile(new URL(
    "../../../../public/scenes/sun/sun-surface-magnetic.webp",
    import.meta.url,
  ));
  const { data } = await sharp(source).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let negativePolarityPixels = 0;
  let positivePolarityPixels = 0;
  for (let offset = 0; offset < data.length; offset += 3) {
    if (data[offset + 2] > data[offset] + 20) negativePolarityPixels += 1;
    if (data[offset] > data[offset + 2] + 20) positivePolarityPixels += 1;
  }
  assert.ok(negativePolarityPixels > 1_000);
  assert.ok(positivePolarityPixels > 1_000);
});

test("reproduces every Sun raster asset byte-identically in isolation", async () => {
  const result = await verifySunRasterReproduction();
  assert.deepEqual(result, {
    schema: "csssun-isolated-raster-reproduction@1",
    assetCount: 60,
    totalBytes: result.totalBytes,
    aggregateSha256: result.aggregateSha256,
    byteIdentical: true,
  });
  assert.ok(result.totalBytes > 0);
  assert.match(result.aggregateSha256, /^[0-9a-f]{64}$/u);
});

test("keeps the runtime free of forbidden render paths", async () => {
  const [acquisition, client, styles] = await Promise.all([
    readFile(new URL("../tools/acquire.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /\bfetch\s*\(|createElement\(["']canvas|WebGL|clipPath/u);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?\s*:|filter\s*:|gradient\(|mix-blend-mode|image-set\(/u);
  assert.match(client, /CANONICAL_PREPARED_IMAGE_DENSITY/);
  assert.match(client, /createRetainedCubicSkyOrbit/);
  assert.match(client, /mountRetainedCubicSky/);
  assert.match(client, /requireSun:\s*false/u);
  assert.match(client, /PLANET_SPEED_STATES/u);
  assert.match(client, /releaseResources\(\)/u);
  assert.match(client, /root\.classList\.add\("is-loading"\)/u);
  assert.match(client, /entry\.images\.forEach\(releaseDecodedImage\)/u);
  assert.doesNotMatch(`${client}\n${styles}`, /data-speed|\bslow\b/u);
  assert.doesNotMatch(client, /sun-material-composite|sun-material-spin/u);
  assert.doesNotMatch(styles, /\.sun-body\s*\{[^}]*opacity\s*:/su);
  assert.doesNotMatch(acquisition, /\.\.\/\.\.\/saturn\/source/u);
});
