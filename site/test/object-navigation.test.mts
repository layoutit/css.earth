import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { OBJECTS, SCENE_OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "./authored-object-fixture.mts";
import { objectNavigation, SEARCH_OBJECTS, PLANET_NAVIGATION_OBJECTS } from "../search-objects.mts";
import { BODY_MARKER_ATLAS_PAGE_SIZE, loadMarkerDescriptors } from "../../tools/prepare/prepare-navigation.mts";
import { markerStyle, resolveMarkerStyle, validateMarkerPresentation } from "../../src/navigation/marker-presentation.mts";
import { PREPARED_NAVIGATION_MARKERS } from "../prepared-navigation-markers.mjs";

test("search contains every object, including the Sun; only planets enter the scale", () => {
  assert.deepEqual(new Set(SEARCH_OBJECTS), new Set(OBJECTS));
  assert.ok(SEARCH_OBJECTS.some(({ id }) => id === "sun"));
  assert.ok(PLANET_NAVIGATION_OBJECTS.every(({ classification }) => classification === "planet"));
  const unknown = [
    { id: "future-dwarf", classification: "dwarf-planet", distance: { meters: 40 } },
    { id: "future-planet", classification: "planet", distance: { meters: 4 } },
    { id: "future-star", classification: "star", distance: { meters: 0 } },
  ];
  assert.deepEqual(objectNavigation(unknown).search.map(({ id }) => id), ["future-star", "future-planet", "future-dwarf"]);
  assert.deepEqual(objectNavigation(unknown).planets.map(({ id }) => id), ["future-planet"]);
});

test("prepared marker atlases and presentation follow packages", async () => {
  const descriptors = await loadMarkerDescriptors();
  assert.deepEqual(Object.keys(PREPARED_NAVIGATION_MARKERS), descriptors.map(({ objectId }) => objectId));
  for (const [descriptorIndex, descriptor] of descriptors.entries()) {
    const marker = PREPARED_NAVIGATION_MARKERS[descriptor.objectId];
    const page = Math.floor(descriptorIndex / BODY_MARKER_ATLAS_PAGE_SIZE);
    const index = descriptorIndex % BODY_MARKER_ATLAS_PAGE_SIZE;
    const count = Math.min(BODY_MARKER_ATLAS_PAGE_SIZE, descriptors.length - page * BODY_MARKER_ATLAS_PAGE_SIZE);
    // Pages are 2x only: no 1x raster is made or read.
    const url2x = `/navigation/body-markers-${String(page).padStart(2, '0')}@2x.webp`;
    const { context: _context, ...atlasMarker } = marker;
    assert.deepEqual(atlasMarker, { url2x, url2xPixels: marker.url2xPixels, index, count, presentation: descriptor.presentation });
    const result = markerStyle(marker, { color: "#ffffff" });
    assert.ok(result.style.includes("color:#ffffff"));
    assert.ok(result.innerStyle.includes(`background-size:${count * 100}% 100%`));
    assert.ok(result.innerStyle.includes(`url("${marker.url2x}")`));
    assert.deepEqual(resolveMarkerStyle(marker, { color: "#ffffff" }), {
      color: "#ffffff",
      size: descriptor.presentation.size,
      image: marker.url2x,
      position: `${(index / Math.max(1, count - 1) * 100).toFixed(4)}%`,
      backgroundSize: `${count * 100}% 100%`,
      ring: descriptor.presentation.ringAngle === undefined ? null : {
        width: descriptor.presentation.size + descriptor.presentation.ringExtra!,
        height: descriptor.presentation.ringHeight!,
        colorShare: descriptor.presentation.ringColorShare ?? 100,
        opacity: descriptor.presentation.ringOpacity ?? 0.65,
        angle: descriptor.presentation.ringAngle,
        outlineOpacity: descriptor.presentation.ringOutlineOpacity ?? 0,
        outlineOffset: descriptor.presentation.ringOutlineOffset ?? 0,
      },
    });
  }
  assert.equal(PREPARED_NAVIGATION_MARKERS.saturn.presentation.scale?.ringExtra, 20);
  assert.equal(PREPARED_NAVIGATION_MARKERS.saturn.presentation.ringExtra, 14);
});

test("an unknown object loads its own marker; missing packages fail without fallback", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-owned-marker-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const dir = resolve(root, "src/objects/new-body/source/preparation");
  await mkdir(dir, { recursive: true });
  const source = (await loadMarkerDescriptors())[0];
  const fixture = { ...source, objectId: "new-body", presentation: { size: 8 } };
  // The recipe names its source by path; the source manifest owns the record the loader merges in.
  const { path, ...record } = source.source;
  await writeFile(resolve(dir, "navigation.json"), JSON.stringify({ ...fixture, source: { path } }));
  await writeFile(resolve(root, "src/objects/new-body/source/manifest.json"), JSON.stringify({ inputs: [], generatedIntermediates: [], documents: [{ ...record, path }] }));
  await writeFile(resolve(root, "src/objects/new-body/object.json"), JSON.stringify(authoredObjectFixture("new-body")));
  assert.deepEqual(await loadMarkerDescriptors({ projectRoot: root, planets: [{ id: "new-body", classification: "planet" }] }), [fixture]);
  await rm(resolve(dir, "navigation.json"));
  await assert.rejects(loadMarkerDescriptors({ projectRoot: root, planets: [{ id: "new-body", classification: "planet" }] }), /ENOENT/);
  assert.throws(() => Reflect.apply(markerStyle, undefined, [undefined]), /missing/);
  for (const bad of [null, {}, { size: 0 }, { size: 8, ringAngle: 3 }, { size: 8, ringOpacity: 2 }, { size: 8, css: "url(example)" }]) assert.throws(() => validateMarkerPresentation(bad));
});

test("scale overrides must form a complete presentation after inheritance", () => {
  for (const scale of [{ ringAngle: 0 }, { ringExtra: 12 }, { ringOpacity: 0.5 }, { scale: { size: 4 } }]) {
    assert.throws(() => validateMarkerPresentation({ size: 8, scale }));
  }
  const presentation = { size: 8, ringAngle: 0, ringExtra: 12, ringHeight: 4, scale: { ringExtra: 20 } };
  assert.equal(validateMarkerPresentation(presentation), presentation);
  const result = markerStyle({ url2x: '/navigation/body-test@2x.webp', index: 0, count: 1, presentation }, { color: "#ffffff", view: "scale" });
  assert.equal(result.ringed, true);
  assert.match(result.ringStyle, /width:28px/);
  assert.match(result.ringStyle, /height:4px/);
  assert.doesNotMatch(`${result.style};${result.innerStyle};${result.ringStyle}`, /NaN|undefined/);
  assert.doesNotThrow(() => validateMarkerPresentation({ size: 8, scale: { ringAngle: 0, ringExtra: 12, ringHeight: 4 } }));
});
