import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import { auditObjectRuntimeOwnership } from "../../tools/ci/check-object-runtime-ownership.mts";
import { loadObjectContent } from "./load-object-content.mts";
import { SCENE_OBJECTS } from "../objects.mts";
import { required } from './navigation-test-values.mts';
import { SourceEvidence } from './source-evidence-values.mts';
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../runtime-policy.mts";

test("every object mounts one canonical high-density image bank", async () => {
  assert.equal(CANONICAL_PREPARED_IMAGE_DENSITY, 2);
  const ownership = await auditObjectRuntimeOwnership();
  assert.equal(ownership.complete, true);
  const head = await readFile(new URL("../components/PreparedObjectHead.astro", import.meta.url), "utf8");
  assert.doesNotMatch(head, /imagesrcset|devicePixelRatio/u);
  for (const { id } of SCENE_OBJECTS) {
    const entry = required(ownership.entries.find(entry => entry.id === id));
    assert.equal(entry.factoryCalls, 1, id + ": actual loader must have one runtime factory");
    assert.equal(required(entry.presentation).format, "json", id + ": runtime consumes prepared data");
    const { object } = await loadObjectContent(id);
    const data = SourceEvidence.parse(object.data), assets = data.child('assets');
    const entries = assets.rows('entries').map(asset => ({ key: asset.text('key'), url: asset.text('url') }));
    const startupKeys = new Set(assets.strings('startup'));
    const startupUrls = entries.filter(asset => startupKeys.has(asset.key))
      .map(asset => asset.url).filter(url => typeof url === "string");
    assert.ok(startupUrls.some(url => url.includes("@2x")), id + ": high-density startup assets");
    const availableFiles = new Set(await readdir(new URL("../../public/scenes/" + id + "/", import.meta.url)));
    for (const { url } of entries) {
      if (typeof url !== "string" || !url.startsWith("/scenes/" + id + "/") || url.includes("@2x")) continue;
      const file = required(url.split("/").at(-1));
      assert.equal(availableFiles.has(file.replace(/(\.[^.]+)$/u, "@2x$1")), false,
        id + ": runtime must not select " + file + " when its high-density bank exists");
    }
    assert.doesNotMatch(JSON.stringify(object.data), /image-set\(|devicePixelRatio/u);
  }
  const stylesRoot = new URL("../../src/renderers/css/styles/", import.meta.url);
  for (const file of await readdir(stylesRoot)) {
    if (file.endsWith(".css")) assert.doesNotMatch(await readFile(new URL(file, stylesRoot), "utf8"),
      /image-set\(/u, file + ": CSS must not select assets by device DPR");
  }
  for (const file of ownership.sharedClosure.filter(file => file.startsWith("src/renderers/css/") || file === "site/packaged-object-runtime.mts")) {
    assert.doesNotMatch(await readFile(new URL("../../" + file, import.meta.url), "utf8"),
      /image-set\(|devicePixelRatio/u, file + ": renderer must not select assets by device DPR");
  }
});

test("the shared shell does not choose image assets by device DPR", async () => {
  const shellFiles = [
    "planet-navigation-marker.css",
    "planet-shell.css",
  ];
  const sources = await Promise.all(shellFiles.map(async (fileName) => ({
    fileName,
    source: await readFile(new URL(`../${fileName}`, import.meta.url), "utf8"),
  })));
  for (const { fileName, source } of sources) {
    assert.doesNotMatch(
      source,
      /image-set\(/u,
      `${fileName}: shared UI must not select assets by device DPR`,
    );
  }
});
