import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PREPARED_SATURN_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(objectRoot, "../../../public/scenes/saturn");
const stagingRoot = resolve(objectRoot, ".prepared");

test("ships five prepared retained-DOM Saturn lenses", async () => {
  assert.equal(PREPARED_SATURN_LENSES.schema, "csssaturn-prepared-lenses@1");
  assert.equal(PREPARED_SATURN_LENSES.defaultLens, "normal");
  assert.equal(PREPARED_SATURN_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_SATURN_LENSES.runtimeRasterization, false);
  assert.deepEqual(
    PREPARED_SATURN_LENSES.controls.map(({ id }) => id),
    ["normal", "ultraviolet", "methane", "thermal", "cross-section"],
  );
  assert.deepEqual(
    PREPARED_SATURN_LENSES.controls.map(({ materialLens }) => materialLens),
    ["normal", "ultraviolet", "methane", "thermal", "normal"],
  );
  for (const lens of PREPARED_SATURN_LENSES.controls) {
    const expected = lens.view === "interior"
      ? Object.freeze([
        [lens.thumbnailUrl, 112, 64],
      ])
      : Object.freeze([
        [lens.surfaceUrl, 2080, 1536],
        ...(lens.surface2xUrl ? [[lens.surface2xUrl, 4160, 3072]] : []),
        [lens.polesUrl, 4096, 512],
        [lens.ringUrl, 2048, 2048],
        [lens.ring2xUrl, 4096, 4096],
        [lens.thumbnailUrl, 112, 64],
      ]);
    for (const [url, width, height] of expected) {
      const metadata = await sharp(resolve(publicRoot, url.split("/").at(-1))).metadata();
      assert.equal(metadata.width, width, `${url} width`);
      assert.equal(metadata.height, height, `${url} height`);
    }
  }
  const interior = PREPARED_SATURN_LENSES.controls.find(
    ({ view }) => view === "interior",
  );
  const interiorMetadata = await sharp(resolve(
    stagingRoot,
    interior.interiorMaterialUrl.split("/").at(-1),
  )).metadata();
  assert.equal(interiorMetadata.width, 5188);
  assert.equal(interiorMetadata.height, 2080);
  const runtimeInteriorMetadata = await sharp(resolve(
    publicRoot,
    interior.interiorMaterialUrl.split("/").at(-1),
  )).metadata();
  assert.equal(runtimeInteriorMetadata.width, 5188);
  assert.equal(runtimeInteriorMetadata.height, 2080);
});

test("ships optional material lenses as exact single-atlas variants", async () => {
  const runtime = PREPARED_SATURN_SCENE.preparedLighting.orbitAtlas
    .runtimeShards;
  assert.equal(runtime.defaultVariant, "normal");
  assert.deepEqual(Object.keys(runtime.variants), [
    "normal",
    "normal-no-shadows",
    "normal-ringless",
    "normal-ringless-no-shadows",
    "ultraviolet",
    "ultraviolet-no-shadows",
    "ultraviolet-ringless",
    "ultraviolet-ringless-no-shadows",
    "methane",
    "methane-no-shadows",
    "methane-ringless",
    "methane-ringless-no-shadows",
    "thermal",
    "thermal-no-shadows",
    "thermal-ringless",
    "thermal-ringless-no-shadows",
  ]);
  for (const lens of PREPARED_SATURN_LENSES.controls.filter(
    ({ falseColor }) => falseColor,
  )) {
    assert.equal(lens.materialVariant, lens.id);
    assert.equal(
      lens.materialPreparationFile,
      `saturn-orbit-material-${lens.id}.webp`,
    );
    assert.equal(lens.materialUrl, undefined);
    const source = await sharp(resolve(
      stagingRoot,
      lens.materialPreparationFile,
    )).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(source.info.width, 5188);
    assert.equal(source.info.height, 4160);
    const variant = runtime.variants[lens.id];
    const deployedAsset = await readFile(resolve(
      publicRoot,
      lens.materialPreparationFile,
    ));
    const deployed = await sharp(deployedAsset)
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(variant.runtimeAtlas.assetUrl,
      `/scenes/saturn/${lens.materialPreparationFile}`);
    assert.equal(variant.runtimeAtlas.assetBytes, deployedAsset.byteLength);
    assert.equal(variant.runtimeAtlas.width, 5188);
    assert.equal(variant.runtimeAtlas.height, 4160);
    assert.equal(variant.runtimeAtlas.alphaMatchesSource, true);
    assert.equal(variant.runtimeAtlas.visibleTexelsMatchSource, true);
    assertVisibleRgbaEqual(deployed.data, source.data,
      variant.runtimeAtlas.assetUrl);
    assert.equal(variant.rows.length, 16);
    assert.equal(variant.presentations.length, 256);
    assert.equal(variant.exactVisibleDecodedCropVerification, true);
  }
  for (const lensId of ["normal", "ultraviolet", "methane", "thermal"]) {
    for (const mode of [
      "no-shadows",
      "ringless",
      "ringless-no-shadows",
    ]) {
      const id = `${lensId}-${mode}`;
      const variant = runtime.variants[id];
      assert.equal(variant.presentations.length, 256);
      assert.equal(variant.rows.length, 16);
      assert.equal(variant.runtimeAtlas.width, 5188);
      assert.equal(variant.runtimeAtlas.height, 4160);
      assert.equal(variant.runtimeAtlas.visibleTexelsMatchSource, true);
      assert.match(
        variant.runtimeAtlas.assetUrl,
        new RegExp(`saturn-orbit-material-${id}\\.webp$`, "u"),
      );
    }
  }
});

test("ships source-backed DPR-specific observation surfaces", () => {
  for (const lens of PREPARED_SATURN_LENSES.controls.filter(
    ({ falseColor }) => falseColor,
  )) {
    assert.match(lens.surface2xUrl, /@2x\.webp$/u);
    assert.equal(lens.detailCarrierUrl, "/scenes/saturn/saturn-surface.jpg");
    assert.equal(lens.falseColorPalette.length, 3);
    assert.ok(lens.materialGain > 0 && lens.materialGain <= 1);
    if (lens.id === "thermal") {
      assert.equal(lens.sourceModel, "cassini-informed-thermal-model");
      assert.equal(
        lens.detailPreparation,
        "prepared Cassini-informed cloud-window and latitude response over lossless DPR morphology",
      );
      assert.equal(lens.maximumDetailScale, 1);
      assert.equal(lens.sourceFiles.length, 0);
      assert.equal(lens.sourceUrls.length, 2);
      assert.match(lens.qualification, /not a direct global temperature retrieval/u);
    } else {
      assert.equal(lens.sourceModel, "hubble-global-map");
      assert.equal(
        lens.detailPreparation,
        "intact rotation A, lossless DPR surfaces, bounded visible-detail pansharpening",
      );
      assert.equal(lens.maximumDetailScale, 1.12);
      assert.equal(lens.sourceFiles.length, 1);
      assert.match(lens.sourceFiles[0], /2025a_/u);
    }
  }
});

test("keeps every prepared ring alpha texel unchanged across lenses", async () => {
  for (const lens of PREPARED_SATURN_LENSES.controls.filter(
    ({ falseColor }) => falseColor,
  )) {
    for (const density of ["", "@2x"]) {
      const normal = await alpha(`saturn-rings${density}.webp`);
      const spectral = await alpha(`saturn-rings-${lens.id}${density}.webp`);
      assert.equal(
        Buffer.compare(spectral, normal),
        0,
        `${lens.id} ${density || "1x"} alpha`,
      );
    }
  }
});

test("selects only prepared image sources at startup", async () => {
  const client = await readFile(
    resolve(objectRoot, "runtime/client.mjs"),
    "utf8",
  );
  assert.match(client, /stage\.dataset\.lens = activeLens/);
  assert.match(
    client,
    /decodeImage\(\s*lens\.surfaceUrl,\s*lens\.surface2xUrl,/u,
  );
  assert.match(client, /selectedPreparedDensity:\s*CANONICAL_PREPARED_IMAGE_DENSITY/u);
  assert.doesNotMatch(client, /const imageDensity\s*=/u);
  assert.equal([...client.matchAll(/devicePixelRatio/gu)].length, 0);
  assert.doesNotMatch(client,
    /matchMedia\([^)]*(?:resolution|device-pixel-ratio)|devicePixelRatio.*addEventListener/u);
  assert.match(client, /await lensControls\.bindRuntime/u);
  assert.match(client, /for \(const button of buttons\.values\(\)\) button\.disabled = true/u);
  assert.match(client,
    /await onLensChange\([\s\S]*?\{ interior: nextInterior \},[\s\S]*?\)/u);
  assert.match(client, /destroyed \|\| request !== selectionRequest/u);
  assert.match(client, /decoded\.delete\(lens\.id\)/u);
  assert.match(client, /entry\.wanted = true/u);
  assert.match(client, /return entry\.promise/u);
  assert.match(client, /releaseLensDecode\(id, entry\)/u);
  assert.match(client, /ready: bound && !destroyed/u);
  assert.match(client, /viewBank\.mountInterior\(\)/u);
  assert.match(client, /stage\.dataset\.view = "interior"/u);
  assert.doesNotMatch(client, /decodeImage\(lens\.interiorMaterialUrl\)/u);
  assert.doesNotMatch(client, /style\.filter|canvas|getContext\(/);
});

async function alpha(filename) {
  return sharp(resolve(publicRoot, filename)).ensureAlpha().extractChannel(3)
    .raw().toBuffer();
}

function cropRgba(source, sourceWidth, bounds) {
  const output = Buffer.allocUnsafe(bounds.width * bounds.height * 4);
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = (
      (bounds.y + row) * sourceWidth + bounds.x
    ) * 4;
    source.copy(
      output,
      row * bounds.width * 4,
      sourceStart,
      sourceStart + bounds.width * 4,
    );
  }
  return output;
}

function assertVisibleRgbaEqual(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} byte length`);
  for (let offset = 0; offset < expected.length; offset += 4) {
    assert.equal(actual[offset + 3], expected[offset + 3],
      `${label} alpha at texel ${offset / 4}`);
    if (expected[offset + 3] === 0) continue;
    assert.equal(actual[offset], expected[offset],
      `${label} red at texel ${offset / 4}`);
    assert.equal(actual[offset + 1], expected[offset + 1],
      `${label} green at texel ${offset / 4}`);
    assert.equal(actual[offset + 2], expected[offset + 2],
      `${label} blue at texel ${offset / 4}`);
  }
}
