import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_SATURN_VIEWS } from "../runtime/preparedViews.mjs";

test("publishes a prepared retained Saturn interior view", () => {
  assert.equal(PREPARED_SATURN_VIEWS.schema, "csssaturn-prepared-views@1");
  assert.equal(PREPARED_SATURN_VIEWS.presentation, "cross-section-lens");
  assert.equal(PREPARED_SATURN_VIEWS.defaultView, undefined);
  assert.equal(PREPARED_SATURN_VIEWS.controls, undefined);
  assert.equal(PREPARED_SATURN_VIEWS.runtimeGeometry, false);
  assert.equal(PREPARED_SATURN_VIEWS.runtimeRasterization, false);
  assert.equal(PREPARED_SATURN_VIEWS.lighting.model,
    "prepared-object-light-two-face-cutaway-and-curved-shell-shading");
  assert.equal(PREPARED_SATURN_VIEWS.lighting.authority,
    "prepared-ring-source-object-light-direction");
  assert.equal(PREPARED_SATURN_VIEWS.lighting.sectionFaceCount, 2);
  assert.equal(PREPARED_SATURN_VIEWS.lighting.runtimeLighting, false);
  assert.equal(PREPARED_SATURN_VIEWS.assets.section.width, 2048);
  assert.equal(PREPARED_SATURN_VIEWS.assets.section.height, 2048);
  assert.equal(PREPARED_SATURN_VIEWS.assets.section.asset2x.width, 4096);
  assert.equal(PREPARED_SATURN_VIEWS.assets.section.asset2x.height, 4096);
  assert.deepEqual(
    Object.keys(PREPARED_SATURN_VIEWS.interiorLenses),
    ["normal"],
  );
  for (const lens of Object.values(PREPARED_SATURN_VIEWS.interiorLenses)) {
    assert.equal(lens.runtimeFiltering, false);
    assert.equal(lens.runtimeRasterization, false);
    for (const asset of Object.values(lens.assets)) {
      assert.equal(asset.asset2x.width, asset.asset.width * 2);
      assert.equal(asset.asset2x.height, asset.asset.height * 2);
      assert.match(asset.asset.sha256, /^[a-f0-9]{64}$/u);
      assert.match(asset.asset2x.sha256, /^[a-f0-9]{64}$/u);
    }
  }
  assert.deepEqual(
    Object.keys(PREPARED_SATURN_VIEWS.assets.outerPoles),
    ["normal", "ultraviolet", "methane", "thermal"],
  );
  for (const asset of Object.values(
    PREPARED_SATURN_VIEWS.assets.outerPoles,
  )) {
    assert.equal(asset.asset2x.width, asset.asset.width * 2);
    assert.equal(asset.asset2x.height, asset.asset.height * 2);
    assert.match(asset.asset.sha256, /^[a-f0-9]{64}$/u);
    assert.match(asset.asset2x.sha256, /^[a-f0-9]{64}$/u);
  }
  assert.equal(PREPARED_SATURN_SCENE.interior.schema,
    "csssaturn-prepared-cutaway@1");
  assert.equal(PREPARED_SATURN_SCENE.interior.runtimeGeometry, false);
  assert.equal(PREPARED_SATURN_SCENE.interior.runtimeRasterization, false);
  assert.equal(PREPARED_SATURN_SCENE.interior.leafCount, 478);
  assert.equal(PREPARED_SATURN_SCENE.counts.cutawayBodyLeafCount, 310);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorMetallicLeafCount, 68);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorCoreLeafCount, 98);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorSectionLeafCount, 2);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorAtmosphereLeafCount, 1);
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.model,
    "prepared-cutaway-full-exterior-material-oblate-texels");
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.composition,
    "same-exterior-light-terminator-ring-shadow-atmosphere-and-ring-ordering");
  assert.equal(
    PREPARED_SATURN_SCENE.interior.atmosphere.defaultHighResolution,
    true,
  );
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.frameCount, 128);
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.runtimeRasterization,
    false);
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.runtimeLightingMath,
    false);
  assert.match(PREPARED_SATURN_SCENE.interior.atmosphere.assetSha256,
    /^[a-f0-9]{64}$/u);
  assert.deepEqual(
    Object.keys(PREPARED_SATURN_SCENE.interior.atmosphere.lensAssets),
    ["normal", "ultraviolet", "methane", "thermal"],
  );
  assert.equal(new Set(Object.values(
    PREPARED_SATURN_SCENE.interior.atmosphere.lensAssets,
  ).map(({ sha256 }) => sha256)).size, 4);
  assert.deepEqual(
    PREPARED_SATURN_SCENE.interior.sectionLeaves.map((leaf) =>
      leaf.sourceRect),
    [
      { x: 0, y: 0, width: 1024, height: 2048 },
      { x: 1024, y: 0, width: 1024, height: 2048 },
    ],
  );
});

test("ships lossless DPR assets and keeps view switching declarative", async () => {
  const [client, styles, preparer, manifestText] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../tools/prepare-interior.mjs", import.meta.url), "utf8"),
    readFile(new URL("../source/interior/manifest.json", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.schema, "csssaturn-interior-sources@1");
  assert.equal(manifest.sources.length, 8);
  for (const key of [
    "section",
    "metallic",
    "core",
    "metallicPoles",
    "corePoles",
  ]) {
    const asset = PREPARED_SATURN_VIEWS.assets[key];
    assert.equal(asset.asset2x.width, asset.asset.width * 2);
    assert.equal(asset.asset2x.height, asset.asset.height * 2);
    assert.match(asset.asset.sha256, /^[a-f0-9]{64}$/u);
    assert.match(asset.asset2x.sha256, /^[a-f0-9]{64}$/u);
  }
  assert.match(preparer, /webp\(\{ lossless: true \}\)/u);
  assert.match(client, /stage\.dataset\.view = "interior"/u);
  assert.match(client, /delete stage\.dataset\.view/u);
  assert.match(client, /interiorAtmosphereCache\.presentation/u);
  assert.match(client, /interiorAtmosphereCache\.defaultPresentation/u);
  assert.match(client, /preparedInteriorDecodeRequests\(\)/u);
  assert.doesNotMatch(client,
    /decodeImage\(INTERIOR_ATMOSPHERE_TEXTURE_URL\)/u);
  assert.match(client,
    /interiorAtmosphereLeaf\.style\.backgroundImage = "none"/u);
  assert.doesNotMatch(client,
    /interiorAtmosphereLeaf\.style\.backgroundImage =\s*\n\s*`url/u);
  assert.match(client, /function createPreparedInterior\(plan\)/u);
  assert.match(client, /viewBank\.mountInterior\(\)/u);
  assert.match(client, /const cutaway = createPreparedInterior\(plan\)/u);
  assert.match(client, /system\.appendChild\(cutaway\)/u);
  assert.match(client, /interiorMounted: true/u);
  assert.match(client,
    /runtimeDomGrowthPolicy: "none-retained-scene-complete-at-mount"/u);
  assert.match(client, /if \(leaf\.className\) element\.className = leaf\.className/u);
  assert.doesNotMatch(styles,
    /saturn-interior-section-(?:ultraviolet|methane|thermal)/u);
  assert.match(styles, /\.planet-stage\[data-view="interior"\] \.saturn-cutaway/u);
  assert.match(styles,
    /\.planet-stage\[data-view="interior"\] \.saturn-interior-material/u);
  assert.doesNotMatch(client,
    /createElement\(["']canvas|clipPath|maskImage|requestAnimationFrame\([^)]*view/iu);
  assert.doesNotMatch(styles,
    /(?:clip-path|mask(?:-image)?|filter|mix-blend-mode)\s*:/iu);
});
