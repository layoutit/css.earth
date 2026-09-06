import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORDMARK_GLYPHS } from "../source/branding/wordmark-glyphs.mjs";
import { WORDMARK_RAIL_SEGMENTS } from
  "../source/branding/wordmark-rail-segments.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("application geometry has one owner, separate from component appearance", async () => {
  const [layout, shell, maps, rail, page] = await Promise.all([
    read("shell-layout.css"), read("planet-shell.css"), read("maps-shell.css"),
    read("explorer-rail.css"), read("layouts/PlanetLayout.astro"),
  ]);
  assert.match(page, /import "\.\.\/shell-layout\.css"/u);
  for (const source of [shell, maps, rail]) {
    assert.doesNotMatch(source, /\.planet-(?:topbar|header-rail|sidebar)\s*\{/u);
    assert.doesNotMatch(source, /\.planet-wordmark/u);
  }
  assert.match(layout, /--explorer-rail-left:\s*12px/u);
  assert.match(layout, /--explorer-rail-item-gap:\s*0px/u);
  assert.match(layout, /--explorer-header-panel-gap:\s*12px/u);
  assert.match(layout, /--explorer-panel-gap:\s*8px/u);
  assert.match(layout, /--explorer-search-height:\s*48px/u);
  assert.match(layout, /--explorer-surface-background:\s*#151515/u);
  assert.match(layout, /--explorer-(?:rail|panel)-background:\s*var\(--explorer-surface-background\)/u);
  assert.match(layout, /--explorer-panel-width:\s*340px/u);
  assert.match(layout, /--explorer-scene-offset:\s*170px/u);
  assert.doesNotMatch(layout, /explorer-header-height|planet-topbar|planet-header-rail/u);
  assert.match(layout, /--explorer-content-inset:\s*20px/u);
  assert.match(layout, /--explorer-logo-size:\s*36px/u);
  assert.match(layout, /--explorer-wordmark-size:\s*36px/u);
  assert.match(layout, /--explorer-header-top:\s*8px/u);
  assert.match(layout, /--explorer-controls-top:\s*calc\(var\(--explorer-header-top\) \+ var\(--explorer-search-height\) \+ var\(--explorer-header-panel-gap\)\)/u);
  assert.doesNotMatch(layout, /--explorer-rail-(?:width|height|gap):/u);
  assert.match(layout, /--explorer-panel-left:\s*var\(--explorer-rail-left\)/u);
  assert.match(layout, /\.explorer-shell-header\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*var\(--explorer-header-top\) auto auto var\(--explorer-rail-left\);[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*space-between;[^}]*width:\s*min\(\s*var\(--explorer-panel-width\),\s*calc\(100vw - var\(--explorer-rail-left\) - 8px\)\s*\);[^}]*height:\s*var\(--explorer-search-height\);/u);
  assert.match(layout, /\.explorer-shell-wordmark\s*\{[^}]*display:\s*flex;[^}]*flex:\s*0 0 auto;[^}]*height:\s*var\(--explorer-search-height\);[^}]*margin-inline-start:\s*4px;/u);
  assert.match(layout, /\.explorer-rail\s*\{[^}]*position:\s*static;[^}]*flex:\s*0 0 auto;[^}]*width:\s*max-content;[^}]*height:\s*var\(--explorer-search-height\);[^}]*max-height:\s*none;/u);
  assert.match(layout, /\.planet-sidebar\s*\{[^}]*inset:\s*0 auto auto var\(--explorer-panel-left\)/u);
  assert.match(layout, /\.planet-sidebar\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*calc\(100dvh - var\(--explorer-panel-bottom-gap\)\)/u);
  assert.match(layout, /\.planet-sidebar\s*\{[^}]*padding:\s*var\(--explorer-controls-top\) var\(--explorer-panel-padding\) var\(--explorer-panel-block-padding\);/u);
  assert.doesNotMatch(layout, /\.planet-sidebar-wordmark\s*\{/u);
  assert.doesNotMatch(layout, /planet-brand-footer|explorer-footer-height/u);
  assert.match(layout, /--explorer-card-padding-left:\s*calc\(var\(--explorer-content-inset\) - var\(--explorer-panel-padding\)\)/u);
  assert.match(layout, /\.planet-stage\s*\{[^}]*inset-inline-start:\s*0;[^}]*translate:\s*none;/u);
  assert.match(layout, /\.planet-stage > \.planet-render-root\s*\{[^}]*inset-inline-start:\s*var\(--explorer-scene-offset\);[^}]*inset-inline-end:\s*calc\(-1 \* var\(--explorer-scene-offset\)\);/u);
  assert.match(layout, /\.planet-stage > \.planet-directional-sun\s*\{[^}]*translate:\s*var\(--explorer-scene-offset\) 0;/u);
});

test("wordmark uses tight prepared bounds and ordinary inline baseline alignment", async () => {
  const [component, styles, layout] = await Promise.all([
    read("components/CssEarthWordmark.astro"), read("wordmark.css"), read("shell-layout.css"),
  ]);
  assert.match(component, /viewBox="0\.89 6\.99 85\.64 16\.27"/u);
  assert.doesNotMatch(component + styles, /__CSSEARTH_VERSION__|versionLabel|planet-wordmark-version/u);
  assert.match(styles, /vertical-align:\s*calc\(-0\.26em \/ 22\)/u);
  assert.doesNotMatch(styles, /position:\s*(?:fixed|absolute)|::before|transform:|\b(?:top|left):/u);
  assert.doesNotMatch(layout, /6\.99|0\.89|23\.26|86\.53/u);
  assert.match(styles, /\.planet-wordmark-two-line\s*\{[^}]*flex-direction:\s*column;[^}]*gap:\s*5px;/u);
  assert.match(component, /WORDMARK_RAIL_SEGMENTS/u);
  assert.match(component, /width=\{segment\.renderedWidth\}[\s\S]*?height=\{segment\.renderedHeight\}/u);
  assert.doesNotMatch(styles, /planet-wordmark-two-line-(?:css|earth)\s*\{/u);
});

test("two-line rail wordmark uses its prepared trial weights", async () => {
  const component = await read("components/CssEarthWordmark.astro");
  const original = [...component.matchAll(/class="planet-wordmark-(?:css|earth)"\s+d="([^"]+)"/gu)]
    .map((match) => match[1]).join("");
  assert.deepEqual(
    WORDMARK_RAIL_SEGMENTS.map(({ label, weight }) => [label, weight]),
    [["css", 400], ["earth", 300]],
  );
  assert.deepEqual(
    WORDMARK_RAIL_SEGMENTS.map(({ text }) => text),
    ["css.", "earth"],
  );
  assert.equal(WORDMARK_RAIL_SEGMENTS[0].tailWeight, 300);
  assert.ok(WORDMARK_RAIL_SEGMENTS.every(({ fontSize }) => fontSize === 22));
  assert.ok(WORDMARK_RAIL_SEGMENTS.every(({ opticalSize }) => opticalSize === 22));
  assert.ok(WORDMARK_RAIL_SEGMENTS.every(({ width, height, viewBox }) =>
    viewBox.endsWith(` ${width} ${height}`)));
  assert.deepEqual(
    WORDMARK_RAIL_SEGMENTS.map(({ renderedHeight }) => renderedHeight),
    [14.25, 16.25],
  );
  assert.equal(WORDMARK_GLYPHS.filter(({ letter }) => letter !== ".").map(({ letter }) => letter).join(""), "cssearth");
  assert.equal(WORDMARK_GLYPHS.map(({ path }) => path).join(""), original);
});
