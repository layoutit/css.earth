import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { OBJECTS } from "../objects.mjs";
import { objectNavigation, PLANET_SEARCH_OBJECTS, PLANET_NAVIGATION_OBJECTS } from "../planet-search-objects.mjs";
import { loadMarkerDescriptors } from "../../tools/prepare-navigation.mjs";
import { markerStyle, validateMarkerPresentation } from "../../src/navigation/marker-presentation.mjs";
import { PREPARED_NAVIGATION_MARKERS } from "../prepared-navigation-markers.mjs";

test("search contains every object, including the Sun; only planets enter the scale", () => {
  assert.deepEqual(new Set(PLANET_SEARCH_OBJECTS), new Set(OBJECTS));
  assert.ok(PLANET_SEARCH_OBJECTS.some(({ id }) => id === "sun"));
  assert.ok(PLANET_NAVIGATION_OBJECTS.every(({ classification }) => classification === "planet"));
  const unknown = [
    { id: "future-dwarf", classification: "dwarf-planet", distanceAu: 40 },
    { id: "future-planet", classification: "planet", distanceAu: 4 },
    { id: "future-star", classification: "star", distanceAu: 0 },
  ];
  assert.deepEqual(objectNavigation(unknown).search.map(({ id }) => id), ["future-star", "future-planet", "future-dwarf"]);
  assert.deepEqual(objectNavigation(unknown).planets.map(({ id }) => id), ["future-planet"]);
});

test("prepared marker identity, atlas order, and presentation follow packages", async () => {
  const descriptors = await loadMarkerDescriptors();
  assert.deepEqual(Object.keys(PREPARED_NAVIGATION_MARKERS), descriptors.map(({ planetId }) => planetId));
  for (const [index, descriptor] of descriptors.entries()) {
    const marker = PREPARED_NAVIGATION_MARKERS[descriptor.planetId];
    assert.deepEqual(marker, { index, count: descriptors.length, presentation: descriptor.presentation });
    assert.ok(markerStyle(marker, { color: "#ffffff" }).style.includes(`--planet-marker-count:${descriptors.length}`));
  }
  assert.equal(PREPARED_NAVIGATION_MARKERS.saturn.presentation.scale.ringExtra, 20);
  assert.equal(PREPARED_NAVIGATION_MARKERS.saturn.presentation.ringExtra, 14);
});

test("an unknown object loads its own marker; missing packages fail without fallback", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-owned-marker-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const dir = resolve(root, "src/planets/new-body/tools");
  await mkdir(dir, { recursive: true });
  const source = (await loadMarkerDescriptors())[0];
  const fixture = { ...source, planetId: "new-body", presentation: { size: 8 } };
  await writeFile(resolve(dir, "navigation-marker.mjs"), `export default ${JSON.stringify(fixture)};`);
  assert.deepEqual(await loadMarkerDescriptors({ projectRoot: root, planets: [{ id: "new-body" }] }), [fixture]);
  await assert.rejects(loadMarkerDescriptors({ projectRoot: root, planets: [{ id: "missing" }] }), /Cannot find module/);
  assert.throws(() => markerStyle(undefined), /missing/);
  for (const bad of [null, {}, { size: 0 }, { size: 8, ringAngle: 3 }, { size: 8, ringOpacity: 2 }, { size: 8, css: "url(example)" }]) assert.throws(() => validateMarkerPresentation(bad));
});

test("scale overrides must form a complete presentation after inheritance", () => {
  for (const scale of [{ ringAngle: 0 }, { ringExtra: 12 }, { ringOpacity: 0.5 }, { scale: { size: 4 } }]) {
    assert.throws(() => validateMarkerPresentation({ size: 8, scale }));
  }
  const presentation = { size: 8, ringAngle: 0, ringExtra: 12, ringHeight: 4, scale: { ringExtra: 20 } };
  assert.equal(validateMarkerPresentation(presentation), presentation);
  const result = markerStyle({ index: 0, count: 1, presentation }, { color: "#ffffff", view: "scale" });
  assert.equal(result.ringed, true);
  assert.match(result.style, /--planet-ring-extra:20px/);
  assert.match(result.style, /--planet-ring-height:4px/);
  assert.doesNotMatch(result.style, /NaN|undefined/);
  assert.doesNotThrow(() => validateMarkerPresentation({ size: 8, scale: { ringAngle: 0, ringExtra: 12, ringHeight: 4 } }));
});
