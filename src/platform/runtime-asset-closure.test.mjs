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
  verifyRuntimeAssetClosure,
} from "./runtime-asset-closure.mjs";

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
