import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { required } from './navigation-test-values.mts';
import { SourceEvidence } from './source-evidence-values.mts';
import { SCENE_OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "./authored-object-fixture.mts";
import { objectInformationSource, validateObjectEditorial } from "../../tools/sources/object-information-sources.mts";
import {
  objectPackagePaths,
  validateObjectPackageFiles,
  validateObjectData,
  validateInventory,
} from "../../tools/contract/object-package-contract.mts";

const implemented = SCENE_OBJECTS;

test("accepts a complete non-NASA package and still rejects corrupt or undeclared bytes", async (context) => {
  const projectRoot = await mkdtemp(resolve(tmpdir(), "cssearth-provider-neutral-"));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  const object = { id: "local-body", name: "LocalBody" };
  const paths = objectPackagePaths(object, projectRoot, true);
  for (const file of paths.requiredFiles) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, "fixture\n"); }
  const bytes = Buffer.from("owned prepared bytes");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const body = authoredObjectFixture(object.id, { path: "source/local-data.bin" });
  const fixture = { ...body, properties: { ...body.properties, page: { stylesheets: ["src/body.css"] } } };
  await writeFile(resolve(paths.root, "object.json"), JSON.stringify(fixture));
  for (const path of ["src/body.css", "site/object-shell.css"]) { await mkdir(dirname(resolve(projectRoot,path)), {recursive:true}); await writeFile(resolve(projectRoot,path), ""); }
  await mkdir(paths.publicAssets, { recursive: true });
  await writeFile(resolve(paths.publicAssets, "surface.webp"), bytes);
  await writeFile(resolve(paths.sourceRoot, "local-data.bin"), bytes);
  await writeFile(paths.inventory, JSON.stringify({ schema: "cssearth-inventory@1", assets: [{ location: "public", filename: "surface.webp", bytes: bytes.length, sha256: hash }] }));
  await writeFile(paths.sourceManifest, JSON.stringify({ schema: "cssearth-authoritative-sources@2", inputs: [{ id: "local", path: "local-data.bin", origin: "Project-authored test fixture", credit: "cssEarth", license: "MIT", acquisition: "Checked local fixture", redistribution: "MIT", sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ["scene"] }], generatedIntermediates: [], documents: [] }));
  assert.deepEqual(await validateObjectData(object, { projectRoot }), { assetCount: 1, sourceInputCount: 1 });
  await writeFile(resolve(paths.publicAssets, "surface.webp"), "corrupt");
  await assert.rejects(validateObjectData(object, { projectRoot }), /public asset drifted/);
  await writeFile(resolve(paths.publicAssets, "surface.webp"), bytes);
  await writeFile(resolve(paths.sourceRoot, "undeclared.bin"), "hidden source");
  await assert.rejects(validateObjectData(object, { projectRoot }), /undeclared|Undeclared|closure/);
});

test("derives the complete owned file contract from object identity", () => {
  const first = implemented[0];
  const paths = objectPackagePaths(first, "/project", true);
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${first.id}/prepared/content.json`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${first.id}/prepared/runtime.json`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/site/pages/[id].astro`,
  ));
  assert.ok(!paths.requiredFiles.includes(
    `/project/tests/objects/browser/${first.id}/browser-profile.mts`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${first.id}/object.json`,
  ));
  assert.ok(paths.requiredFiles.includes(
    `/project/src/objects/${first.id}/source/manifest.json`,
  ));
  assert.ok(paths.requiredFiles.every((file) => !file.includes('/data/object-information/')));
  assert.ok(paths.requiredFiles.every(file => !/src\/objects\/[^/]+\/(?:tools|test|site|runtime)\//u.test(file)));
});

test("requires every registered object package file", async () => {
  for (const entry of implemented) {
    await validateObjectPackageFiles(entry);
    const controls = SourceEvidence.parse(JSON.parse(await readFile(new URL(`../../src/objects/${entry.id}/prepared/controls.json`, import.meta.url), 'utf8')));
    assert.ok(controls.child('lenses').rows('controls').length > 0, `${entry.id}: the displayed surface needs an identified dataset`);
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
  // A file the contract no longer asks for (the retired browser profiles) must not become a hard failure.
  await validateObjectPackageFiles(implemented[0], {
    accessFile: async (file) => {
      assert.ok(typeof file === "string", "Package validator passes filesystem paths");
      if (file.endsWith("browser-profile.mts")) throw new Error("ENOENT");
    },
  });
});

test("validates local editorial identity and provenance", () => {
  const sun = required(implemented.find(object => object.id === "sun"));
  const source = required(objectInformationSource(sun.id));
  const valid = {
    schemaVersion: 1,
    id: sun.id,
    planet: sun.name,
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
  assert.equal(validateObjectEditorial(sun, valid), true);
  assert.throws(
    () => validateObjectEditorial(sun, { ...valid, id: "wrong" }),
    /editorial snapshot is incompatible/,
  );
  assert.throws(
    () => validateObjectEditorial(sun, { ...valid, sourceUrl: "not a URL" }),
    /editorial snapshot is incompatible/,
  );
});

test("validates runtime asset manifest entries", () => {
  const objectId = "fixture";
  const valid = {
    schema: 'cssearth-inventory@1',
    assets: [{
      location: "public",
      filename: "surface.webp",
      bytes: 42,
      sha256: "a".repeat(64),
    }],
  };
  assert.equal(validateInventory(objectId, valid), true);
  assert.throws(
    () => validateInventory(objectId, {
      ...valid,
      assets: [...valid.assets, ...valid.assets],
    }),
    /repeats inventory entry/,
  );
  assert.throws(
    () => validateInventory(objectId, {
      ...valid,
      assets: [{ ...valid.assets[0], filename: "../escape.webp" }],
    }),
    /invalid inventory entry/,
  );
});

test("prepare-provenance covers exactly the layered bodies, so only they leave provenance.json out of the inventory", async () => {
  const layered = new Set<string>();
  for (const id of await readdir(new URL("../../src/objects/", import.meta.url))) {
    const text = await readFile(new URL(`../../src/objects/${id}/object.json`, import.meta.url), "utf8").catch(() => null);
    if (text !== null && JSON.parse(text).type === "layered-body") layered.add(id);
  }
  assert.deepEqual([...layered].sort(), SCENE_OBJECTS.map(object => object.id).sort());
});
