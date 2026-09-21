import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { required } from './navigation-test-values.mts';
import { SourceEvidence } from './source-evidence-values.mts';
import { SCENE_OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "./authored-object-fixture.mts";
import { planetInformationSource, validatePlanetEditorial } from "../../tools/planet-information-sources.mts";
import {
  objectPackagePaths,
  validateObjectPackageFiles,
  validatePlanetData,
  validateRuntimeAssetManifest,
} from "../../tools/object-package-contract.mts";

const implemented = SCENE_OBJECTS;

test("accepts a complete non-NASA package and still rejects corrupt or undeclared bytes", async (context) => {
  const projectRoot = await mkdtemp(resolve(tmpdir(), "cssearth-provider-neutral-"));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  const object = { id: "local-body", name: "LocalBody" };
  const paths = objectPackagePaths(object, projectRoot, true);
  for (const file of [...paths.requiredFiles, ...paths.backlogFiles]) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, "fixture\n"); }
  const bytes = Buffer.from("owned prepared bytes");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const body = authoredObjectFixture(object.id, { path: "source/local-data.bin" });
  const fixture = { ...body, properties: { ...body.properties, page: { stylesheets: ["src/body.css"] } } };
  await writeFile(resolve(paths.root, "object.json"), JSON.stringify(fixture));
  for (const path of ["src/body.css", "site/planet-shell.css"]) { await mkdir(dirname(resolve(projectRoot,path)), {recursive:true}); await writeFile(resolve(projectRoot,path), ""); }
  await mkdir(paths.publicAssets, { recursive: true });
  await writeFile(resolve(paths.publicAssets, "surface.webp"), bytes);
  await writeFile(resolve(paths.sourceRoot, "local-data.bin"), bytes);
  await writeFile(paths.runtimeAssets, JSON.stringify({ schema: "csslocal-body-runtime-assets@1", assets: [{ filename: "surface.webp", bytes: bytes.length, sha256: hash }] }));
  await writeFile(paths.sourceManifest, JSON.stringify({ schema: "csslocal-body-authoritative-sources@2", inputs: [{ id: "local", path: "local-data.bin", expectedSha256: hash, expectedBytes: bytes.length, origin: "Project-authored test fixture", credit: "cssEarth", license: "MIT", acquisition: "Checked local fixture", redistribution: "MIT", sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ["scene"] }], generatedIntermediates: [], documents: [] }));
  assert.deepEqual(await validatePlanetData(object, { projectRoot }), { assetCount: 1, sourceInputCount: 1 });
  await writeFile(resolve(paths.publicAssets, "surface.webp"), "corrupt");
  await assert.rejects(validatePlanetData(object, { projectRoot }), /runtime asset drifted/);
  await writeFile(resolve(paths.publicAssets, "surface.webp"), bytes);
  await writeFile(resolve(paths.sourceRoot, "undeclared.bin"), "hidden source");
  await assert.rejects(validatePlanetData(object, { projectRoot }), /undeclared|Undeclared|closure/);
});

test("derives the complete owned file contract from planet identity", () => {
  const planet = implemented[0];
  const paths = objectPackagePaths(planet, "/project", true);
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${planet.id}/prepared/content.json`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${planet.id}/prepared/runtime.json`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/site/pages/[id].astro`,
  ));
  assert.ok(paths.backlogFiles.includes(
    `/project/tests/objects/browser/${planet.id}/browser-profile.mts`,
  ));
  assert.ok(!paths.requiredFiles.includes(
    `/project/tests/objects/browser/${planet.id}/browser-profile.mts`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${planet.id}/object.json`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${planet.id}/source/manifest.json`,
  ));
  assert.ok(paths.requiredFiles.every((file) => !file.includes('/data/planets/')));
  assert.ok(paths.requiredFiles.every(file => !/src\/objects\/[^/]+\/(?:tools|test|site|runtime)\//u.test(file)));
});

test("requires every registered object package file", async () => {
  for (const planet of implemented) {
    await validateObjectPackageFiles(planet);
    const controls = SourceEvidence.parse(JSON.parse(await readFile(new URL(`../../src/objects/${planet.id}/prepared/controls.json`, import.meta.url), 'utf8')));
    assert.ok(controls.child('lenses').rows('controls').length > 0, `${planet.id}: the displayed surface needs an identified dataset`);
  }
  await assert.rejects(
    validateObjectPackageFiles(implemented[0], {
      accessFile: async (file) => {
        assert.ok(typeof file === "string", "Package validator passes filesystem paths");
        if (file.endsWith("prepared/runtime.json")) throw new Error("ENOENT");
      },
    }),
    /is missing .*prepared\/runtime\.json/,
  );
  await assert.rejects(
    validateObjectPackageFiles(implemented[0], {
      accessFile: async (file) => {
        assert.ok(typeof file === "string", "Package validator passes filesystem paths");
        if (file.endsWith("prepared/content.json")) throw new Error("ENOENT");
      },
    }),
    /is missing .*prepared\/content\.json/,
  );
  const backlogged = await validateObjectPackageFiles(implemented[0], {
    accessFile: async (file) => {
      assert.ok(typeof file === "string", "Package validator passes filesystem paths");
      if (file.endsWith("browser-profile.mts")) throw new Error("ENOENT");
    },
  });
  assert.equal(backlogged.missingBacklogFiles.length, 1);
  assert.ok(backlogged.missingBacklogFiles[0]?.endsWith("browser-profile.mts"));
});

test("validates local editorial identity and provenance", () => {
  const planet = required(implemented.find(object => object.id === "sun"));
  const source = required(planetInformationSource(planet.id));
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
