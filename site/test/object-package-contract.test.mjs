import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { OBJECTS } from "../objects.mjs";
import { planetInformationSource, validatePlanetEditorial } from "../../tools/planet-information-sources.mjs";
import {
  objectPackagePaths,
  validateObjectPackageFiles,
  validatePlanetData,
  validateRuntimeAssetManifest,
} from "../../tools/object-package-contract.mjs";

const implemented = OBJECTS;

test("accepts a complete non-NASA package and still rejects corrupt or undeclared bytes", async (context) => {
  const projectRoot = await mkdtemp(resolve(tmpdir(), "cssearth-provider-neutral-"));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  const object = { id: "local-body", name: "LocalBody" };
  const paths = objectPackagePaths(object, projectRoot);
  for (const file of paths.requiredFiles) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, "fixture\n"); }
  const bytes = Buffer.from("owned prepared bytes");
  const hash = createHash("sha256").update(bytes).digest("hex");
  await mkdir(paths.publicAssets, { recursive: true });
  await writeFile(resolve(paths.publicAssets, "surface.webp"), bytes);
  await writeFile(resolve(paths.sourceRoot, "local-data.bin"), bytes);
  await writeFile(paths.runtimeAssets, JSON.stringify({ schema: "csslocal-body-runtime-assets@1", assets: [{ filename: "surface.webp", bytes: bytes.length, sha256: hash }] }));
  await writeFile(paths.sourceManifest, JSON.stringify({ schema: "csslocal-body-authoritative-sources@1", inputs: [{ id: "local", path: "local-data.bin", expectedSha256: hash, expectedBytes: bytes.length, origin: "Project-authored test fixture", credit: "cssEarth", license: "MIT", acquisition: "Checked local fixture", redistribution: "MIT", consumers: ["scene"] }], generatedIntermediates: [], documents: [] }));
  assert.deepEqual(await validatePlanetData(object, { projectRoot }), { assetCount: 1, sourceInputCount: 1 });
  await writeFile(resolve(paths.publicAssets, "surface.webp"), "corrupt");
  await assert.rejects(validatePlanetData(object, { projectRoot }), /runtime asset drifted/);
  await writeFile(resolve(paths.publicAssets, "surface.webp"), bytes);
  await writeFile(resolve(paths.sourceRoot, "undeclared.bin"), "hidden source");
  await assert.rejects(validatePlanetData(object, { projectRoot }), /undeclared|Undeclared|closure/);
});

test("derives the complete owned file contract from planet identity", () => {
  const planet = implemented[0];
  const paths = objectPackagePaths(planet, "/project");
  assert.ok(paths.requiredFiles.includes(
    `/project/src/planets/${planet.id}/runtime/client.mjs`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/planets/${planet.id}/site/${planet.name}Page.astro`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/planets/${planet.id}/test/browser-profile.mjs`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/planets/${planet.id}/test/smoke-browser.mjs`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/planets/${planet.id}/tools/prepare.mjs`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/planets/${planet.id}/tools/acquire.mjs`,
  ));
  assert.ok(paths.requiredFiles.every((file) => !file.includes('/data/planets/')));
});

test("requires every registered object package file", async () => {
  for (const planet of implemented) await validateObjectPackageFiles(planet);
  await assert.rejects(
    validateObjectPackageFiles(implemented[0], {
      accessFile: async (file) => {
        if (file.endsWith("runtime/client.mjs")) throw new Error("ENOENT");
      },
    }),
    /is missing .*runtime\/client\.mjs/,
  );
});

test("validates local editorial identity and provenance", () => {
  const planet = implemented[0];
  const source = planetInformationSource(planet.id);
  const valid = {
    schemaVersion: 1,
    id: planet.id,
    planet: planet.name,
    title: source.expectedTitle,
    sourceId: source.sourceId,
    sourceUrl: source.sourceUrl,
    recordApiUrl: source.recordApiUrl,
    blocksApiUrl: source.blocksApiUrl,
    modified: "2026-07-10T12:04:15",
    retrievedAt: "2026-08-30",
    credit: "NASA Science",
    introduction: "Prepared introduction.",
    sections: Array.from({ length: 8 }, (_, index) => ({
      heading: `Section ${index + 1}`,
      paragraphs: ["Prepared paragraph."],
    })),
  };
  assert.equal(validatePlanetEditorial(planet, valid), true);
  assert.throws(
    () => validatePlanetEditorial(planet, { ...valid, id: "wrong" }),
    /editorial snapshot is incompatible/,
  );
  assert.throws(
    () => validatePlanetEditorial(planet, { ...valid, sourceUrl: "not a URL" }),
    /editorial snapshot is incompatible/,
  );
});

test("validates runtime asset manifest entries", () => {
  const planetId = "fixture";
  const valid = {
    schema: `css${planetId}-runtime-assets@1`,
    assets: [{
      filename: "surface.webp",
      bytes: 42,
      sha256: "a".repeat(64),
    }],
  };
  assert.equal(validateRuntimeAssetManifest(planetId, valid), true);
  assert.throws(
    () => validateRuntimeAssetManifest(planetId, {
      ...valid,
      assets: [...valid.assets, ...valid.assets],
    }),
    /repeats runtime asset/,
  );
  assert.throws(
    () => validateRuntimeAssetManifest(planetId, {
      ...valid,
      assets: [{ ...valid.assets[0], filename: "../escape.webp" }],
    }),
    /invalid runtime asset entry/,
  );
});

test("verifies checked-in data and runtime asset bytes for every object package", async () => {
  const results = [];
  for (const planet of implemented) results.push(await validatePlanetData(planet));
  assert.ok(results.every(({ assetCount }) => assetCount > 0));
  assert.ok(results.every(({ sourceInputCount }) => sourceInputCount > 0));
  assert.ok(results.every((result) => !('editorialSourceId' in result)));
});
