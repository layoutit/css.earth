import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PREPARED_JUPITER_TITLE } from "../site/preparedTitle.mjs";

import { PREPARED_JUPITER_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_JUPITER_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_JUPITER_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_JUPITER_RINGS } from "../runtime/preparedRings.mjs";
import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_JUPITER_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { verifyJupiterSourceManifest } from "../tools/source-manifest.mjs";

const objectRoot = new URL("../", import.meta.url);
const publicRoot = new URL("../../../../public/scenes/jupiter/", import.meta.url);
const manifest = JSON.parse(await readFile(
  new URL("runtime-assets.json", objectRoot),
  "utf8",
));

test("prepares Jupiter from a complete checked source closure", async () => {
  assert.deepEqual(await verifyJupiterSourceManifest(), {
    inputCount: 27,
    generatedIntermediateCount: 0,
    documentCount: 1,
  });
  assert.equal(PREPARED_JUPITER_SCENE.schema, "cssjupiter-prepared-retained-body@1");
  assert.equal(PREPARED_JUPITER_CAMERA.schema, "cssjupiter-prepared-camera@6");
  assert.equal(PREPARED_JUPITER_LIGHTING.schema, "cssjupiter-prepared-lighting@3");
  assert.equal(PREPARED_JUPITER_MOONS.schema, "cssjupiter-prepared-low-poly-moons@2");
  assert.equal(PREPARED_JUPITER_RINGS.schema, "cssjupiter-prepared-rings@2");
  assert.equal(PREPARED_JUPITER_LENSES.schema, "cssjupiter-prepared-lenses@1");
  assert.equal(PREPARED_JUPITER_STARFIELD.schema,
    "cssearth-prepared-cubic-sky@2");
  assert.equal(PREPARED_JUPITER_STARFIELD.faces.length, 6);
  assert.equal("sun" in PREPARED_JUPITER_STARFIELD, false);
  assert.equal(PREPARED_JUPITER_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_JUPITER_SKY_SUN.billboard, true);
  assert.equal(PREPARED_JUPITER_SKY_SUN.bakedIntoStarfield, false);
});

test("declares the exact public Jupiter runtime asset closure", async () => {
  assert.equal(manifest.schema, "cssjupiter-runtime-assets@1");
  assert.equal(
    manifest.assets.length,
    PREPARED_JUPITER_LIGHTING.rows.length + 51,
  );
  const declared = manifest.assets.map(({ filename }) => filename);
  assert.equal(new Set(declared).size, declared.length);
  assert.deepEqual(declared, [...declared].sort((left, right) =>
    left.localeCompare(right)));
  const actual = (await readdir(publicRoot))
    .sort((left, right) => left.localeCompare(right));
  assert.deepEqual(actual, declared);
});

test("matches every prepared runtime byte to its manifest hash", async () => {
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(asset.filename, publicRoot));
    assert.equal(bytes.byteLength, asset.bytes, asset.filename);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
      asset.filename,
    );
  }
});

test("keeps preparation-only files out of public output", async () => {
  const names = await readdir(publicRoot);
  assert.ok(names.every((name) =>
    /\.(?:bin|webp|svg)$/u.test(name) &&
    !/(?:source|master|staging|debug|preview)/u.test(name)));
  const packageSource = await readFile(
    new URL("../../../../package.json", import.meta.url),
    "utf8",
  );
  assert.match(packageSource,
    /"prepare:planets": "pnpm prepare:titles && pnpm prepare:planet-title-sources && pnpm prepare:scientific-charts && node tools\/run-implemented-planets\.mjs prepare"/u);
  assert.doesNotMatch(packageSource, /"prepare:(?:jupiter|saturn)"/u);
});
test("prepares the Jupiter shell title without a runtime font", () => {
  assert.equal(PREPARED_JUPITER_TITLE.label, "Jupiter");
  assert.equal(PREPARED_JUPITER_TITLE.source, "Inter Variable 4.001 git-9221beed3");
  assert.equal(PREPARED_JUPITER_TITLE.sourceSha256,
    "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.equal(PREPARED_JUPITER_TITLE.weight, 500);
  assert.equal(PREPARED_JUPITER_TITLE.opticalSize, 28);
  assert.match(PREPARED_JUPITER_TITLE.inputSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    PREPARED_JUPITER_TITLE.generator,
    "src/planets/jupiter/tools/prepare-title.mjs",
  );
  assert.match(PREPARED_JUPITER_TITLE.path, /^M6\.25 29\.29/u);
  assert.doesNotMatch(PREPARED_JUPITER_TITLE.path, /<text|font-family/iu);
});

test("preloads Jupiter object assets without stale flat-scene requests", async () => {
  const head = await readFile(
    new URL("../site/JupiterHead.astro", import.meta.url),
    "utf8",
  );
  assert.match(head,
    /PREPARED_JUPITER_LIGHTING\.transport\.initialWarmRows\.map/u);
  assert.doesNotMatch(head, /PREPARED_ORBIT_GUIDES|moon/iu);
  assert.match(head, /Object\.values\(PREPARED_JUPITER_RINGS\.assets\)/u);
  assert.doesNotMatch(head, /PREPARED_JUPITER_ORBIT_BANK|as="fetch"/u);
  assert.doesNotMatch(head, /PREPARED_JUPITER_STARFIELD\.url/u);
});
