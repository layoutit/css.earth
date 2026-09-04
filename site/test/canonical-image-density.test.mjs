import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { OBJECTS } from "../objects.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../runtime-policy.mjs";

test("every object mounts one canonical high-density image bank", async () => {
  assert.equal(CANONICAL_PREPARED_IMAGE_DENSITY, 2);
  for (const objectRecord of OBJECTS) {
    const objectRoot = new URL(
      `../../src/planets/${objectRecord.id}/`,
      import.meta.url,
    );
    const [client, head, styles] = await Promise.all([
      readFile(new URL("runtime/client.mjs", objectRoot), "utf8"),
      readFile(
        new URL(`site/${objectRecord.name}Head.astro`, objectRoot),
        "utf8",
      ),
      readFile(new URL("runtime/styles.css", objectRoot), "utf8"),
    ]);
    assert.match(
      client,
      /CANONICAL_PREPARED_IMAGE_DENSITY/u,
      `${objectRecord.id}: client must use the canonical image bank`,
    );
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
        /image-set\(/u,
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
  assert.match(sources[1].source, /planet-markers@2x\.webp/u);
  assert.match(sources[2].source, /blackhole-marker@2x\.png/u);
  assert.match(sources[2].source, /supernova-marker@2x\.png/u);
  assert.match(sources[2].source, /settings-marker@2x\.webp/u);
});
