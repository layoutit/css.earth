import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import sharp from "sharp";

import { SCENE_OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "../build/fixtures/authored-object-fixture.mts";
import {
  loadMarkerDescriptors,
  moveNavigationFile,
  prepareBodyMarkers,
  prepareNavigation,
} from "@cssearth/bake/navigation";

const projectRoot = resolve(import.meta.dirname, "../..");
// Sidebar thumbnails share the directory but belong to prepare-sidebar-thumbnails, whose manifest lists them.
const sidebarThumbnails = JSON.parse(await readFile(resolve(projectRoot, "public/navigation/sidebar-thumbnails.json"), "utf8")) as { images: Record<string, { url2x: string }> };
const sidebarFiles = new Set(["sidebar-thumbnails.json", ...Object.values(sidebarThumbnails.images).map(({ url2x }) => url2x.replace("/navigation/", ""))]);
// Subfolders such as search/ belong to their own preparers; this one writes files at the top level only.
const expectedOutputFiles = (await readdir(resolve(projectRoot, "public/navigation"), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && !sidebarFiles.has(entry.name)).map((entry) => entry.name).sort();

// Marker code is the same for every body: these tests load named bodies, nearest first, not all ~3,600.
const markersOf = (ids: readonly string[]) => loadMarkerDescriptors({ projectRoot,
  planets: SCENE_OBJECTS.filter(({ id }) => ids.includes(id)).toSorted((left, right) => left.distance.meters - right.distance.meters) });

test('adding and reordering bodies preserves existing marker bytes', async context => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-marker-order-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const descriptors = await markersOf(['sun', 'moon', 'comet-67p', 'vesta']);
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
  const files = ['body-sun@2x.webp'];
  for (const file of files) await copyFile(resolve(projectRoot, 'public/navigation', file), resolve(root, file));
  await copyFile(resolve(projectRoot, 'public/navigation/body-sun@2x.webp'), resolve(root, 'body-markers-00@2x.webp'));
  // The Sun has a context image, which the metadata step reads; it must stay as it was.
  await copyFile(resolve(projectRoot, 'public/navigation/sun-context.webp'), resolve(root, 'sun-context.webp'));
  const before = new Map(await Promise.all((await readdir(root)).map(async file => [file, await readFile(resolve(root, file))] as const)));
  const presentationPath = resolve(root, 'presentation.mjs');
  await prepareNavigation({ projectRoot, outputRoot: root, planets: SCENE_OBJECTS.filter(body => body.id === 'sun'), presentationPath, catalogOnly: true });
  for (const [file, bytes] of before) assert.deepEqual(await readFile(resolve(root, file)), bytes, file);
  assert.equal((await readdir(root)).length, before.size + 1);
  assert.match(await readFile(presentationPath, 'utf8'), /body-markers-00@2x.webp/);
});


test('body markers and resolved context images leave space outside their silhouette transparent', async () => {
  const descriptors = await markersOf(['earth', 'moon', 'saturn', 'comet-67p']);
  const { PREPARED_NAVIGATION_MARKERS } = await import('../prepared-navigation-markers.mjs');
  for (const { objectId } of descriptors) {
    const context = PREPARED_NAVIGATION_MARKERS[objectId]?.context;
    const images = [`body-${objectId}@2x.webp`,
      ...(context ? [context.url.replace('/navigation/', '')] : [])];
    for (const filename of images) {
      const { data, info } = await sharp(resolve(projectRoot, 'public/navigation', filename)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
      for (const pixel of corners) assert.equal(data[pixel * 4 + 3], 0, `${filename}: opaque tile corner`);
      assert(data.some((value, index) => index % 4 === 3 && value > 0), `${filename}: empty marker`);
    }
  }
});

test('every context image has its committed search preview, and no preview outlives its image', async () => {
  const { PREPARED_NAVIGATION_MARKERS } = await import('../prepared-navigation-markers.mjs');
  const expected = Object.entries(PREPARED_NAVIGATION_MARKERS).filter(([, marker]) => marker.context).map(([id]) => `${id}@2x.webp`).sort();
  assert.deepEqual((await readdir(resolve(projectRoot, 'public/navigation/search'))).sort(), expected,
    'run node packages/bake/cli/prepare-navigation.mts <id> after drawing a context image');
});

for (const failure of ["object source", "late utility source", "publication", "rollback"]) {
  test(`failed ${failure} preserves accepted files or recoverable backups outside public`, async (context) => {
    const root = await mkdtemp(resolve(tmpdir(), "cssearth-navigation-failure-"));
    context.after(() => rm(root, { recursive: true, force: true }));
    for (const path of ["src/objects/new-body/source/preparation", "src/objects/sun", "src/navigation/source", "site", "public/navigation"]) {
      await mkdir(resolve(root, path), { recursive: true });
    }
    await copyFile(resolve(projectRoot, "src/objects/sun/swatch.json"), resolve(root, "src/objects/sun/swatch.json"));
    const [original] = await markersOf(['sun']);
    // The marker names its source by path; the source manifest owns the record.
    await writeFile(resolve(root, "src/objects/new-body/source/preparation/navigation.json"), JSON.stringify({ ...original, objectId: "new-body", source: { path: "source.jpg" } }));
    const { path: _path, ...record } = original.source;
    await writeFile(resolve(root, "src/objects/new-body/source/manifest.json"), JSON.stringify({ schema: "cssearth-authoritative-sources@3", inputs: [], generatedIntermediates: [], documents: [{ ...record, path: "source.jpg" }] }));
    await writeFile(resolve(root, "src/objects/new-body/object.json"), JSON.stringify(authoredObjectFixture("new-body")));
    const sourcePath = resolve(root, "src/objects/new-body/source/source.jpg");
    await copyFile(resolve(projectRoot, "src/objects", original.objectId, "source", original.source.path), sourcePath);
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
    await assert.rejects(prepareNavigation(options), failure === "publication" ? /ENOENT/ : /./);
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
