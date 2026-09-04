import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import mars from "../../../../data/planets/mars.json" with { type: "json" };
import { PLANET_SPEED_STATES } from "../../../platform/planet-feature-controls.mjs";
import { PREPARED_MARS_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_MARS_PANEL } from "../site/preparedPanel.mjs";

const files = await Promise.all([
  readFile(new URL("../site/MarsPanel.astro", import.meta.url), "utf8"),
  readFile(new URL("../../../../site/components/PlanetShell.astro", import.meta.url), "utf8"),
  readFile(new URL("../../../../site/planet-shell.css", import.meta.url), "utf8"),
  readFile(new URL("../site/MarsPage.astro", import.meta.url), "utf8"),
  readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
]);
const [panel, shell, css, page, client] = files;

test("supplies complete Mars content to the shared shell", () => {
  assert.match(panel, /<PlanetShell[\s\S]*?objectId="mars"/u);
  assert.doesNotMatch(panel, /<header\b|<nav class=.*actions|<aside\b/u);
  assert.match(shell, /class="planet-sidebar"/u);
  assert.match(shell, /class="planet-selected-panel"/u);
  assert.deepEqual(PREPARED_MARS_PANEL.facts.map(({ label }) => label),
    ["Distance", "Diameter", "Year", "Day", "Moons"]);
  assert.match(panel, /mars-reflectance-spectrum\.svg/u);
  assert.match(panel, /mars-temperature-pressure-profile\.svg/u);
  assert.equal(mars.sourceId, 107740);
  assert.equal(mars.credit, "NASA Science");
});

test("keeps Mars content free of Saturn and invented feature UI", () => {
  for (const source of [panel, page]) {
    assert.doesNotMatch(source, /saturn|\/scenes\/saturn/iu);
    assert.doesNotMatch(source, /—/u);
  }
  assert.doesNotMatch(panel, /feature-search|surface feature|clickable feature/iu);
  assert.doesNotMatch(panel, />\s*placeholder\s*<|coming soon/iu);
});

test("wires every prepared Mars lens and only supported settings", () => {
  assert.match(panel, /PREPARED_MARS_LENSES\.controls\.map/u);
  assert.equal(PREPARED_MARS_LENSES.controls.length, 3);
  assert.match(panel, /name: "speed"/u);
  assert.match(panel, /name: "shadows"/u);
  assert.doesNotMatch(panel, /name: "moons"|name: "rings"|name: "features"/u);
  assert.match(client, /createMarsPanelControls/u);
  assert.match(client, /"\.planet-drawer-content \.planet-lenses"/u);
  assert.match(client, /"\.planet-settings-panel \.planet-settings"/u);
  assert.doesNotMatch(client, /querySelector\([^\n]*\.mars-(?:header|lenses|options|settings)/u);
  assert.equal(PLANET_SPEED_STATES.at(-1)?.label, "superfast");
});

test("uses the sole responsive shell stylesheet", () => {
  assert.match(page, /site\/planet-shell\.css/u);
  assert.match(css, /--planet-shell-width:\s*340px/u);
  assert.match(css, /font:\s*14px\/1\.4 var\(--shell-ui-font\)/u);
  assert.match(css, /@media \(max-width: 820px\)/u);
  assert.match(css,
    /@media \(min-width: 821px\) and \(orientation: landscape\)/u);
  assert.doesNotMatch(css, /\.mars-|\.saturn-/u);
});
