import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  assembleRuntimeAssetClosure,
  normalizeRuntimeAssetUrls,
  prepareRuntimeAssetManifest,
  preparePreparedAssetManifest,
  validatePreparedAssetManifest,
  verifyPreparedAssetClosure,
  verifyRuntimeAssetClosure,
} from "./runtime-asset-closure.mts";

test("normalizes only explicit safe local runtime URLs", () => {
  assert.deepEqual(normalizeRuntimeAssetUrls({
    planetId: "fixture",
    urls: ["/scenes/fixture/b.webp", "/scenes/fixture/a@2x.webp"],
  }), ["a@2x.webp", "b.webp"]);
  assert.throws(() => normalizeRuntimeAssetUrls({
    planetId: "fixture",
    urls: ["/scenes/fixture/../escape.webp"],
  }), /unsafe runtime asset URL/);
  assert.throws(() => normalizeRuntimeAssetUrls({
    planetId: "fixture",
    urls: ["/scenes/fixture/a.webp", "/scenes/fixture/a.webp"],
  }), /repeats runtime asset/);
});

test("prepares and verifies the exact declared byte closure", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "runtime-assets-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const publicRoot = resolve(root, "public");
  await mkdir(publicRoot);
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a");
  const manifestPath = resolve(root, "manifest.json");
  const manifest = await prepareRuntimeAssetManifest({
    planetId: "fixture",
    urls: ["/scenes/fixture/a.webp"],
    publicRoot,
    manifestPath,
  });
  assert.equal(manifest.assets[0].sha256,
    createHash("sha256").update("asset-a").digest("hex"));
  assert.equal(await verifyRuntimeAssetClosure({
    planetId: "fixture",
    manifest,
    root: publicRoot,
  }), true);
  await writeFile(resolve(publicRoot, "a.webp"), "drifted");
  await assert.rejects(verifyRuntimeAssetClosure({
    planetId: "fixture",
    manifest,
    root: publicRoot,
  }), /runtime asset drifted/);
});

test("rejects undeclared public files and removes only undeclared production files", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "runtime-assets-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const publicRoot = resolve(root, "public");
  await mkdir(publicRoot);
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a");
  await writeFile(resolve(publicRoot, "extra.webp"), "extra");
  await assert.rejects(prepareRuntimeAssetManifest({
    planetId: "fixture",
    urls: ["/scenes/fixture/a.webp"],
    publicRoot,
    manifestPath: resolve(root, "manifest.json"),
  }), /Undeclared: extra\.webp/);

  await rm(resolve(publicRoot, "extra.webp"));
  const manifestPath = resolve(root, "manifest.json");
  await prepareRuntimeAssetManifest({
    planetId: "fixture",
    urls: ["/scenes/fixture/a.webp"],
    publicRoot,
    manifestPath,
  });
  const productionRoot = resolve(root, "production");
  await mkdir(productionRoot);
  await writeFile(resolve(productionRoot, "a.webp"), "asset-a");
  await writeFile(resolve(productionRoot, "extra.webp"), "extra");
  await assembleRuntimeAssetClosure({ planetId: "fixture", manifestPath, productionRoot });
  assert.deepEqual(await readdir(productionRoot), ["a.webp"]);
  assert.equal(JSON.parse(await readFile(manifestPath, "utf8")).assets.length, 1);
});

test("prepared-assets: explicit filenames cover only a subset of prepared/, ignoring its other tracked files", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "prepared-assets-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const preparedRoot = resolve(root, "prepared");
  await mkdir(preparedRoot);
  await writeFile(resolve(preparedRoot, "runtime.json"), "runtime-bytes");
  await writeFile(resolve(preparedRoot, "scene.json"), "scene-bytes");
  await writeFile(resolve(preparedRoot, "provenance.json"), "kept-tracked");
  const manifestPath = resolve(root, "prepared-assets.json");
  const manifest = await preparePreparedAssetManifest({
    planetId: "fixture", preparedRoot, manifestPath, filenames: ["runtime.json", "scene.json"],
  });
  assert.equal(manifest.schema, "cssfixture-prepared-assets@1");
  assert.equal(manifest.resourceRoot, "prepared");
  assert.deepEqual(manifest.assets.map(a => a.filename), ["runtime.json", "scene.json"]);
  assert.equal(validatePreparedAssetManifest("fixture", manifest), true);
  // Subset verification tolerates the untracked-from-this-manifest provenance.json neighbor.
  assert.equal(await verifyPreparedAssetClosure({ planetId: "fixture", manifest, root: preparedRoot, closure: false }), true);
  await writeFile(resolve(preparedRoot, "runtime.json"), "drifted");
  await assert.rejects(verifyPreparedAssetClosure({ planetId: "fixture", manifest, root: preparedRoot, closure: false }), /prepared asset drifted: runtime\.json/);
  await writeFile(resolve(preparedRoot, "runtime.json"), "runtime-bytes");
  await rm(resolve(preparedRoot, "scene.json"));
  await assert.rejects(verifyPreparedAssetClosure({ planetId: "fixture", manifest, root: preparedRoot, closure: false }), /Missing: scene\.json/);
});

test("prepared-assets: nested closure mode inventories every file under prepared/ except the excluded ones", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "prepared-assets-closure-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const preparedRoot = resolve(root, "prepared");
  await mkdir(resolve(preparedRoot, "atlases"), { recursive: true });
  await writeFile(resolve(preparedRoot, "lenses.json"), "lens-bytes");
  await writeFile(resolve(preparedRoot, "atlases/x.webp"), "atlas-bytes");
  await writeFile(resolve(preparedRoot, "local-drift.json"), "not inventoried");
  const manifestPath = resolve(root, "prepared-assets.json");
  const manifest = await preparePreparedAssetManifest({
    planetId: "context-nebula", preparedRoot, manifestPath, exclude: ["local-drift.json"],
  });
  assert.deepEqual(manifest.assets.map(a => a.filename), ["atlases/x.webp", "lenses.json"]);
  // Full closure verification tolerates only the named exclusion, not any other undeclared file.
  await assert.doesNotReject(verifyPreparedAssetClosure({ planetId: "context-nebula", manifest, root: preparedRoot, exclude: ["local-drift.json"] }));
  await writeFile(resolve(preparedRoot, "undeclared.json"), "surprise");
  await assert.rejects(verifyPreparedAssetClosure({ planetId: "context-nebula", manifest, root: preparedRoot, exclude: ["local-drift.json"] }), /Undeclared: undeclared\.json/);
  await rm(resolve(preparedRoot, "undeclared.json"));
  await assert.rejects(verifyPreparedAssetClosure({ planetId: "context-nebula", manifest, root: preparedRoot }), /Undeclared: local-drift\.json/);
});

test("prepared-assets: refuses to inventory a git-tracked file, which setup:assets/setup:prepared would overwrite", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "prepared-assets-tracked-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const preparedRoot = resolve(root, "prepared");
  await mkdir(preparedRoot);
  await writeFile(resolve(preparedRoot, "runtime.json"), "runtime-bytes");
  await writeFile(resolve(preparedRoot, "provenance.json"), "tracked-contract-bytes");
  const manifestPath = resolve(root, "prepared-assets.json");
  const trackedPath = resolve(preparedRoot, "provenance.json");
  await assert.rejects(preparePreparedAssetManifest({
    planetId: "fixture", preparedRoot, manifestPath, filenames: ["runtime.json", "provenance.json"],
    gitTrackedPaths: async paths => new Set(paths.filter(path => path === trackedPath)),
  }), /git-tracked.*provenance\.json/);
  // A filename this call never asked to inventory being tracked elsewhere must not affect it.
  const manifest = await preparePreparedAssetManifest({
    planetId: "fixture", preparedRoot, manifestPath, filenames: ["runtime.json"],
    gitTrackedPaths: async () => new Set([resolve(preparedRoot, "some-other-tracked-file.json")]),
  });
  assert.deepEqual(manifest.assets.map(a => a.filename), ["runtime.json"]);
});

test("prepared-assets: a real mimas object's tracked contract file is refused if added to its inventory", async (context) => {
  // Reproduces the live gap found in review: nothing stopped a git-tracked contract file from being listed in a
  // prepared-assets inventory (a body's provenance.json was added to it and every suite stayed green). Exercises
  // the default (real git) tracked-path lookup against this actual checkout, not an injected fake.
  //
  // Only content.json (still git-tracked, always present in a checkout) is listed here — not runtime.json,
  // which setup:assets/setup:prepared restores from R2 and is not guaranteed to exist yet wherever this test
  // runs. preparePreparedAssetManifest checks each listed filename exists before checking git-tracked status, so
  // listing runtime.json would make this guard's own pass/fail depend on that unrelated restore having already
  // happened; the fixture simply does not need that file to exercise the guard.
  //
  // manifestPath points at a throwaway temp file, never the real tracked src/objects/mimas/prepared-assets.json:
  // the guard is expected to reject before any write, but a regression that reached the write must not be able
  // to corrupt a tracked file as a side effect of running this test.
  const preparedRoot = resolve(import.meta.dirname, "../../src/objects/mimas/prepared");
  const tempDirectory = await mkdtemp(resolve(tmpdir(), "mimas-tracked-guard-"));
  context.after(() => rm(tempDirectory, { recursive: true, force: true }));
  await assert.rejects(preparePreparedAssetManifest({
    planetId: "mimas", preparedRoot, manifestPath: resolve(tempDirectory, "prepared-assets.json"),
    filenames: ["content.json"],
  }), /git-tracked.*content\.json/);
});
