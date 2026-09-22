import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  assembleRuntimeAssetClosure, inventoryPreparedAssets, inventoryPublicAssets, normalizeRuntimeAssetUrls,
  readInventory, updateInventory, validateInventory, verifyInventory,
} from "./runtime-asset-closure.mts";

const digest = (text: string) => createHash("sha256").update(text).digest("hex");

test("normalizes only explicit safe local runtime URLs", () => {
  assert.deepEqual(normalizeRuntimeAssetUrls({ planetId: "fixture", urls: ["/scenes/fixture/b.webp", "/scenes/fixture/a@2x.webp"] }), ["a@2x.webp", "b.webp"]);
  assert.throws(() => normalizeRuntimeAssetUrls({ planetId: "fixture", urls: ["/scenes/fixture/../escape.webp"] }), /unsafe runtime asset URL/);
  assert.throws(() => normalizeRuntimeAssetUrls({ planetId: "fixture", urls: ["/scenes/fixture/a.webp", "/scenes/fixture/a.webp"] }), /repeats runtime asset/);
});

test("one inventory per object: each location is written by its own stage and keeps the other's entries", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "inventory-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const objectDirectory = resolve(root, "src/objects/fixture"), publicRoot = resolve(root, "public/scenes/fixture"), preparedRoot = resolve(objectDirectory, "prepared");
  await mkdir(publicRoot, { recursive: true }); await mkdir(resolve(preparedRoot, "atlases"), { recursive: true });
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a");
  await writeFile(resolve(preparedRoot, "runtime.json"), "runtime-bytes");
  await writeFile(resolve(preparedRoot, "atlases/x.webp"), "atlas-bytes");
  // Regenerated on every checkout, so never inventoried.
  await writeFile(resolve(preparedRoot, "provenance.json"), "generated");
  await writeFile(resolve(preparedRoot, "page.json"), "generated");
  const first = await inventoryPublicAssets({ planetId: "fixture", objectDirectory, urls: ["/scenes/fixture/a.webp"], publicRoot });
  assert.deepEqual(first?.assets, [{ location: "public", filename: "a.webp", bytes: 7, sha256: digest("asset-a") }]);
  const second = await inventoryPreparedAssets({ planetId: "fixture", objectDirectory, gitTrackedPaths: async () => new Set() });
  assert.deepEqual(second?.assets.map(asset => `${asset.location}/${asset.filename}`), ["public/a.webp", "prepared/atlases/x.webp", "prepared/runtime.json"]);
  assert.deepEqual(await readInventory("fixture", objectDirectory), second);
  // Re-inventorying the public textures leaves the prepared entries alone, and vice versa.
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a2");
  const third = await inventoryPublicAssets({ planetId: "fixture", objectDirectory, urls: ["/scenes/fixture/a.webp"], publicRoot });
  assert.equal(third?.assets.find(asset => asset.location === "public")?.sha256, digest("asset-a2"));
  assert.deepEqual(third?.assets.filter(asset => asset.location === "prepared"), second?.assets.filter(asset => asset.location === "prepared"));
  // Nothing baked in either location: no inventory file.
  await updateInventory({ planetId: "fixture", objectDirectory, location: "public", assets: [] });
  await updateInventory({ planetId: "fixture", objectDirectory, location: "prepared", assets: [] });
  assert.equal(await readInventory("fixture", objectDirectory), null);
});

test("verification catches drift and closure gaps per location; the validator rejects unsafe or repeated entries", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "inventory-verify-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const objectDirectory = resolve(root, "src/objects/fixture"), publicRoot = resolve(root, "public/scenes/fixture"), preparedRoot = resolve(objectDirectory, "prepared");
  await mkdir(publicRoot, { recursive: true }); await mkdir(preparedRoot, { recursive: true });
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a"); await writeFile(resolve(preparedRoot, "scene.json"), "scene");
  await inventoryPublicAssets({ planetId: "fixture", objectDirectory, urls: ["/scenes/fixture/a.webp"], publicRoot });
  const inventory = (await inventoryPreparedAssets({ planetId: "fixture", objectDirectory, gitTrackedPaths: async () => new Set() }))!;
  assert.equal(await verifyInventory({ planetId: "fixture", inventory, publicRoot, preparedRoot }), true);
  await writeFile(resolve(publicRoot, "a.webp"), "drifted");
  await assert.rejects(verifyInventory({ planetId: "fixture", inventory, publicRoot, preparedRoot }), /public asset drifted: a\.webp/);
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a");
  await writeFile(resolve(preparedRoot, "undeclared.json"), "surprise");
  await assert.rejects(verifyInventory({ planetId: "fixture", inventory, publicRoot, preparedRoot }), /Undeclared: undeclared\.json/);
  assert.equal(await verifyInventory({ planetId: "fixture", inventory, publicRoot, preparedRoot, closure: false }), true);
  await rm(resolve(preparedRoot, "scene.json"));
  await assert.rejects(verifyInventory({ planetId: "fixture", inventory, publicRoot, preparedRoot, closure: false }), /Missing: scene\.json/);
  const entry = { location: "prepared", filename: "levels/catalogue.json", bytes: 3, sha256: digest("abc") };
  assert.equal(validateInventory("fixture", { schema: "cssearth-inventory@1", assets: [entry] }), true);
  assert.throws(() => validateInventory("fixture", { schema: "cssfixture-runtime-assets@1", assets: [entry] }), /incompatible/);
  assert.throws(() => validateInventory("fixture", { schema: "cssearth-inventory@1", assets: [entry, entry] }), /repeats/);
  assert.throws(() => validateInventory("fixture", { schema: "cssearth-inventory@1", assets: [{ ...entry, location: "other" }] }), /invalid/);
  for (const filename of ["", "../outside", "/absolute", "levels/../outside", "levels/./file", "levels//file", "levels/", "levels\\file", "levels/file?x"]) {
    assert.throws(() => validateInventory("fixture", { schema: "cssearth-inventory@1", assets: [{ ...entry, filename }] }), filename);
  }
});

test("public inventory rejects undeclared textures; assembly removes only undeclared production files", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "inventory-assemble-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const objectDirectory = resolve(root, "src/objects/fixture"), publicRoot = resolve(root, "public/scenes/fixture");
  await mkdir(objectDirectory, { recursive: true }); await mkdir(publicRoot, { recursive: true });
  await writeFile(resolve(publicRoot, "a.webp"), "asset-a"); await writeFile(resolve(publicRoot, "extra.webp"), "extra");
  await assert.rejects(inventoryPublicAssets({ planetId: "fixture", objectDirectory, urls: ["/scenes/fixture/a.webp"], publicRoot }), /Undeclared: extra\.webp/);
  await rm(resolve(publicRoot, "extra.webp"));
  await inventoryPublicAssets({ planetId: "fixture", objectDirectory, urls: ["/scenes/fixture/a.webp"], publicRoot });
  const productionRoot = resolve(root, "production");
  await mkdir(productionRoot);
  await writeFile(resolve(productionRoot, "a.webp"), "asset-a"); await writeFile(resolve(productionRoot, "extra.webp"), "extra");
  await assembleRuntimeAssetClosure({ planetId: "fixture", objectDirectory, productionRoot });
  assert.deepEqual(await readdir(productionRoot), ["a.webp"]);
});

test("a git-tracked file is refused, in a fixture and against the real checkout", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "inventory-tracked-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const objectDirectory = resolve(root, "src/objects/fixture"), preparedRoot = resolve(objectDirectory, "prepared");
  await mkdir(preparedRoot, { recursive: true });
  await writeFile(resolve(preparedRoot, "runtime.json"), "runtime-bytes"); await writeFile(resolve(preparedRoot, "notes.json"), "tracked");
  await assert.rejects(inventoryPreparedAssets({ planetId: "fixture", objectDirectory, filenames: ["runtime.json", "notes.json"],
    gitTrackedPaths: async paths => new Set(paths.filter(path => path.endsWith("notes.json"))) }), /git-tracked.*notes\.json/);
  const inventory = await inventoryPreparedAssets({ planetId: "fixture", objectDirectory, filenames: ["runtime.json"],
    gitTrackedPaths: async () => new Set([resolve(preparedRoot, "some-other-tracked-file.json")]) });
  assert.deepEqual(inventory?.assets.map(asset => asset.filename), ["runtime.json"]);
  // The default lookup asks this checkout's git: a tracked README next to prepared/ must be refused.
  const mimas = resolve(import.meta.dirname, "../../src/objects/mimas");
  const scratch = await mkdtemp(resolve(tmpdir(), "inventory-tracked-real-"));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  await assert.rejects(inventoryPreparedAssets({ planetId: "mimas", objectDirectory: scratch, preparedRoot: mimas, filenames: ["README.md"] }), /git-tracked.*README\.md/);
  assert.equal(JSON.stringify(await readFile(resolve(mimas, "..", "mimas", "inventory.json"), "utf8")).length > 0, true);
});
