import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { PREPARED_MARS_TITLE } from "../../src/planets/mars/site/preparedTitle.mjs";
import { MARS_TITLE_SOURCE } from "../../src/planets/mars/source/presentation/title-mark.mjs";
import { PREPARED_SATURN_TITLE } from "../../src/planets/saturn/site/preparedTitle.mjs";
import { SATURN_TITLE_SOURCE } from "../../src/planets/saturn/source/presentation/title-mark.mjs";
import {
  PLANET_TITLE_STANDARD,
  sha256,
} from "../../src/platform/prepared-title.mjs";
import { PLANET_TITLE_RECIPE } from
  "../../src/platform/planet-title-recipe.mjs";
import { OBJECTS } from "../objects.mjs";
import { prepareShellTitles } from "../../tools/prepare-shell-titles.mjs";
import { PREPARED_SHELL_TITLES } from "../prepared-shell-titles.mjs";
import { SHELL_TITLE_SOURCES } from "../source/titles/manifest.mjs";

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
    assert.equal(PREPARED_SHELL_TITLES[descriptor.key].inputSha256, sha256(source));
    assert.equal(PREPARED_SHELL_TITLES[descriptor.key].sourceSha256,
      SHELL_TITLE_SOURCES.font.sourceSha256);
    assert.equal(PREPARED_SHELL_TITLES[descriptor.key].fontSize, 17);
  }
  const resourcesSource = await readFile(resolve(
    projectRoot,
    "site/source/titles/title-sources-resources.svg",
  ), "utf8");
  assert.match(resourcesSource, /"text":"Sources \\u0026 Resources"/u);
  assert.doesNotMatch(resourcesSource, /"text":"Sources & Resources"/u);
});

test("keeps planet title rendering facts object-owned and source-bound", async () => {
  const pairs = [
    ["mars", MARS_TITLE_SOURCE, PREPARED_MARS_TITLE],
    ["saturn", SATURN_TITLE_SOURCE, PREPARED_SATURN_TITLE],
  ];
  for (const [planet, source, prepared] of pairs) {
    assert.equal(prepared.label, source.label);
    assert.equal(prepared.path, source.path);
    assert.equal(prepared.sourceSha256, source.sourceSha256);
    const bytes = await readFile(resolve(
      projectRoot,
      `src/planets/${planet}/source/presentation/title-mark.mjs`,
    ));
    assert.equal(prepared.inputSha256, sha256(bytes));
    assert.equal(prepared.generator,
      `src/planets/${planet}/tools/prepare-title.mjs`);
  }
  const saturnPanel = await readFile(resolve(
    projectRoot,
    "src/planets/saturn/site/SaturnPanel.astro",
  ), "utf8");
  assert.match(saturnPanel, /PREPARED_SATURN_TITLE/u);
  assert.doesNotMatch(saturnPanel, /const title\s*=|M7\.83 29\.33/u);
});

test("normalizes every implemented planet title to the complete Saturn standard", async () => {
  for (const { id } of OBJECTS) {
    const preparedModule = await import(new URL(
      `../../src/planets/${id}/site/preparedTitle.mjs`,
      import.meta.url,
    ));
    const prepared = Object.values(preparedModule).find(
      (value) => value?.label?.toLowerCase() === id,
    );
    assert.ok(prepared, `${id}: prepared title is missing`);
    for (const field of [
      "weight",
      "opticalSize",
      "fontSize",
      "letterSpacing",
      "baseline",
      "xOrigin",
      "sourceSha256",
      "sourceGenerator",
    ]) {
      assert.equal(prepared[field], PLANET_TITLE_RECIPE[field],
        `${id}: ${field} must match the Saturn recipe`);
    }
    assert.equal(prepared.height, PLANET_TITLE_RECIPE.viewBoxHeight,
      `${id}: line-box height must match the Saturn recipe`);
    const [, , viewBoxWidth, viewBoxHeight] = prepared.renderViewBox
      .split(" ")
      .map(Number);
    const scale =
      PLANET_TITLE_STANDARD.renderedWidth /
      PLANET_TITLE_STANDARD.sourceViewBoxWidth;
    assert.equal(prepared.renderWidth, Number((viewBoxWidth * scale).toFixed(4)),
      `${id}: width must use the Saturn scale`);
    assert.equal(prepared.renderHeight, Number((viewBoxHeight * scale).toFixed(4)),
      `${id}: height must use the Saturn scale`);
    assert.equal(prepared.baseline + prepared.renderPathOffsetY,
      PLANET_TITLE_STANDARD.baseline,
      `${id}: baseline must match Saturn`);
  }
});
