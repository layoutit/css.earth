import {required} from '../../../../tools/test-values.mts';
import assert from "node:assert/strict";
import { runtimeDefinition } from "../../unit/mars/prepared-fixture.mts";
import { objectControls } from "../../unit/mars/prepared-fixture.mts";
import { readFile } from "node:fs/promises";
import test from "node:test";

import mars from "../../../../data/planets/mars.json" with { type: "json" };
import { PLANET_SPEED_STATES } from "../../../../src/platform/planet-feature-controls.mts";
import { PREPARED_MARS_LENSES } from "../../unit/mars/prepared-fixture.mts";
import { PREPARED_MARS_PANEL } from "../../unit/mars/prepared-fixture.mts";

const files = await Promise.all([
  readFile(new URL("../../../../src/planets/mars/source/content/object.json", import.meta.url), "utf8"),
  readFile(new URL("../../../../site/components/PlanetShell.astro", import.meta.url), "utf8"),
  readFile(new URL("../../../../site/planet-shell.css", import.meta.url), "utf8"),
  readFile(new URL("../../../../site/shell-layout.css", import.meta.url), "utf8"),
  readFile(new URL("../../../../site/pages/mars.astro", import.meta.url), "utf8"),
  readFile(new URL("../../../../src/renderers/css/runtime/object-runtime.ts", import.meta.url), "utf8"),
]);
const [panel, shell, css, shellLayout, page, client] = files;

test("supplies complete Mars content to the shared shell", () => {
  assert.equal(JSON.parse(panel).id,'mars');
  assert.doesNotMatch(panel, /<header\b|<nav class=.*actions|<aside\b/u);
  assert.match(shell, /class="planet-sidebar"/u);
  assert.match(shell, /class="planet-selected-panel"/u);
  assert.deepEqual(PREPARED_MARS_PANEL.facts.map(({ label }) => label),
    [
      "Distance from Sun",
      "Diameter",
      "Orbital period",
      "Rotation period",
      "Axial tilt",
      "Moons",
      "Rings",
    ]);
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
  assert.deepEqual(JSON.parse(panel).settings.controls,required(objectControls.settings).controls);
  assert.deepEqual(required(objectControls.lenses).controls.map(({ id }) => id), PREPARED_MARS_LENSES.controls.map(({ id }) => id));
  assert.equal(PREPARED_MARS_LENSES.controls.length, 3);
  assert.deepEqual(required(objectControls.settings).controls.map(({ name }) => name), ["speed", "shadows"]);
  assert.deepEqual(runtimeDefinition.controls, objectControls);
  assert.doesNotMatch(client, /querySelector\([^\n]*\.mars-(?:header|lenses|options|settings)/u);
  assert.equal(PLANET_SPEED_STATES.at(-1)?.label, "superfast");
});

test("keeps responsive shell geometry generic and centralized", () => {
  assert.match(page, /import "\.\.\/planet-shell\.css"/u);
  assert.match(shellLayout, /--explorer-panel-width:\s*340px/u);
  assert.match(shellLayout, /font:\s*14px\/1\.4 var\(--shell-ui-font\)/u);
  assert.match(shellLayout, /@media \(max-width: 820px\), \(orientation: portrait\)/u);
  assert.match(shellLayout,
    /@media \(min-width: 821px\) and \(orientation: landscape\)/u);
  for (const source of [css, shellLayout]) assert.doesNotMatch(source, /\.mars-|\.saturn-/u);
});
