import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { auditObjectRuntimeOwnership } from "../../tools/check-object-runtime-ownership.mjs";
import { OBJECTS } from "../objects.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../runtime-policy.mjs";

test("every object mounts one canonical high-density image bank", async () => {
  assert.equal(CANONICAL_PREPARED_IMAGE_DENSITY, 2);
  const ownership = await auditObjectRuntimeOwnership();
  assert.equal(ownership.complete, true);
  for (const objectRecord of OBJECTS) {
    const entry = ownership.entries.find(entry => entry.id === objectRecord.id);
    assert.equal(entry.factoryCalls, 1,
      `${objectRecord.id}: its actual registered loader must have one runtime factory`);
    if (entry.migrated && (objectRecord.id === "mercury" || objectRecord.id === "venus")) {
      const page = await readFile(
        new URL(`../pages/${objectRecord.id}.astro`, import.meta.url),
        "utf8",
      );
      const prepared = JSON.parse(await readFile(
        new URL(`../../src/planets/${objectRecord.id}/prepared/object.json`, import.meta.url),
        "utf8",
      ));
      const startupKeys = new Set(prepared.data.assets.startup);
      const startupUrls = prepared.data.assets.entries
        .filter(asset => startupKeys.has(asset.key))
        .map(asset => asset.url)
        .filter(url => typeof url === "string");
      const sharedStyles = await readFile(
        new URL("../../src/renderers/css/styles/planet-surfaces.css", import.meta.url),
        "utf8",
      );
      assert.match(page, /PreparedObjectHead/u,
        `${objectRecord.id}: migrated page must use the shared prepared head`);
      assert.ok(startupUrls.some(url => url.includes("@2x")),
        `${objectRecord.id}: prepared startup assets must include a high-density asset`);
      assert.doesNotMatch(sharedStyles, /image-set\(/u,
        `${objectRecord.id}: shared scene CSS must not select assets by device DPR`);
      continue;
    }
    const objectRoot = new URL(
      `../../src/planets/${objectRecord.id}/`,
      import.meta.url,
    );
    const [client, head, styles] = await Promise.all([
      readFile(new URL(`../../${entry.entry.adapter ?? entry.entry.file}`, import.meta.url), "utf8"),
      readFile(
        new URL(`site/${objectRecord.name}Head.astro`, objectRoot),
        "utf8",
      ),
      readFile(new URL("runtime/styles.css", objectRoot), "utf8"),
    ]);
    assert.doesNotMatch(
      client,
      /devicePixelRatio/u,
      `${objectRecord.id}: device DPR must not select scene assets`,
    );
    assert.doesNotMatch(
      head,
      /imagesrcset/u,
      `${objectRecord.id}: preload must not select a low-density asset`,
    );
    assert.match(
      head,
      /@2x|\["2"\]/u,
      `${objectRecord.id}: preload must include a high-density asset`,
    );
    assert.doesNotMatch(
      styles,
      /image-set\(/u,
      `${objectRecord.id}: scene CSS must not select assets by device DPR`,
    );
    const runtimeRoot = new URL("runtime/", objectRoot);
    const runtimeModules = (await readdir(runtimeRoot))
      .filter((fileName) => fileName.endsWith(".mjs"));
    const runtimeSources = await Promise.all(runtimeModules.map(async (fileName) => ({
      fileName,
      source: await readFile(new URL(fileName, runtimeRoot), "utf8"),
    })));
    for (const { fileName, source } of runtimeSources) {
      assert.doesNotMatch(
        source,
        /image-set\(|devicePixelRatio/u,
        `${objectRecord.id}/${fileName}: runtime must not select assets by device DPR`,
      );
    }
  }
});

test("the shared shell mounts only canonical high-density image assets", async () => {
  const shellFiles = [
    "planet-navigation-marker.css",
    "planetary-scale.css",
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
  assert.match(sources[0].source, /planet-markers@2x\.webp/u);
  assert.doesNotMatch(sources[1].source, /planet-markers(?:@2x)?\.webp/u);
  assert.doesNotMatch(sources[2].source, /blackhole-marker|supernova-marker|settings-marker/u);
});
