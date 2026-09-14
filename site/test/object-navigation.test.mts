import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { OBJECTS, SCENE_OBJECTS } from "../objects.mts";
import { authoredObjectFixture } from "./authored-object-fixture.mts";
import { objectNavigation, PLANET_SEARCH_OBJECTS, PLANET_NAVIGATION_OBJECTS } from "../planet-search-objects.mts";
import { loadMarkerDescriptors } from "../../tools/prepare-navigation.mts";
import { markerStyle, validateMarkerPresentation } from "../../src/navigation/marker-presentation.mts";
import { PREPARED_NAVIGATION_MARKERS } from "../prepared-navigation-markers.mjs";

test("search contains every object, including the Sun; only planets enter the scale", () => {
  assert.deepEqual(new Set(PLANET_SEARCH_OBJECTS), new Set(OBJECTS));
  assert.ok(PLANET_SEARCH_OBJECTS.some(({ id }) => id === "sun"));
  assert.ok(PLANET_NAVIGATION_OBJECTS.every(({ classification }) => classification === "planet"));
  const unknown = [
    { id: "future-dwarf", classification: "dwarf-planet", distance: { meters: 40 } },
    { id: "future-planet", classification: "planet", distance: { meters: 4 } },
    { id: "future-star", classification: "star", distance: { meters: 0 } },
  ];
  assert.deepEqual(objectNavigation(unknown).search.map(({ id }) => id), ["future-star", "future-planet", "future-dwarf"]);
  assert.deepEqual(objectNavigation(unknown).planets.map(({ id }) => id), ["future-planet"]);
});

test("prepared marker addresses and presentation follow packages", async () => {
  for (const { id } of SCENE_OBJECTS) {
    assert.equal(PREPARED_NAVIGATION_MARKERS[id].url, `/navigation/body-${id}.webp`);
    assert.equal(PREPARED_NAVIGATION_MARKERS[id].index, 0);
    assert.equal(PREPARED_NAVIGATION_MARKERS[id].count, 1);
  }
  const descriptors = await loadMarkerDescriptors();
  assert.deepEqual(Object.keys(PREPARED_NAVIGATION_MARKERS), descriptors.map(({ planetId }) => planetId));
  for (const descriptor of descriptors) {
    const marker = PREPARED_NAVIGATION_MARKERS[descriptor.planetId];
    const { context: _context, ...atlasMarker } = marker;
    assert.deepEqual(atlasMarker, { url: `/navigation/body-${descriptor.planetId}.webp`, url2x: `/navigation/body-${descriptor.planetId}@2x.webp`, url2xPixels: marker.url2xPixels, index: 0, count: 1, presentation: descriptor.presentation });
    const result = markerStyle(marker, { color: "#ffffff" });
    assert.ok(result.style.includes("color:#ffffff"));
    assert.ok(result.innerStyle.includes("background-size:100% 100%"));
    assert.ok(result.innerStyle.includes(`url("${marker.url2x}")`));
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
  const fixture = { ...source, planetId: "new-body", presentation: { size: 8 } };
  await writeFile(resolve(dir, "navigation.json"), JSON.stringify(fixture));
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
  const result = markerStyle({ url: '/navigation/body-test.webp', url2x: '/navigation/body-test@2x.webp', index: 0, count: 1, presentation }, { color: "#ffffff", view: "scale" });
  assert.equal(result.ringed, true);
  assert.match(result.ringStyle, /width:28px/);
  assert.match(result.ringStyle, /height:4px/);
  assert.doesNotMatch(`${result.style};${result.innerStyle};${result.ringStyle}`, /NaN|undefined/);
  assert.doesNotThrow(() => validateMarkerPresentation({ size: 8, scale: { ringAngle: 0, ringExtra: 12, ringHeight: 4 } }));
});
