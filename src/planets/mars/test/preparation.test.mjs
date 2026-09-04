import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PREPARED_MARS_TITLE } from "../site/preparedTitle.mjs";

import { PREPARED_MARS_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_MARS_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_MARS_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_MARS_SCENE } from "../runtime/preparedScene.mjs";
import { verifyMarsSourceManifest } from "../tools/source-manifest.mjs";

const objectRoot = new URL("../", import.meta.url);
const publicRoot = new URL("../../../../public/scenes/mars/", import.meta.url);
const manifest = JSON.parse(await readFile(
  new URL("runtime-assets.json", objectRoot),
  "utf8",
));

test("prepares Mars from a complete checked source closure", async () => {
  assert.deepEqual(await verifyMarsSourceManifest(), {
    inputCount: 21,
    generatedIntermediateCount: 0,
    documentCount: 2,
  });
  assert.equal(PREPARED_MARS_SCENE.schema, "cssmars-prepared-retained-body@1");
  assert.equal(PREPARED_MARS_CAMERA.schema, "cssmars-prepared-camera@2");
  assert.equal(PREPARED_MARS_LIGHTING.schema, "cssmars-prepared-lighting@5");
  assert.equal(PREPARED_MARS_MOONS.schema, "cssmars-prepared-low-poly-moons@3");
  assert.equal(PREPARED_MARS_LENSES.schema, "cssmars-prepared-lenses@1");
});

test("declares the exact public Mars runtime asset closure", async () => {
  assert.equal(manifest.schema, "cssmars-runtime-assets@1");
  assert.equal(
    manifest.assets.length,
    Object.values(PREPARED_MARS_LIGHTING.banks).reduce(
      (count, bank) => count + bank.rows.length,
      46,
    ),
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
    /\.(?:webp|svg)$/u.test(name) &&
    !/(?:source|master|staging|debug|preview)/u.test(name)));
  const packageSource = await readFile(
    new URL("../../../../package.json", import.meta.url),
    "utf8",
  );
  assert.match(packageSource,
    /"prepare:planets": "pnpm prepare:titles && pnpm prepare:planet-title-sources && pnpm prepare:scientific-charts && node tools\/run-implemented-planets\.mjs prepare && pnpm prepare:navigation"/u);
  assert.doesNotMatch(packageSource, /"prepare:(?:mars|saturn)"/u);
});
test("prepares the Mars shell title without a runtime font", () => {
  assert.equal(PREPARED_MARS_TITLE.label, "Mars");
  assert.equal(PREPARED_MARS_TITLE.source, "Inter Variable 4.001 git-9221beed3");
  assert.equal(PREPARED_MARS_TITLE.sourceSha256,
    "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.equal(PREPARED_MARS_TITLE.weight, 500);
  assert.equal(PREPARED_MARS_TITLE.opticalSize, 28);
  assert.match(PREPARED_MARS_TITLE.inputSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    PREPARED_MARS_TITLE.generator,
    "src/planets/mars/tools/prepare-title.mjs",
  );
  assert.match(PREPARED_MARS_TITLE.path, /^M0 29L0 8\.63/u);
  assert.doesNotMatch(PREPARED_MARS_TITLE.path, /<text|font-family/iu);
});
