import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { PREPARED_NAVIGATION_MARKERS } from "../../site/prepared-navigation-markers.mjs";
import { contextMarkerSprite } from "./marker-presentation.mjs";

import marsMarker from "../planets/mars/source/preparation/navigation.json" with { type: "json" };
import { loadMarkerDescriptors } from "../../tools/prepare-navigation.mjs";
import {
  validateMarkerDescriptor,
  validateMarkerSourceBytes,
} from "./marker-recipe.mjs";

test("accepts every object-owned marker recipe", async () => {
  for (const descriptor of await loadMarkerDescriptors()) {
    assert.equal(validateMarkerDescriptor(descriptor), descriptor);
    assert.match(descriptor.source.expectedSha256, /^[0-9a-f]{64}$/u);
    assert.ok(["http:", "https:"].includes(new URL(descriptor.source.origin).protocol));
    assert.ok(descriptor.source.credit.length > 0);
  }
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
  for (const [id, pixels] of [["saturn",1440], ["jupiter",1019]]) {
    const marker = PREPARED_NAVIGATION_MARKERS[id], sprite = contextMarkerSprite(marker);
    assert.equal(sprite.size, marker.presentation.size);
    assert.equal(sprite.index,0); assert.equal(sprite.count,1);
    assert.equal(sprite.url, `/navigation/${id}-context.webp`);
    const metadata = await sharp(resolve(import.meta.dirname,"../../public",sprite.url.slice(1))).metadata();
    assert.equal(metadata.width,pixels); assert.equal(metadata.height,pixels);
    assert.ok(metadata.width > 32 * 30, "Resolved imagery must not come from the 32px UI atlas");
  }
  const moon = PREPARED_NAVIGATION_MARKERS.enceladus;
  assert.deepEqual(contextMarkerSprite(moon), {url:"/navigation/planet-markers@2x.webp",index:moon.index,count:moon.count,size:moon.presentation.size});
});
