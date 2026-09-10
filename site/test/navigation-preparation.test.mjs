import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";

import { OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "./authored-object-fixture.mjs";
import { optimizePreparedQ75Webp } from "../../tools/prepared-webp.mts";
import {
  loadMarkerDescriptors,
  moveNavigationFile,
  prepareNavigation,
} from "../../tools/prepare-navigation.mts";

const projectRoot = resolve(import.meta.dirname, "../..");
const expectedOutputFiles = (await readdir(resolve(projectRoot, "public/navigation"))).sort();

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

test("reproduces the checked-in registry-derived atlases and utility markers", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-navigation-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const presentationPath = resolve(root, "prepared-navigation-markers.mjs");
  await prepareNavigation({ projectRoot, outputRoot: root, presentationPath });
  assert.equal(await readFile(presentationPath, "utf8"), await readFile(resolve(projectRoot, "site/prepared-navigation-markers.mjs"), "utf8"));
  assert.deepEqual((await readdir(root)).filter((file) => file !== "prepared-navigation-markers.mjs").sort(), expectedOutputFiles);
  for (const filename of expectedOutputFiles) {
    const path = resolve(root, filename);
    let bytes = await readFile(path);
    const accepted = await readFile(resolve(projectRoot, "public/navigation", filename));
    // Some resolved context images were published through the existing terminal
    // Q75 compactor. Reproduce that step from fresh source output when needed;
    // require exact accepted bytes, with no decoded-pixel tolerance or pin edits.
    if (filename.endsWith("-context.webp") && !bytes.equals(accepted)) {
      await optimizePreparedQ75Webp(path);
      bytes = await readFile(path);
      context.diagnostic(`${filename}: checked terminal Q75 publication bytes`);
    }
    assert.deepEqual(bytes, accepted, filename);
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

for (const failure of ["object source", "late utility source", "publication", "rollback"]) {
  test(`failed ${failure} preserves accepted files or recoverable backups outside public`, async (context) => {
    const root = await mkdtemp(resolve(tmpdir(), "cssearth-navigation-failure-"));
    context.after(() => rm(root, { recursive: true, force: true }));
    for (const path of ["src/planets/new-body/source/preparation", "src/planets/sun", "src/navigation/source", "site", "public/navigation"]) {
      await mkdir(resolve(root, path), { recursive: true });
    }
    await copyFile(resolve(projectRoot, "src/planets/sun/swatch.json"), resolve(root, "src/planets/sun/swatch.json"));
    const original = (await loadMarkerDescriptors())[0];
    const descriptor = { ...original, planetId: "new-body", source: { ...original.source, path: "source.jpg" } };
    await writeFile(resolve(root, "src/planets/new-body/source/preparation/navigation.json"), JSON.stringify(descriptor));
    await writeFile(resolve(root, "src/planets/new-body/object.json"), JSON.stringify(authoredObjectFixture("new-body")));
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
      ...expectedOutputFiles.filter((filename) => filename !== "download-marker@2x.webp").map((filename) => [resolve(outputRoot, filename), `accepted ${filename}`]),
      [resolve(outputRoot, "new-body.webp"), "accepted legacy marker"],
      [resolve(outputRoot, "unrelated.txt"), "unrelated output"],
      [resolve(root, "site/prepared-navigation-markers.mjs"), "accepted presentation"],
    ]);
    for (const [path, bytes] of previous) await writeFile(path, bytes);
    const filenames = (await readdir(outputRoot)).sort();
    const options = { projectRoot: root, planets: [{ id: "new-body" }] };
    // A missing presentation parent fails after all staged atlases are installed.
    if (["publication", "rollback"].includes(failure)) options.presentationPath = resolve(root, "missing/presentation.mjs");
    if (failure === "rollback") {
      options.moveFile = async (source, target) => {
        if (source.endsWith("/backup-0")) throw new Error("injected rollback failure");
        await moveNavigationFile(source, target);
      };
      await assert.rejects(prepareNavigation(options), (error) => error instanceof AggregateError && /rollback failed/.test(error.message) && error.errors.some((entry) => /injected rollback/.test(entry.message)));
      const cache = resolve(root, "node_modules/.cache");
      const [recovery] = await readdir(cache);
      assert.match(recovery, /^navigation-prepare-/u);
      assert.equal(await readFile(resolve(cache, recovery, "backup-0"), "utf8"), "accepted blackhole-marker.png");
      // Vite copies all of public, including dot directories. Neither staged
      // assets nor the preserved recovery directory can enter that tree.
      assert.deepEqual(await readdir(resolve(root, "public")), ["navigation"]);
      for (const [path, bytes] of previous) {
        if (path === resolve(outputRoot, "blackhole-marker.png")) continue;
        assert.equal(await readFile(path, "utf8"), bytes, path);
      }
      return;
    }
    await assert.rejects(prepareNavigation(options), failure === "publication" ? /ENOENT/ : /source size drifted/);
    for (const [path, bytes] of previous) assert.equal(await readFile(path, "utf8"), bytes, path);
    assert.deepEqual((await readdir(outputRoot)).sort(), filenames);
    assert.deepEqual(await readdir(resolve(root, "public")), ["navigation"]);
    assert.deepEqual(await readdir(resolve(root, "node_modules/.cache")), []);
  });
}

test("cross-device moves copy and unlink safely for publication and rollback", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-navigation-exdev-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(root, "source"), target = resolve(root, "target");
  const io = { copyFile, unlink, rename: async () => { throw Object.assign(new Error("cross device"), { code: "EXDEV" }); } };
  await writeFile(source, "accepted");
  await moveNavigationFile(source, target, io);
  assert.equal(await readFile(target, "utf8"), "accepted");
  await assert.rejects(readFile(source), { code: "ENOENT" });
  await moveNavigationFile(target, source, io);
  assert.equal(await readFile(source, "utf8"), "accepted");
  await assert.rejects(readFile(target), { code: "ENOENT" });
  await assert.rejects(moveNavigationFile(source, target, { ...io, unlink: async (path) => {
    if (path === source) throw new Error("unlink blocked");
    await unlink(path);
  } }), /unlink blocked/u);
  assert.equal(await readFile(source, "utf8"), "accepted");
  await assert.rejects(readFile(target), { code: "ENOENT" });
});
