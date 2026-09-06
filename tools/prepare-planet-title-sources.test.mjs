import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { OBJECTS } from "../site/objects.mjs";
import { PLANET_TITLE_RECIPE } from
  "../src/platform/planet-title-recipe.mjs";
import { createPreparedTitleLayout } from "../src/platform/prepared-title.mjs";
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
    const jsonTitlePath = resolve(projectRoot,
      `src/planets/${planet.id}/source/presentation/title-mark.json`);
    const moduleTitlePath = resolve(projectRoot,
      `src/planets/${planet.id}/source/presentation/title-mark.mjs`);
    if (await exists(jsonTitlePath)) {
      const titleBytes = await readFile(jsonTitlePath, "utf8");
      const titleJson = JSON.parse(titleBytes);
      delete titleJson.schema;
      assert.deepEqual(titleJson, source, `${planet.id}: checked JSON title source must be reproducible`);
    } else if (await exists(moduleTitlePath)) {
      const titleBytes = await readFile(moduleTitlePath, "utf8");
      assert.equal(moduleSource, titleBytes, `${planet.id}: checked title source must be reproducible`);
    } else {
      const preparedTitlePath = resolve(projectRoot,
        `src/planets/${planet.id}/site/preparedTitle.mjs`);
      assert.equal(await exists(preparedTitlePath), true,
        `${planet.id}: title must have a checked source or prepared output`);
      const preparedModule = await import(pathToFileURL(preparedTitlePath).href);
      const preparedTitle = Object.values(preparedModule).find(value =>
        value && typeof value === "object" && value.label === planet.name);
      assert.ok(preparedTitle, `${planet.id}: prepared title export`);
      for (const [field, value] of Object.entries(source)) {
        assert.deepEqual(preparedTitle[field], value,
          `${planet.id}: prepared title source field ${field}`);
      }
      assert.deepEqual(
        Object.fromEntries(Object.entries(createPreparedTitleLayout(source))),
        Object.fromEntries(Object.entries(preparedTitle).filter(([field]) =>
          ["renderViewBox", "renderWidth", "renderHeight", "renderPathOffsetY"].includes(field))),
        `${planet.id}: prepared title layout`,
      );
      assert.equal(preparedTitle.inputSha256, PLANET_TITLE_RECIPE.sourceSha256,
        `${planet.id}: prepared title input pin`);
      assert.match(preparedTitle.generator, /prepare-content\.mjs$/u,
        `${planet.id}: prepared title generator`);
    }
  }
});

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
