import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { PREPARED_NAVIGATION_MARKERS } from "../../site/prepared-navigation-markers.mjs";
import { contextMarkerSprite } from "./marker-presentation.mts";

import { loadMarkerDescriptors, loadObjectMarkerDescriptor } from "../../tools/prepare-navigation.mts";
import {
  validateMarkerDescriptor,
  validateMarkerSourceBytes,
  renderMarker,
} from "./marker-recipe.mts";

const marsMarker = validateMarkerDescriptor(await loadObjectMarkerDescriptor("mars", resolve(import.meta.dirname, "../..")));

test("accepts every object-owned marker recipe", async () => {
  for (const descriptor of await loadMarkerDescriptors()) {
    assert.equal(validateMarkerDescriptor(descriptor), descriptor);
    // Pins became optional for files this repository authors; a marker source is a download, so
    // it must still carry one.
    assert.ok(descriptor.source.expectedSha256, `${descriptor.source.origin}: a downloaded marker source must stay pinned`);
    assert.match(descriptor.source.expectedSha256, /^[0-9a-f]{64}$/u);
    assert.ok(["http:", "https:"].includes(new URL(descriptor.source.origin).protocol));
    assert.ok(descriptor.source.credit.length > 0);
  }
});

test("context markers keep a complete disc without inventing missing terrain", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-marker-coverage-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const rgb = Buffer.alloc(32 * 32 * 3, 160);
  rgb.fill(0, 24 * 32 * 3); // Missing southern rows.
  rgb.fill(0, (8 * 32 + 16) * 3, (8 * 32 + 16) * 3 + 3); // Observed dark terrain.
  const input = await sharp(rgb, { raw: { width: 32, height: 32, channels: 3 } }).png().toBuffer();
  const sourcePath = resolve(root, "source.png");
  await writeFile(sourcePath, input);
  const png = await renderMarker({ ...marsMarker, source: { ...marsMarker.source, path: "source.png",
    expectedBytes: input.length, expectedSha256: createHash("sha256").update(input).digest("hex") },
    operations: [
      { type: "missing-coverage", kind: "black-fill", southConnected: true },
      { type: "ensure-alpha" },
      { type: "ellipse-mask", cx: .5, cy: .5, rx: .5, ry: .5 },
      { type: "png" },
    ] }, { sourcePath, tileSize: 32 });
  const output = await sharp(png).raw().toBuffer();
  const pixel = (x: number, y: number) => [...output.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
  assert.deepEqual(pixel(16, 8), [0, 0, 0, 255], "observed black must remain black");
  assert.deepEqual(pixel(16, 16), [160, 160, 160, 255], "observed brightness is unchanged");
  assert.ok(pixel(16, 28)[0] >= 82 && pixel(16, 28)[3] === 255, "gap styling fills the disc");
  assert.equal(pixel(0, 0)[3], 0, "space outside the disc remains transparent");
});

test("rejects unsafe recipes and drifted source bytes", async (context) => {
  for (const origin of ["Hubble OPAL colour map", "https://", "file:///local", "javascript:alert(1)"]) {
    assert.throws(() => validateMarkerDescriptor({ ...marsMarker, source: { ...marsMarker.source, origin } }), /source/u);
  }
  assert.throws(() => validateMarkerDescriptor({
    ...marsMarker,
    source: { ...marsMarker.source, path: "../outside.jpg" },
  }), /source/u);
  assert.throws(() => validateMarkerDescriptor({
    ...marsMarker,
    operations: [{ type: "planet-specific-filter" }, { type: "png" }],
  }), /operation/u);
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-marker-source-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourcePath = resolve(root, "marker.jpg");
  await writeFile(sourcePath, "drifted");
  await assert.rejects(
    validateMarkerSourceBytes(marsMarker.source, sourcePath),
    /size drifted/u,
  );
});


test("resolved parent sprites retain native source density and the existing physical size basis", async () => {
  for (const id of ["saturn", "jupiter", "charon"]) {
    const marker = PREPARED_NAVIGATION_MARKERS[id], sprite = contextMarkerSprite(marker), pixels = marker.context?.pixels;
    assert.equal(sprite.size, marker.presentation.size);
    // The 32 px tile draws first; the resolved context image is the detail once the marker outgrows it (#136).
    assert.equal(sprite.url, marker.url2x);
    assert.ok('detail' in sprite, `${id}: resolved context detail`);
    assert.equal(sprite.detail.index,0); assert.equal(sprite.detail.count,1);
    assert.equal(sprite.detail.url, `/navigation/${id}-context.webp`);
    assert.equal(sprite.detail.fromDiameterPixels, (marker.url2xPixels ?? 0) / 2);
    const metadata = await sharp(resolve(import.meta.dirname,"../../public",sprite.detail.url.slice(1))).metadata();
    assert.equal(metadata.width,pixels); assert.equal(metadata.height,pixels);
    assert.ok(metadata.width >= 512, "Resolved imagery must not come from the 32px UI atlas");
  }
  const moon = PREPARED_NAVIGATION_MARKERS.enceladus;
  assert.deepEqual(contextMarkerSprite(moon), {url:moon.url2x,index:moon.index,count:moon.count,size:moon.presentation.size});
});

test("prepared flood shading has a bright centre, a darker limb and no terminator", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-marker-lighting-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const input = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#c8c8c8' } }).greyscale().png().toBuffer();
  const sourcePath = resolve(root, 'source.png'); await writeFile(sourcePath, input);
  const png = await renderMarker({ ...marsMarker, source: { ...marsMarker.source, path: 'source.png',
    expectedBytes: input.length, expectedSha256: createHash('sha256').update(input).digest('hex') }, operations: [
      { type: 'ellipse-mask', cx: .5, cy: .5, rx: .5, ry: .5, shading: { ambient: .35, diffuse: .65 } }, { type: 'png' },
    ] }, { sourcePath, tileSize: 64 });
  const output = await sharp(png).raw().toBuffer(), red = (x: number, y: number) => output[(y*64+x)*4];
  assert.ok(red(32,32) >= 198, 'centre retains the original brightness');
  assert.ok(red(1,32) >= 70 && red(1,32) < 130, 'limb is rounded without going black');
  assert.equal(red(1,32), red(62,32), 'flood shading is symmetric');
  assert.equal(output[3], 0, 'outside the circle stays transparent');
});
