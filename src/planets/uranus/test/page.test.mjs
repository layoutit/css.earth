import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the shared shell and thin Uranus route", async () => {
  const [page, panel, route] = await Promise.all([
    readFile(new URL("../site/UranusPage.astro", import.meta.url), "utf8"),
    readFile(new URL("../site/UranusPanel.astro", import.meta.url), "utf8"),
    readFile(new URL("../../../../site/pages/uranus.astro", import.meta.url), "utf8"),
  ]);
  assert.match(page, /PlanetLayout/u);
  assert.match(panel, /PlanetShell/u);
  assert.doesNotMatch(panel, /<header|class="planet-stage"/u);
  assert.match(route, /UranusPage/u);
});
