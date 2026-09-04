import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("routes Neptune through the shared shell without duplicating it", async () => {
  const [route, page, panel] = await Promise.all([
    readFile(new URL("../../../../site/pages/neptune.astro", import.meta.url),
      "utf8"),
    readFile(new URL("../site/NeptunePage.astro", import.meta.url), "utf8"),
    readFile(new URL("../site/NeptunePanel.astro", import.meta.url), "utf8"),
  ]);
  assert.match(route, /NeptunePage/u);
  assert.match(page, /PlanetLayout/u);
  assert.match(panel, /PlanetShell/u);
  assert.doesNotMatch(route, /planet-stage|planet-header|planet-settings/u);
  assert.doesNotMatch(page, /<header|<nav|planet-settings/u);
  assert.doesNotMatch(panel, /<header|class="planet-stage"/u);
});
