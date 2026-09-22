import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";

import { SCENE_OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "./authored-object-fixture.mts";
import { optimizePreparedQ75Webp } from "../../tools/prepared/prepared-webp.mts";
import {
  BODY_MARKER_ATLAS_PAGE_SIZE,
  loadMarkerDescriptors,
  moveNavigationFile,
  prepareBodyMarkers,
  prepareNavigation,
} from "../../tools/prepare/prepare-navigation.mts";

const projectRoot = resolve(import.meta.dirname, "../..");
// Sidebar thumbnails share the directory but belong to prepare-sidebar-thumbnails, whose manifest lists them.
const sidebarThumbnails = JSON.parse(await readFile(resolve(projectRoot, "public/navigation/sidebar-thumbnails.json"), "utf8")) as { images: Record<string, { url: string; url2x: string }> };
const sidebarFiles = new Set(["sidebar-thumbnails.json", ...Object.values(sidebarThumbnails.images).flatMap(({ url, url2x }) => [url, url2x].map((path) => path.replace("/navigation/", "")))]);
const expectedOutputFiles = (await readdir(resolve(projectRoot, "public/navigation"))).filter((file) => !sidebarFiles.has(file)).sort();

const transparentMarkerFiles = Object.freeze([
  "blackhole-marker.png",
  "blackhole-marker@2x.png",
  "supernova-marker.png",
  "supernova-marker@2x.png",
]);

test('adding and reordering bodies preserves existing marker bytes', async context => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-marker-order-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const descriptors = (await loadMarkerDescriptors()).filter(({ planetId }) => ['sun', 'moon', 'comet-67p', 'vesta'].includes(planetId));
  assert.equal(descriptors.length, 4);
  const before = resolve(root, 'before'), after = resolve(root, 'after');
  await prepareBodyMarkers({ projectRoot, outputRoot: before, descriptors: descriptors.slice(0, 3) });
  await prepareBodyMarkers({ projectRoot, outputRoot: after, descriptors: [...descriptors].reverse() });
  for (const file of await readdir(before)) {
    assert.deepEqual(await readFile(resolve(after, file)), await readFile(resolve(before, file)), file);
    const accepted = await sharp(resolve(projectRoot, 'public/navigation', file)).ensureAlpha().raw().toBuffer();
    const reproduced = await sharp(resolve(after, file)).ensureAlpha().raw().toBuffer();
    assert.equal(reproduced.length, accepted.length);
    for (let i = 0; i < accepted.length; i += 4) {
      assert.equal(reproduced[i + 3], accepted[i + 3], `${file}: alpha`);
      if (accepted[i + 3]) assert.deepEqual(reproduced.subarray(i, i + 3), accepted.subarray(i, i + 3), `${file}: visible RGB`);
    }
  }
});

test('metadata-only preparation does not replace or remove images', async context => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-marker-metadata-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const files = ['body-sun.webp', 'body-sun@2x.webp'];
  for (const file of files) await copyFile(resolve(projectRoot, 'public/navigation', file), resolve(root, file));
  await copyFile(resolve(projectRoot, 'public/navigation/body-sun.webp'), resolve(root, 'body-markers-00.webp'));
  await copyFile(resolve(projectRoot, 'public/navigation/body-sun@2x.webp'), resolve(root, 'body-markers-00@2x.webp'));
  await writeFile(resolve(root, 'sun-context.webp'), 'unrelated existing context');
  const before = new Map(await Promise.all((await readdir(root)).map(async file => [file, await readFile(resolve(root, file))] as const)));
  const presentationPath = resolve(root, 'presentation.mjs');
  await prepareNavigation({ projectRoot, outputRoot: root, planets: SCENE_OBJECTS.filter(body => body.id === 'sun'), presentationPath, catalogOnly: true });
  for (const [file, bytes] of before) assert.deepEqual(await readFile(resolve(root, file)), bytes, file);
  assert.equal((await readdir(root)).length, before.size + 1);
  assert.match(await readFile(presentationPath, 'utf8'), /body-markers-00@2x.webp/);
});

test("composes every orbiting-object marker descriptor in catalog order", async () => {
  const descriptors = await loadMarkerDescriptors({ projectRoot });
  const markerPlanets = SCENE_OBJECTS
    .toSorted((left, right) => left.distance.meters - right.distance.meters);
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

test('body marker atlases preserve every visible prepared tile pixel exactly', async () => {
  const descriptors = await loadMarkerDescriptors({ projectRoot });
  for (const [descriptorIndex, { planetId }] of descriptors.entries()) {
    const page = Math.floor(descriptorIndex / BODY_MARKER_ATLAS_PAGE_SIZE);
    const index = descriptorIndex % BODY_MARKER_ATLAS_PAGE_SIZE;
    for (const density of [1, 2]) {
      const tile = 16 * density;
      const suffix = density === 2 ? '@2x' : '';
      const accepted = await sharp(resolve(projectRoot, 'public/navigation', `body-${planetId}${suffix}.webp`)).ensureAlpha().raw().toBuffer();
      const atlas = await sharp(resolve(projectRoot, 'public/navigation', `body-markers-${String(page).padStart(2, '0')}${suffix}.webp`))
        .extract({ left: index * tile, top: 0, width: tile, height: tile }).ensureAlpha().raw().toBuffer();
      assert.equal(atlas.length, accepted.length, `${planetId}${suffix}: byte length`);
      for (let offset = 0; offset < accepted.length; offset += 4) {
        assert.equal(atlas[offset + 3], accepted[offset + 3], `${planetId}${suffix}: alpha`);
        // Lossless WebP is allowed to discard RGB under fully transparent
        // pixels; require exact bytes for every pixel the browser can paint.
        if (accepted[offset + 3]) {
          assert.deepEqual(atlas.subarray(offset, offset + 3), accepted.subarray(offset, offset + 3), `${planetId}${suffix}: visible RGB`);
        }
      }
    }
  }
});

test("reproduces the checked-in body images and utility markers", async (context) => {
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
    const sha=(buffer: Uint8Array)=>createHash('sha256').update(buffer).digest('hex');
    assert.ok(bytes.equals(accepted), `${filename}: generated ${bytes.length} bytes ${sha(bytes)}; accepted ${accepted.length} bytes ${sha(accepted)}`);
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
    for (const path of ["src/objects/new-body/source/preparation", "src/objects/sun", "src/navigation/source", "site", "public/navigation"]) {
      await mkdir(resolve(root, path), { recursive: true });
    }
    await copyFile(resolve(projectRoot, "src/objects/sun/swatch.json"), resolve(root, "src/objects/sun/swatch.json"));
    const original = (await loadMarkerDescriptors())[0];
    // The marker names its source by path; the source manifest owns the record.
    await writeFile(resolve(root, "src/objects/new-body/source/preparation/navigation.json"), JSON.stringify({ ...original, planetId: "new-body", source: { path: "source.jpg" } }));
    const { path: _path, ...record } = original.source;
    await writeFile(resolve(root, "src/objects/new-body/source/manifest.json"), JSON.stringify({ schema: "cssnew-body-authoritative-sources@2", inputs: [], generatedIntermediates: [], documents: [{ ...record, path: "source.jpg" }] }));
    await writeFile(resolve(root, "src/objects/new-body/object.json"), JSON.stringify(authoredObjectFixture("new-body")));
    const sourcePath = resolve(root, "src/objects/new-body/source/source.jpg");
    await copyFile(resolve(projectRoot, "src/objects", original.planetId, "source", original.source.path), sourcePath);
    if (failure === "object source") await writeFile(sourcePath, "corrupt object source");
    for (const filename of await readdir(resolve(projectRoot, "src/navigation/source"))) {
      if (failure === "late utility source" && filename === "share-mark.svg") {
        await writeFile(resolve(root, "src/navigation/source", filename), "corrupt final utility source");
      } else {
        await symlink(resolve(projectRoot, "src/navigation/source", filename), resolve(root, "src/navigation/source", filename));
      }
    }
    const outputRoot = resolve(root, "public/navigation");
    const previous = new Map<string, string>([
      ...expectedOutputFiles.filter((filename) => filename !== "body-download@2x.webp").map((filename) => [resolve(outputRoot, filename), `accepted ${filename}`] as const),
      [resolve(outputRoot, "new-body.webp"), "accepted legacy marker"],
      [resolve(outputRoot, "unrelated.txt"), "unrelated output"],
      [resolve(root, "site/prepared-navigation-markers.mjs"), "accepted presentation"],
    ]);
    for (const [path, bytes] of previous) await writeFile(path, bytes);
    const filenames = (await readdir(outputRoot)).sort();
    const options: NonNullable<Parameters<typeof prepareNavigation>[0]> = { projectRoot: root, planets: [{ id: "new-body", classification: "planet" }] };
    // A missing presentation parent fails after all staged images are installed.
    if (["publication", "rollback"].includes(failure)) options.presentationPath = resolve(root, "missing/presentation.mjs");
    if (failure === "rollback") {
      options.moveFile = async (source, target) => {
        if (source.endsWith("/backup-0")) throw new Error("injected rollback failure");
        await moveNavigationFile(source, target);
      };
      await assert.rejects(prepareNavigation(options), (error) => error instanceof AggregateError && /rollback failed/.test(error.message) && error.errors.some((entry: unknown) => entry instanceof Error && /injected rollback/.test(entry.message)));
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
