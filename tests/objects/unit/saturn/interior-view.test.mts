import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readPreparedFixture } from "../../fixtures.mts";
const PREPARED_PRESENTATION = await readPreparedFixture('saturn', 'runtime');
const PREPARED_SATURN_SCENE = await readPreparedFixture('saturn', 'scene');
const PREPARED_SATURN_VIEWS = await readPreparedFixture('saturn', 'views');
const runtimeAssets = JSON.parse(await readFile(new URL("../../../../src/objects/saturn/runtime-assets.json", import.meta.url), "utf8"));

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
  assert.equal(PREPARED_SATURN_SCENE.interior.leafCount, 478);
  assert.equal(PREPARED_SATURN_SCENE.counts.cutawayBodyLeafCount, 310);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorMetallicLeafCount, 68);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorCoreLeafCount, 98);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorSectionLeafCount, 2);
  assert.equal(PREPARED_SATURN_SCENE.counts.interiorAtmosphereLeafCount, 1);
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.model,
    "prepared-cutaway-full-exterior-material-oblate-texels");
  assert.equal(PREPARED_SATURN_SCENE.interior.atmosphere.frameCount, 128);
  const interior = required(PREPARED_PRESENTATION.materials.find((track: { id: string; }) => track.id === "interior"));
  const exterior = required(PREPARED_PRESENTATION.materials.find((track: { id: string; }) => track.id === "exterior"));
  assert.ok(interior.rotation?.kind === "ellipsoid" && exterior.rotation?.kind === "ellipsoid");
  assert.deepEqual(interior.rotation.projection, exterior.rotation.projection);
  // Verify the four banks actually consumed by the exclusive cross-section
  // lens, rather than retired intermediate spectral-atmosphere metadata.
  assert.deepEqual(interior.banks.map(bank => bank.id),
    ["normal", "normal-no-shadows", "normal-ringless", "normal-ringless-no-shadows"]);
  const hashes = interior.banks.map(bank => {
    assert.equal(bank.frames.length, 256);
    const resource = required(PREPARED_PRESENTATION.assets.entries.find(entry => entry.key === required(bank.default).resource));
    const asset = array(shape({filename:text,sha256:text}))(runtimeAssets.assets).find(asset => resource.url === `/scenes/saturn/${asset.filename}`);
    assert.ok(asset, "The prepared interior bank belongs to the active asset closure");
    assert.match(asset.sha256, /^[a-f0-9]{64}$/u);
    return asset.sha256;
  });
  assert.equal(new Set(hashes).size, 4);
  assert.deepEqual(
    PREPARED_SATURN_SCENE.interior.sectionLeaves.map(leaf => {
      assert.equal(required(leaf.projectiveTextureLayer).rasterScale, 2);
      const style = Object.fromEntries(leaf.style.split(";").map((value: string) => value.split(/:(.*)/su).slice(0, 2)));
      const [x, y] = style["background-position"].split(" ").map(Number.parseFloat);
      const scale = PREPARED_SATURN_VIEWS.assets.section.width / Number.parseFloat(style["background-size"]);
      return { x: Math.abs(x) * scale, y: Math.abs(y) * scale,
        width: Number.parseFloat(style["--polycss-atlas-width"]) * scale,
        height: Number.parseFloat(style["--polycss-atlas-height"]) * scale };
    }),
    [
      { x: 0, y: 0, width: 1024, height: 2048 },
      { x: 1024, y: 0, width: 1024, height: 2048 },
    ],
  );
});

test("ships lossless DPR assets and keeps view switching declarative", async () => {
  const [client, styles, preparer, manifestText] = await Promise.all([
    readFile(new URL("../../../../src/objects/saturn/prepared/runtime.json", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/saturn-surfaces.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../tools/objects/cutaway/materials.mts", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/objects/saturn/source/interior/manifest.json", import.meta.url), "utf8"),
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
  ] as const) {
    const asset = PREPARED_SATURN_VIEWS.assets[key];
    assert.equal(asset.asset2x.width, asset.asset.width * 2);
    assert.equal(asset.asset2x.height, asset.asset.height * 2);
    assert.match(asset.asset.sha256, /^[a-f0-9]{64}$/u);
    assert.match(asset.asset2x.sha256, /^[a-f0-9]{64}$/u);
  }
  assert.match(preparer, /webp\(\{ lossless: true \}\)/u);
  const variants = PREPARED_PRESENTATION.variants;
  for (const variant of variants) {
    const interior = variant.when.lensId === "cross-section";
    const write=required(variant.writes.find(write => write.name === "data-view"));
    assert.ok("value" in write);
    assert.equal(write.value, interior ? "interior" : null);
    const material = required(variant.materials.find((track: { track: string; }) => track.track === "interior"));
    assert.equal(material.enabled, interior);
    assert.equal(material.clearWhenHidden, true);
    if (interior) assert.match(material.bank, /^normal(?:-|$)/);
  }
  const cutaway = PREPARED_PRESENTATION.tree.nodes.findIndex(node => node.className === "polycss-mesh saturn-cutaway");
  assert.ok(cutaway >= 0);
  assert.ok(PREPARED_PRESENTATION.tree.nodes.some(node => node.parent === cutaway));
  assert.doesNotMatch(client, /createElement|publishFrame|commitSelection|reduceSelection/);
  assert.doesNotMatch(styles,
    /saturn-interior-section-(?:ultraviolet|methane|thermal)/u);
  assert.match(styles, /\.planet-stage:where\(\[data-object-id="saturn"\]\)\[data-view="interior"\] \.saturn-cutaway/u);
  assert.match(styles,
    /\.planet-stage:where\(\[data-object-id="saturn"\]\)\[data-view="interior"\] \.saturn-interior-material/u);
  assert.doesNotMatch(client,
    /createElement\(["']canvas|clipPath|maskImage|requestAnimationFrame\([^)]*view/iu);
  assert.doesNotMatch(styles,
    /(?:clip-path|mask(?:-image)?|filter|mix-blend-mode)\s*:/iu);
});
