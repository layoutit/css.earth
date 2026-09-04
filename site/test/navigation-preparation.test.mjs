import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";

import { OBJECTS } from "../objects.mjs";
import {
  loadMarkerDescriptors,
  prepareNavigation,
} from "../../tools/prepare-navigation.mjs";

const projectRoot = resolve(import.meta.dirname, "../..");
const expectedOutputHashes = Object.freeze({
  "blackhole-marker.png": "488f3617279968cfd9e7b7513d2f0978cb2a68d412d1e8abc1a13f7b3e10aba9",
  "blackhole-marker@2x.png": "12ec338c57230ce476ed610179286fd08c555bfa4c353a064feb332bdbdc283b",
  "download-marker.webp": "f518e9e44e371169ecb22b6b1789ef7c3becf8e5a4dfe1bf6a912f6b4659e4f8",
  "download-marker@2x.webp": "670fb0ea4c67d011427dec16858efd98dc9a2dce914865bfb15e976a81e75173",
  "github-marker.webp": "383e97a9726672e1b9e8109c5db583bbc188a6cbbe9073101e33f118f7350a13",
  "github-marker@2x.webp": "a710f0afb1815524a5695ba78e999222430d59f7da515dca4550bd06e7fb4a9d",
  "planet-markers.webp": "319722f1ece2f5b206043ed450b6577299d10ceb1b943d45c9e25d819714d54a",
  "planet-markers@2x.webp": "e113080e6cec3ac58321e1b9525d1e45886981d15654a0ddcd3333fdce11f2bf",
  "share-marker.webp": "b74f154b94b4dd17ac8818e47e1fb5ea07799431d3254521d5517300aa90f8e8",
  "share-marker@2x.webp": "4611f24161d95d8a4f1d7668e901755f5cdb6ff890d92bf9927ad65a331c2c01",
  "settings-marker.webp": "e4f9d6dce0ea4121fa193dd316bb6c077c3901c9fa9f79a0f7adae8d9a0fa34f",
  "settings-marker@2x.webp": "d5045534307c19387d6791cb25d514e13406cc8af43e21f0102aa6c9a0a075d3",
  "sun-marker.webp": "4715219676a73cbbdccfe4c249d098a1903f6682bc3078c976c2fe20e27c24b7",
  "sun-marker@2x.webp": "5b848106311b4e73203ac9ccba317f35d068a7a0f47c7e3dbee656e0a4eeb52e",
  "supernova-marker.png": "6eee6129ab5d5b0fb037cba6b463cd82e3f673e70b6e070eeeab314b812a7707",
  "supernova-marker@2x.png": "89e782175bb64c9241a467d147afa08120cfebfa11acebb3dc7b07f9c5108d1f",
});

const transparentMarkerFiles = Object.freeze([
  "blackhole-marker.png",
  "blackhole-marker@2x.png",
  "supernova-marker.png",
  "supernova-marker@2x.png",
]);

test("composes every orbiting-object marker descriptor in catalog order", async () => {
  const descriptors = await loadMarkerDescriptors({ projectRoot });
  const markerPlanets = OBJECTS
    .toSorted((left, right) => left.distanceAu - right.distanceAu);
  assert.deepEqual(
    descriptors.map(({ planetId }) => planetId),
    markerPlanets.map(({ id }) => id),
  );
  assert.deepEqual(
    descriptors.filter(({ owner }) => owner === "object").map(({ planetId }) =>
      planetId),
    markerPlanets.map(({ id }) => id),
  );
  assert.ok(descriptors.every(({ source }) =>
    source.origin && source.credit && source.license && source.expectedSha256));
});

test("regenerates the accepted marker atlases byte-identically", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-navigation-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const presentationPath = resolve(root, "prepared-navigation-markers.mjs");
  await prepareNavigation({ projectRoot, outputRoot: root, presentationPath });
  assert.equal(await readFile(presentationPath, "utf8"), await readFile(resolve(projectRoot, "site/prepared-navigation-markers.mjs"), "utf8"));
  assert.deepEqual((await readdir(root)).filter((file) => file !== "prepared-navigation-markers.mjs").sort(), Object.keys(expectedOutputHashes).sort());
  for (const [filename, expected] of Object.entries(expectedOutputHashes)) {
    const bytes = await readFile(resolve(root, filename));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), filename.startsWith("planet-markers") ? createHash("sha256").update(await readFile(resolve(projectRoot, "public/navigation", filename))).digest("hex") : expected);
  }
  for (const filename of transparentMarkerFiles) {
    const { data, info } = await sharp(resolve(root, filename))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = data.filter((_, index) => index % info.channels === 3);
    assert.equal(info.channels, 4);
    assert.equal(Math.min(...alpha), 0);
    assert.equal(Math.max(...alpha), 255);
  }
});

for (const failure of ["object source", "late utility source", "publication"]) {
  test(`failed ${failure} preserves accepted navigation files`, async (context) => {
    const root = await mkdtemp(resolve(tmpdir(), "cssearth-navigation-failure-"));
    context.after(() => rm(root, { recursive: true, force: true }));
    for (const path of ["src/planets/new-body/tools", "src/planets/new-body/source", "src/navigation/source", "site", "public/navigation"]) {
      await mkdir(resolve(root, path), { recursive: true });
    }
    const original = (await loadMarkerDescriptors())[0];
    const descriptor = { ...original, planetId: "new-body", source: { ...original.source, path: "source.jpg" } };
    await writeFile(resolve(root, "src/planets/new-body/tools/navigation-marker.mjs"), `export default ${JSON.stringify(descriptor)};\n`);
    const sourcePath = resolve(root, "src/planets/new-body/source/source.jpg");
    await copyFile(resolve(projectRoot, "src/planets", original.planetId, "source", original.source.path), sourcePath);
    if (failure === "object source") await writeFile(sourcePath, "corrupt object source");
    for (const filename of await readdir(resolve(projectRoot, "src/navigation/source"))) {
      if (failure === "late utility source" && filename === "share-mark.svg") {
        await writeFile(resolve(root, "src/navigation/source", filename), "corrupt final utility source");
      } else {
        await symlink(resolve(projectRoot, "src/navigation/source", filename), resolve(root, "src/navigation/source", filename));
      }
    }
    const outputRoot = resolve(root, "public/navigation");
    const previous = new Map([
      ...Object.keys(expectedOutputHashes).filter((filename) => filename !== "download-marker@2x.webp").map((filename) => [resolve(outputRoot, filename), `accepted ${filename}`]),
      [resolve(outputRoot, "new-body.webp"), "accepted legacy marker"],
      [resolve(outputRoot, "unrelated.txt"), "unrelated output"],
      [resolve(root, "site/prepared-navigation-markers.mjs"), "accepted presentation"],
    ]);
    for (const [path, bytes] of previous) await writeFile(path, bytes);
    const filenames = (await readdir(outputRoot)).sort();
    const options = { projectRoot: root, planets: [{ id: "new-body" }] };
    // A missing presentation parent fails after all staged atlases are installed.
    if (failure === "publication") options.presentationPath = resolve(root, "missing/presentation.mjs");
    await assert.rejects(prepareNavigation(options), failure === "publication" ? /ENOENT/ : /source size drifted/);
    for (const [path, bytes] of previous) assert.equal(await readFile(path, "utf8"), bytes, path);
    assert.deepEqual((await readdir(outputRoot)).sort(), filenames);
    assert.deepEqual(await readdir(resolve(root, "public")), ["navigation"]);
  });
}
