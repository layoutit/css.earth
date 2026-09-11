import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PREPARED_MARS_TITLE } from "../../unit/mars/prepared-fixture.mts";

import { PREPARED_MARS_CAMERA } from "../../unit/mars/prepared-fixture.mts";
import { PREPARED_MARS_LENSES } from "../../unit/mars/prepared-fixture.mts";
import { PREPARED_MARS_LIGHTING } from "../../unit/mars/prepared-fixture.mts";
import { PREPARED_MARS_SCENE } from "../../unit/mars/prepared-fixture.mts";
import { createSourceManifest } from "../../../../src/platform/source-manifest.mts";
import {fileURLToPath} from 'node:url';

const objectRoot = new URL("../../../../src/planets/mars/", import.meta.url);
const publicRoot = new URL("../../../../public/scenes/mars/", import.meta.url);
const manifest = JSON.parse(await readFile(
  new URL("runtime-assets.json", objectRoot),
  "utf8",
));

test("prepares Mars from a complete checked source closure", async () => {
  const source=await createSourceManifest({planetId:'mars',planetName:'Mars',sourceRoot:fileURLToPath(new URL('source/',objectRoot))});
  const verified=await source.verify();
  assert.equal(verified.inputCount,source.manifest.inputs.length);
  assert.equal(verified.documentCount,source.manifest.documents.length);
  assert.equal(verified.generatedIntermediateCount,0);
  assert.equal(PREPARED_MARS_SCENE.schema, "cssmars-prepared-retained-body@1");
  assert.equal(PREPARED_MARS_CAMERA.schema, "cssmars-prepared-camera@2");
  assert.equal(PREPARED_MARS_LIGHTING.schema, "cssmars-prepared-lighting@5");
  assert.equal(PREPARED_MARS_LENSES.schema, "cssmars-prepared-lenses@1");
});

test("declares the exact runtime closure and excludes historical delivery", async () => {
  assert.equal(manifest.schema, "cssmars-runtime-assets@1");
  assert.equal(
    manifest.assets.length,
    Object.values(PREPARED_MARS_LIGHTING.banks).reduce(
      (count, bank) => count + bank.rows.length,
      44,
    ),
  );
  const declared = array(shape({filename:text}))(manifest.assets).map(({filename})=>filename);
  assert.equal(new Set(declared).size, declared.length);
  assert.deepEqual(declared, [...declared].sort((left, right) =>
    left.localeCompare(right)));
  const actual = (await readdir(publicRoot))
    .sort((left, right) => left.localeCompare(right));
  const retired=JSON.parse((await readFile(new URL('source/preparation/retired-delivery.json',objectRoot))).toString('utf8'));
  assert.equal(retired.schema,'cssearth-retired-delivery@1');
  assert.deepEqual(array(shape({filename:text}))(retired.assets).map(e=>e.filename).sort(),['mars-moon-billboards.webp','mars-moon-billboards@2x.webp']);
  assert.deepEqual(actual,declared);
  for(const asset of retired.assets) assert.equal(actual.includes(asset.filename),false);
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
});
test("prepares the Mars shell title without a runtime font", () => {
  assert.equal(PREPARED_MARS_TITLE.label, "Mars");
  assert.equal(PREPARED_MARS_TITLE.source, "Inter Variable 4.001 git-9221beed3");
  assert.equal(PREPARED_MARS_TITLE.sourceSha256,
    "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.equal(PREPARED_MARS_TITLE.weight, 500);
  assert.equal(PREPARED_MARS_TITLE.opticalSize, 28);
  assert.equal(PREPARED_MARS_TITLE.sourceGenerator,'tools/prepare-planet-title-sources.mts');
  assert.match(PREPARED_MARS_TITLE.path, /^M0 29L0 8\.63/u);
  assert.doesNotMatch(PREPARED_MARS_TITLE.path, /<text|font-family/iu);
});
