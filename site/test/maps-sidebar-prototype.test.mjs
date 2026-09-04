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
  assert.match(results, /PLANET_SEARCH_OBJECTS\.map\(\(object, index\)/u);
  assert.match(results, /href=\{object\.route\}/u);
  assert.match(results, /data-object-id=\{object\.id\}/u);
  assert.match(results, /import PlanetNavigationMarker from "\.\/PlanetNavigationMarker\.astro";/u);
  assert.match(results, /<PlanetNavigationMarker[\s\S]*?planetId=\{object\.id\}[\s\S]*?index=\{index\}/u);
  assert.match(results, /class="planet-object-distance-value">\{object\.distanceAu\}<\/span>\{" "\}[\s\S]*?class="planet-object-distance-unit">AU<\/span>/u);
  assert.match(client, /querySelectorAll\("\[data-maps-search\]"\)/u);
  assert.match(client, /item\.dataset\.objectName\?\.includes\(query\)/u);
  assert.match(client, /first\.click\(\)/u);
  assert.doesNotMatch(client, /innerHTML|insertAdjacentHTML|fetch\(/u);
});

test("keeps the Maps-style shell separate from retained object rendering", async () => {
  const [layout, chrome, styles, markerStyles, results, marker, originalHeader, reusedWordmark] = await Promise.all([
    readFile(new URL("../layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/MapsChrome.astro", import.meta.url), "utf8"),
    readFile(new URL("../maps-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../planet-navigation-marker.css", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetObjectResults.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetNavigationMarker.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/PlanetHeader.astro", import.meta.url), "utf8"),
    readFile(new URL("../components/CssEarthWordmark.astro", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /import "\.\.\/maps-shell\.css";/u);
  assert.doesNotMatch(layout, /<MapsChrome \/>/u);
  assert.match(layout, /data-object-id=\{objectRecord\.id\}/u);
  assert.match(layout, /import "\.\.\/scene-router\.mjs";/u);
  assert.doesNotMatch(chrome, /OBJECTS|maps-utility-rail|maps-rail-|loadScene|mount|planet-render-root/u);
  assert.doesNotMatch(styles, /maps-utility-rail|maps-rail-/u);
  assert.doesNotMatch(styles, /planet-render-root|polycss-camera|planet-topbar|planetary-scale/u);
  assert.match(styles, /--maps-panel-left:\s*20px;/u);
  assert.match(styles, /--maps-panel-width:\s*340px;/u);
  assert.match(styles, /\.maps-brand-button\s*\{[\s\S]*?left:\s*20px;/u);
  assert.match(styles, /\.maps-explorer-sidebar,[\s\S]*?body\[data-object-shell\] \.planet-sidebar\s*\{[\s\S]*?inset:\s*81px auto 10px var\(--maps-panel-left\);[\s\S]*?gap:\s*10px;[\s\S]*?max-height:\s*calc\(100dvh - 91px\);/u);
  assert.match(styles, /\.maps-explorer-sidebar \.planet-sidebar-search\s*\{[\s\S]*?padding:\s*11px 76px 13px 43px;[\s\S]*?border-radius:\s*4px;[\s\S]*?background-color:\s*#151515;[\s\S]*?background-position:\s*18px calc\(50% - 1px\);/u);
  assert.match(styles, /\.maps-explorer-sidebar \.planet-sidebar-search:focus\s*\{\s*background-color:\s*#1e1e1e;\s*\}/u);
  assert.match(styles, /@media \(min-width:\s*961px\)[\s\S]*?body\[data-object-shell\] \.planet-sidebar \.planet-sidebar-search\s*\{[\s\S]*?padding:\s*11px 76px 13px 43px;[\s\S]*?border-radius:\s*4px;[\s\S]*?background-color:\s*#151515;[\s\S]*?background-position:\s*18px calc\(50% - 1px\);[\s\S]*?body\[data-object-shell\] \.planet-sidebar \.planet-sidebar-search:focus\s*\{[\s\S]*?background-color:\s*#1e1e1e;[\s\S]*?\.planet-information-panel,[\s\S]*?\.planet-object-browser[\s\S]*?border-radius:\s*4px;[\s\S]*?background:\s*#151515;/u);
  assert.match(styles, /\.planet-sidebar \.maps-object-results\s*\{[\s\S]*?display:\s*block;[\s\S]*?padding:\s*6px 12px 6px 20px;[\s\S]*?border-radius:\s*4px;/u);
  assert.match(styles, /\.planet-sidebar \.maps-object-results \.planet-object-list::before\s*\{[\s\S]*?top:\s*17px;[\s\S]*?bottom:\s*17px;[\s\S]*?left:\s*5\.5px;[\s\S]*?width:\s*0;[\s\S]*?border-left:\s*1px dotted rgb\(223 223 223 \/ 28%\);[\s\S]*?transform:\s*translateX\(-0\.5px\);/u);
  assert.match(styles, /\.planet-sidebar \.maps-object-results \.planet-object-link\s*\{[\s\S]*?grid-template-columns:\s*11px minmax\(0, 1fr\) max-content;[\s\S]*?gap:\s*12px;[\s\S]*?height:\s*34px;/u);
  assert.match(styles, /\.planet-sidebar \.maps-object-results \.planet-navigation-marker\.ringed::before\s*\{\s*content:\s*none;\s*\}/u);
  assert.doesNotMatch(chrome, /maps-category-strip|Object categories|The star|Terrestrial|Gas giants|Ice giants/u);
  assert.doesNotMatch(styles, /\.maps-category-strip/u);
  assert.match(chrome, /import CssEarthWordmark from "\.\/CssEarthWordmark\.astro";/u);
  assert.match(originalHeader, /import CssEarthWordmark from "\.\/CssEarthWordmark\.astro";/u);
  assert.match(originalHeader, /<CssEarthWordmark \/>/u);
  assert.match(originalHeader, /import PlanetaryScale from "\.\/PlanetaryScale\.astro";/u);
  assert.match(originalHeader, /<PlanetaryScale activeObjectId=\{objectId\} \/>/u);
  assert.match(originalHeader, /class="planet-sidebar-collapse-label">Collapse<\/span>[\s\S]*?class="planet-sidebar-expand-label">Expand<\/span>/u);
  assert.match(styles, /\.maps-brand-button \.planet-wordmark-svg\s*\{[\s\S]*?width:\s*213px;[\s\S]*?height:\s*49px;/u);
  assert.match(styles, /\.maps-brand-button \.planet-wordmark\s*\{[\s\S]*?opacity:\s*1;/u);
  assert.match(styles, /\.maps-brand-button \.planet-wordmark-svg\s*\{[\s\S]*?opacity:\s*\.9;/u);
  assert.match(styles, /\.maps-brand-button \.planet-wordmark-svg\s*\{[^}]*transform:\s*none;/u);
  assert.match(reusedWordmark, /const versionLabel = `Version \$\{__CSSEARTH_VERSION__\}`;/u);
  assert.match(reusedWordmark, /class="planet-wordmark-version">\{versionLabel\}<\/span>/u);
  assert.doesNotMatch(reusedWordmark, /planet-wordmark-tagline|Explore the cosmos/u);
  assert.match(styles, /\.planet-wordmark-version\s*\{[\s\S]*?top:\s*42px;[\s\S]*?left:\s*1\.5px;[\s\S]*?color:\s*#aaa;[\s\S]*?font:\s*14px\/1\.2 var\(--shell-ui-font\);[\s\S]*?opacity:\s*\.75;/u);
  assert.match(styles, /@media \(min-width:\s*961px\)\s*\{[\s\S]*?\.planet-header-rail\s*\{[^}]*flex-basis:\s*var\(--maps-panel-width\);[^}]*margin-left:\s*2px;/u);
  assert.match(styles, /\.planet-header-rail > \.planet-sidebar-toggle \.planet-blackhole-marker\s*\{[\s\S]*?top:\s*-1px;[\s\S]*?left:\s*-4px;/u);
  assert.match(styles, /\.planet-header-rail > \.planet-sidebar-toggle span\s*\{[\s\S]*?top:\s*42px;[\s\S]*?right:\s*0;[\s\S]*?left:\s*auto;[\s\S]*?transform:\s*none;[\s\S]*?text-align:\s*right;/u);
  assert.match(styles, /\.planet-header-rail > \.planet-sidebar-toggle\s*\{[^}]*top:\s*0;[^}]*height:\s*49px;/u);
  assert.match(styles, /\.planet-header-rail > \.planet-sidebar-toggle \.planet-action-marker\s*\{[^}]*top:\s*3px;/u);
  assert.match(styles, /\.planet-header-rail > \.planet-sidebar-toggle span\s*\{[^}]*top:\s*42px;/u);
  assert.match(styles, /\.planet-object-distance\s*\{[^}]*font:\s*400 13px\/20px/u);
  assert.match(styles, /\.planet-object-distance-unit\s*\{\s*font-size:\s*12px;\s*\}/u);
  assert.match(results, /import PlanetNavigationMarker from "\.\/PlanetNavigationMarker\.astro";/u);
  assert.match(results, /<PlanetNavigationMarker[\s\S]*?planetId=\{object\.id\}/u);
  assert.match(marker, /markerStyle\(PREPARED_NAVIGATION_MARKERS\[planetId\]/u);
  assert.doesNotMatch(marker, /mercury:|saturn:|neptune:/u);
  assert.match(markerStyles, /url\("\/navigation\/planet-markers@2x\.webp"\)/u);
  assert.doesNotMatch(markerStyles, /image-set\(|planet-markers\.webp/u);
  assert.match(markerStyles, /outline-offset:\s*var\(--planet-ring-outline-offset, 0\);/u);
  const pathData = (source) => [...source.matchAll(/<path[\s\S]*?\sd="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(pathData(reusedWordmark).length, 2);
  assert.match(styles, /\.planet-sidebar \.maps-object-results/u);
  assert.doesNotMatch(styles, /(?:linear|radial|conic)-gradient\(/u);
});
