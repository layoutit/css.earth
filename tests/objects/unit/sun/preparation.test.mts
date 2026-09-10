import { readPreparedFixture } from '../../fixtures.mts';
const PREPARED_SUN_LENSES = await readPreparedFixture('sun', 'lenses');
const PREPARED_SUN_SCENE = await readPreparedFixture('sun', 'scene');
const PREPARED_SUN_PANEL = await readPreparedFixture('sun', 'panel');
const PREPARED_SUN_TITLE = await readPreparedFixture('sun', 'title');
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { validateRuntimeAssetManifest } from "../../../../src/platform/runtime-asset-closure.mts";




import { verifySunSourceManifest } from "./preparation-fixture.mts";
import { verifySunRasterReproduction } from "./preparation-fixture.mts";

test("binds the exact Sun source and runtime closures", async () => {
  assert.deepEqual(await verifySunSourceManifest(), {
    inputCount: 38,
    generatedIntermediateCount: 0,
    documentCount: 9,
  });
  const [manifest, review] = await Promise.all([
    readFile(new URL("../../../../src/planets/sun/source/manifest.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../../../src/planets/sun/source/editorial/factsheet-review.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assert.ok(manifest.documents.some(({ path }) => path === "editorial/factsheet-review.json"));
  assert.equal(review.schema, "cssearth-factsheet-source-review@1");
  assert.equal(review.objectId, "sun");
  const factsUrl = "https://science.nasa.gov/sun/facts/";
  const cyclesUrl = "https://science.nasa.gov/heliophysics/focus-areas/solar-science/";
  assert.equal(review.references.find(({ url }) => url === factsUrl)?.values["rotation-period"], "About 25 days");
  const cycles = review.references.find(({ url }) => url === cyclesUrl);
  assert.equal(cycles?.activityCycleYears, 11);
  assert.equal(cycles?.magneticCycleYears, 22);
  const facts = [...PREPARED_SUN_PANEL.facts, ...PREPARED_SUN_PANEL.moreFacts];
  for (const [id, label, value, url] of [
    ["rotation-period", "Equatorial rotation", "About 25 days", factsUrl],
    ["activity-cycle", "Activity cycle", "About 11 years", cyclesUrl],
    ["magnetic-cycle", "Magnetic cycle", "About 22 years", cyclesUrl],
  ]) {
    const fact = facts.find((entry) => entry.id === id);
    assert.equal(fact?.label, label);
    assert.equal(fact?.value, value);
    assert.equal(fact?.source?.url, url);
    assert.equal(fact?.source?.path, "source/editorial/factsheet-review.json");
  }
  const runtime = JSON.parse(await readFile(
    new URL("../../../../src/planets/sun/runtime-assets.json", import.meta.url),
    "utf8",
  ));
  assert.equal(validateRuntimeAssetManifest("sun", runtime), true);
  assert.equal(runtime.assets.length, 60);
});

test("publishes prepared Sun content, lenses, and scene", async () => {
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
  const context = JSON.parse(await readFile(new URL("../../../../src/planets/sun/prepared/world-context.json", import.meta.url), "utf8"));
  assert.equal(context.schema, "cssearth-world-context@1");
  assert.equal(context.focus.id, "sun");
  assert.deepEqual(context.focus.positionM, context.frame.originM);
  assert.equal(context.focus.radiusM, context.frame.bodyRadiusM);
  const sourceContext = JSON.parse(await readFile(new URL("../../../../src/planets/sun/source/navigation/universe.json", import.meta.url), "utf8"));
  assert.deepEqual(context.bodies.map(body => body.id), sourceContext.bodies.map(body => body.id));
  assert.equal(context.camera.presentation.projection.model, "css-perspective-shared-with-sky");
  const descriptor = JSON.parse(await readFile(new URL("../../../../src/planets/sun/object.json", import.meta.url), "utf8"));
  assert.deepEqual(descriptor.properties.worldFrame, context.frame);
  assert.deepEqual(PREPARED_SUN_SCENE.worldFrame, context.frame);
  assert.deepEqual(PREPARED_SUN_SCENE.camera.projection, context.camera.presentation.projection);
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
    readFile(new URL("../../../../src/planets/sun/source/preparation/acquisition.json", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/dist/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/sun-surfaces.css", import.meta.url), "utf8"),
  ]);
  assert.equal(/createElement\(["']canvas/u.test(client), false);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?\s*:|filter\s*:|gradient\(|mix-blend-mode|image-set\(/u);
  const { auditObjectRuntimeOwnership } = await import("../../../../tools/check-object-runtime-ownership.mts");
  const { OBJECTS } = await import("../../../../site/objects.mts");
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "sun") });
  assert.equal(audit.complete, true);
  assert.ok(audit.sharedClosure.includes("src/renderers/css/universe/world-context-runtime.ts"));
  const runtimeDefinition = await readPreparedFixture('sun', 'runtime');
  assert.equal(runtimeDefinition.sun, null);
  assert.equal(runtimeDefinition.sky.sun, undefined);
  assert.doesNotMatch(`${client}\n${styles}`, /data-speed|\bslow\b/u);
  assert.doesNotMatch(client, /sun-material-composite|sun-material-spin/u);
  assert.doesNotMatch(styles, /\.sun-body\s*\{[^}]*opacity\s*:/su);
  assert.doesNotMatch(acquisition, /\.\.\/\.\.\/saturn\/source/u);
});
