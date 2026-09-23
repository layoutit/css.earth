import { hasErrorCode, isRecord, requireString } from "../sources/source-values.mts";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import * as fontkit from "fontkit";

import { SCENE_OBJECTS } from "../../site/objects.mts";
import { OBJECT_TITLE_RECIPE } from
  "../../src/platform/object-title-recipe.mts";
import { sha256 } from "../../src/platform/sha256.mts";
import { createPreparedTitleLayout } from "../../src/platform/prepared-title.mts";
import { createObjectTitleSource, prepareObjectTitleSources } from
  "./prepare-object-title-sources.mts";
import type { PathLike } from "node:fs";

const projectRoot = resolve(import.meta.dirname, "../..");

test("Hiʻiaka preserves its okina using a real glyph in the title font", async () => {
  const fontPath = resolve(projectRoot, OBJECT_TITLE_RECIPE.checkedFontPath);
  const opened = fontkit.openSync(fontPath);
  assert.ok("getVariation" in opened);
  const font = opened.getVariation({
    wght: OBJECT_TITLE_RECIPE.weight,
    opsz: OBJECT_TITLE_RECIPE.opticalSize,
  });
  const okina = font.layout("ʻ").glyphs;
  assert.equal(okina.length, 1);
  assert.notEqual(okina[0].id, 0, "the okina must not render as .notdef");
  assert.ok(okina[0].path.commands.length > 0, "the okina must have visible outlines");
  const source = createObjectTitleSource("Hiʻiaka", font);
  assert.equal(source.label, "Hiʻiaka");
  assert.ok(source.width > 0);
  assert.notEqual(source.path, createObjectTitleSource("Hiiaka", font).path);
  assert.throws(() => createObjectTitleSource("海王星", font), /missing from the title font/u);
  assert.throws(() => createObjectTitleSource("Hi\nʻiaka", font), /label "Hi\\nʻiaka" is invalid/u);
  assert.equal(createObjectTitleSource("WD 1856+534", font).label, "WD 1856+534");
  assert.throws(() => createObjectTitleSource("WD 1856++534", font), /"WD 1856\+\+534" is invalid/u);
});

test("regenerates every planet title from one pinned Saturn recipe", async () => {
  const generated = await prepareObjectTitleSources({
    writeSource: async () => {},
  });
  assert.deepEqual(Object.keys(generated), SCENE_OBJECTS.map(({ id }) => id));

  for (const planet of SCENE_OBJECTS) {
    const { source, moduleSource } = generated[planet.id];
    const contentPath = resolve(projectRoot, `src/objects/${planet.id}/source/content/object.json`);
    const label = await exists(contentPath) ? JSON.parse(await readFile(contentPath, 'utf8')).displayName : planet.name;
    assert.equal(source.label, label);
    assert.equal(source.weight, OBJECT_TITLE_RECIPE.weight);
    assert.equal(source.opticalSize, OBJECT_TITLE_RECIPE.opticalSize);
    assert.equal(source.fontSize, OBJECT_TITLE_RECIPE.fontSize);
    assert.equal(source.letterSpacing, OBJECT_TITLE_RECIPE.letterSpacing);
    assert.equal(source.baseline, OBJECT_TITLE_RECIPE.baseline);
    assert.equal(source.height, OBJECT_TITLE_RECIPE.viewBoxHeight);
    assert.equal(source.xOrigin, "trim-left-bearing");
    assert.equal(source.sourceGenerator, OBJECT_TITLE_RECIPE.sourceGenerator);
    const jsonTitlePath = resolve(projectRoot,
      `src/objects/${planet.id}/source/presentation/title-mark.json`);
    const moduleTitlePath = resolve(projectRoot,
      `src/objects/${planet.id}/source/presentation/title-mark.mjs`);
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
        `src/objects/${planet.id}/site/preparedTitle.mjs`);
      assert.equal(await exists(preparedTitlePath), true,
        `${planet.id}: title must have a checked source or prepared output`);
      const preparedModule = await import(pathToFileURL(preparedTitlePath).href);
      const preparedTitle = Object.values(preparedModule).find(value =>
        isRecord(value) && value.label === planet.name);
      assert.ok(isRecord(preparedTitle), `${planet.id}: prepared title export`);
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
      assert.match(requireString(preparedTitle.generator), /prepare-content\.mjs$/u,
        `${planet.id}: prepared title generator`);
    }
  }
});

async function exists(path: PathLike) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (hasErrorCode(error,"ENOENT")) return false;
    throw error;
  }
}
