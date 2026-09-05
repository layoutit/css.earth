import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("lands the root route on the canonical Earth page", async () => {
  const [source, earthRoute, earthPage] = await Promise.all([
    readFile(new URL("../pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../pages/earth.astro", import.meta.url), "utf8"),
    readFile(new URL("../../src/planets/earth/site/EarthPage.astro", import.meta.url), "utf8"),
  ]);
  for (const route of [source, earthRoute]) {
    assert.match(route, /import EarthPage from "\.\.\/\.\.\/src\/planets\/earth\/site\/EarthPage\.astro";/u);
    assert.match(route, /<EarthPage \/>/u);
  }
  assert.match(earthPage, /<PlanetLayout objectId="earth">/u);
  assert.doesNotMatch(source, /ExplorerSidebar|MapsChrome|data-explorer-shell|maps-empty-stage|No object selected/u);
});

test("derives search results and navigation from the one object registry", async () => {
  const [registryView, results, explorer, shell, client] = await Promise.all([
    readFile(new URL("../planet-search-objects.mjs", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetObjectResults.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/ExplorerSidebar.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetShell.astro", import.meta.url), "utf8"),
    readFile(new URL("../maps-search-client.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(registryView, /import \{ OBJECTS \} from "\.\/objects\.mjs";/u);
  assert.match(registryView, /objectNavigation\(OBJECTS\)/u);
  for (const source of [explorer, shell]) {
    assert.match(source, /import PlanetObjectResults from "\.\/PlanetObjectResults\.astro";/u);
    assert.match(source, /<PlanetObjectResults/u);
    assert.doesNotMatch(source, /OBJECTS\.map|planet-object-marker|planet-object-browser-title/u);
  }
  assert.match(results, /PLANET_SEARCH_OBJECTS\.map\(\(object\)/u);
  assert.match(results, /href=\{object\.route\}/u);
  assert.match(results, /data-object-id=\{object\.id\}/u);
  assert.match(results, /import PlanetNavigationMarker from "\.\/PlanetNavigationMarker\.astro";/u);
  assert.match(results, /<PlanetNavigationMarker[\s\S]*?planetId=\{object\.id\}/u);
  assert.doesNotMatch(results, /index=|count=/u);
  assert.match(results, /object\.classification === "star" && object\.distanceAu === 0 \? "Our star"/u);
  assert.match(results, /class="planet-object-distance-value">\{object\.distanceAu\}<\/span>\{" "\}[\s\S]*?class="planet-object-distance-unit">AU<\/span>/u);
  assert.match(client, /querySelectorAll\("\[data-maps-search\]"\)/u);
  assert.match(client, /item\.dataset\.objectName\?\.includes\(query\)/u);
  assert.match(client, /first\.click\(\)/u);
  assert.doesNotMatch(client, /innerHTML|insertAdjacentHTML|fetch\(/u);
});

test("keeps the Maps-style shell separate from retained object rendering", async () => {
  const [layout, chrome, styles, markerStyles, results, marker, rail, scale, wordmark] = await Promise.all([
    readFile(new URL("../layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/MapsChrome.astro", import.meta.url), "utf8"),
    readFile(new URL("../maps-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../planet-navigation-marker.css", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetObjectResults.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetNavigationMarker.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/ExplorerRail.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetaryScale.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/CssEarthWordmark.astro", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /import "\.\.\/maps-shell\.css";/u);
  assert.match(layout, /import "\.\.\/explorer-rail\.css";/u);
  assert.match(layout, /import "\.\.\/shell-layout\.css";/u);
  assert.doesNotMatch(layout, /<MapsChrome \/>/u);
  assert.doesNotMatch(layout, /PlanetHeader/u);
  assert.match(layout, /data-object-id=\{objectRecord\.id\}/u);
  assert.match(layout, /import "\.\.\/scene-router\.mjs";/u);
  assert.match(layout, /<CssEarthWordmark \/>[\s\S]*?<ExplorerRail objectId=\{objectRecord\.id\} \/>[\s\S]*?<PlanetaryScale activeObjectId=\{objectRecord\.id\} \/>/u);
  assert.doesNotMatch(chrome, /OBJECTS|maps-utility-rail|maps-rail-|loadScene|mount|planet-render-root/u);
  assert.doesNotMatch(styles, /maps-utility-rail|maps-rail-/u);
  assert.doesNotMatch(styles, /planet-render-root|polycss-camera|planet-topbar|planetary-scale/u);
  assert.doesNotMatch(chrome, /maps-category-strip|Object categories|The star|Terrestrial|Gas giants|Ice giants/u);
  assert.doesNotMatch(styles, /\.maps-category-strip/u);
  assert.match(chrome, /import CssEarthWordmark from "\.\/CssEarthWordmark\.astro";/u);
  assert.match(rail, /class="explorer-rail"[\s\S]*?aria-label="Planet information"[\s\S]*?aria-label="About"[\s\S]*?aria-label="Settings"/u);
  assert.doesNotMatch(rail, /OBJECTS|PlanetNavigationMarker|Collapse|Expand/u);
  assert.match(scale, /PLANET_NAVIGATION_OBJECTS[\s\S]*?positionPlanetsByDistance[\s\S]*?PlanetNavigationMarker/u);
  assert.match(scale, /--planet-track-start:\$\{positionedPlanets\[0\]\.scalePositionPercent\}%/u);
  assert.match(results, /import PlanetNavigationMarker from "\.\/PlanetNavigationMarker\.astro";/u);
  assert.match(results, /<PlanetNavigationMarker[\s\S]*?planetId=\{object\.id\}/u);
  assert.match(marker, /markerStyle\(PREPARED_NAVIGATION_MARKERS\[planetId\]/u);
  assert.doesNotMatch(marker, /mercury:|saturn:|neptune:/u);
  assert.match(markerStyles, /url\("\/navigation\/planet-markers@2x\.webp"\)/u);
  assert.doesNotMatch(markerStyles, /image-set\(|planet-markers\.webp/u);
  assert.match(markerStyles, /outline-offset:\s*var\(--planet-ring-outline-offset, 0\);/u);
  const pathData = (source) => [...source.matchAll(/<path[\s\S]*?\sd="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(pathData(wordmark).length, 2);
  assert.doesNotMatch(wordmark, /planet-wordmark-version|Version \$\{|planet-wordmark-tagline/u);
  assert.match(styles, /\.planet-sidebar \.maps-object-results/u);
  assert.doesNotMatch(styles, /(?:linear|radial|conic)-gradient\(/u);
});
