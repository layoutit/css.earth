import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { OBJECTS } from "../site/objects.mjs";
import { PLANET_TITLE_RECIPE } from
  "../src/platform/planet-title-recipe.mjs";
import { preparePlanetTitleSources } from
  "./prepare-planet-title-sources.mjs";

const projectRoot = resolve(import.meta.dirname, "..");

test("regenerates every planet title from one pinned Saturn recipe", async () => {
  const generated = await preparePlanetTitleSources({
    writeSource: async () => {},
  });
  assert.deepEqual(Object.keys(generated), OBJECTS.map(({ id }) => id));

  for (const planet of OBJECTS) {
    const { source, moduleSource } = generated[planet.id];
    assert.equal(source.label, planet.name);
    assert.equal(source.weight, PLANET_TITLE_RECIPE.weight);
    assert.equal(source.opticalSize, PLANET_TITLE_RECIPE.opticalSize);
    assert.equal(source.fontSize, PLANET_TITLE_RECIPE.fontSize);
    assert.equal(source.letterSpacing, PLANET_TITLE_RECIPE.letterSpacing);
    assert.equal(source.baseline, PLANET_TITLE_RECIPE.baseline);
    assert.equal(source.height, PLANET_TITLE_RECIPE.viewBoxHeight);
    assert.equal(source.xOrigin, "trim-left-bearing");
    assert.equal(source.sourceSha256, PLANET_TITLE_RECIPE.sourceSha256);
    assert.equal(source.sourceGenerator, PLANET_TITLE_RECIPE.sourceGenerator);
    const titlePath = planet.id === "mercury" || planet.id === "venus"
      ? `src/planets/${planet.id}/source/presentation/title-mark.json`
      : `src/planets/${planet.id}/source/presentation/title-mark.mjs`;
    const titleBytes = await readFile(resolve(projectRoot, titlePath), "utf8");
    if (titlePath.endsWith(".json")) {
      const titleJson = JSON.parse(titleBytes);
      delete titleJson.schema;
      assert.deepEqual(titleJson, source, `${planet.id}: checked JSON title source must be reproducible`);
    } else {
      assert.equal(moduleSource, titleBytes, `${planet.id}: checked title source must be reproducible`);
    }
  }
});
