import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { loadObjectContent } from "./load-object-content.mts";
import { PLANET_TITLE_STANDARD, createPreparedTitleLayout } from "../../src/platform/prepared-title.mts";
import { PLANET_TITLE_RECIPE } from
  "../../src/platform/planet-title-recipe.mts";
import { SCENE_OBJECTS } from "../objects.mts";
import { prepareShellTitles } from "../../tools/prepare/prepare-shell-titles.mts";
import { PREPARED_SHELL_TITLES } from "../prepared-shell-titles.mjs";
import { SHELL_TITLE_SOURCES } from "../source/titles/manifest.mts";

import { requireRecord, requireString, requireFiniteNumber } from '../../tools/sources/source-values.mts';
const projectRoot = resolve(import.meta.dirname, "../..");

test("generates all shared title assets once from checked source vectors", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-shell-titles-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const publicRoot = resolve(root, "public");
  const moduleOutput = resolve(root, "prepared-shell-titles.mjs");
  const result = await prepareShellTitles({
    sourceRoot: resolve(projectRoot, "site/source/titles"),
    publicRoot,
    moduleOutput,
  });
  assert.equal(
    result.moduleSource,
    await readFile(resolve(projectRoot, "site/prepared-shell-titles.mjs"), "utf8"),
  );
  assert.deepEqual(Object.keys(result.prepared), Object.keys(PREPARED_SHELL_TITLES));
  for (const descriptor of SHELL_TITLE_SOURCES.titles) {
    const source = await readFile(resolve(
      projectRoot,
      "site/source/titles",
      descriptor.file,
    ));
    assert.deepEqual(await readFile(resolve(publicRoot, descriptor.file)), source);
    const prepared = requireRecord(Reflect.get(PREPARED_SHELL_TITLES, descriptor.key), 'prepared shell title');
    assert.equal(prepared.fontSize, 17);
  }
});

test("keeps planet title rendering facts object-owned and source-bound", async () => {
  for (const { id } of SCENE_OBJECTS) {
    const loaded = await loadObjectContent(id);
    const { schema, ...source } = await loaded.source("title");
    const expected = { ...source, ...requireRecord(Reflect.apply(createPreparedTitleLayout, undefined, [source]), 'validated title layout') };
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(requireRecord(loaded.prepared.title, 'prepared title')[field], value, id + ": source-bound title " + field);
    }
  }
  const panel = await readFile(new URL("../components/PreparedObjectPanel.astro", import.meta.url), "utf8");
  assert.doesNotMatch(panel, /createPreparedTitleLayout/u);
});

test("normalizes every implemented planet title to the complete Saturn standard", async () => {
  for (const { id } of SCENE_OBJECTS) {
    const { prepared: content } = await loadObjectContent(id);
    const prepared = requireRecord(content.title, 'prepared title');
    assert.ok(prepared, `${id}: prepared title is missing`);
    for (const field of [
      "weight",
      "opticalSize",
      "fontSize",
      "letterSpacing",
      "baseline",
      "xOrigin",
      "sourceGenerator",
    ] as const) {
      assert.equal(prepared[field], PLANET_TITLE_RECIPE[field],
        `${id}: ${field} must match the Saturn recipe`);
    }
    assert.equal(prepared.height, PLANET_TITLE_RECIPE.viewBoxHeight,
      `${id}: line-box height must match the Saturn recipe`);
    const [, , viewBoxWidth, viewBoxHeight] = requireString(prepared.renderViewBox, 'render view box')
      .split(" ")
      .map(Number);
    const scale =
      PLANET_TITLE_STANDARD.renderedWidth /
      PLANET_TITLE_STANDARD.sourceViewBoxWidth;
    assert.equal(prepared.renderWidth, Number((viewBoxWidth * scale).toFixed(4)),
      `${id}: width must use the Saturn scale`);
    assert.equal(prepared.renderHeight, Number((viewBoxHeight * scale).toFixed(4)),
      `${id}: height must use the Saturn scale`);
    assert.equal(requireFiniteNumber(prepared.baseline, 'title baseline') + requireFiniteNumber(prepared.renderPathOffsetY, 'title path offset'),
      PLANET_TITLE_STANDARD.baseline,
      `${id}: baseline must match Saturn`);
  }
});
