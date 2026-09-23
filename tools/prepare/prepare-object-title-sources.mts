#!/usr/bin/env node
import { sha256 } from '../../src/platform/sha256.mts';
import {requireRecord,requireString,hasErrorCode} from '../sources/source-values.mts';

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as fontkit from "fontkit";

import { SCENE_OBJECTS } from "../../site/objects.mts";
import { authoredObject } from "../sources/authored-object.mts";
import { OBJECT_TITLE_RECIPE } from
  "../../src/platform/object-title-recipe.mts";

type ObjectTitleSource = ReturnType<typeof createObjectTitleSource>;
type TitleObject = {id: string; name: string};

const projectRoot = resolve(import.meta.dirname, "../..");

export async function prepareObjectTitleSources({
  fontPath = resolve(projectRoot, OBJECT_TITLE_RECIPE.checkedFontPath),
  writeSource = async (planet: TitleObject, moduleSource: string, source: ObjectTitleSource) => {
    const authored = await authoredObject(planet.id, projectRoot);
    const extension = authored ? "json" : "mjs";
    const destination = resolve(
      projectRoot,
      `src/objects/${planet.id}/source/presentation/title-mark.${extension}`,
    );
    await writeFile(destination, authored
      ? `${JSON.stringify({ schema: "cssearth-title-source@1", ...source }, null, 2)}\n`
      : moduleSource);
  },
  ids,
}: {fontPath?: string; writeSource?: (planet: TitleObject, moduleSource: string, source: ObjectTitleSource) => Promise<void>; ids?: readonly string[]} = {}) {
  const fontBytes = await readFile(fontPath);

  const baseFont = fontkit.openSync(fontPath);
  if (!("getVariation" in baseFont)) throw new TypeError("The pinned title font must be one font face.");
  const font = baseFont.getVariation({
    wght: OBJECT_TITLE_RECIPE.weight,
    opsz: OBJECT_TITLE_RECIPE.opticalSize,
  });
  const prepared: Record<string, {source: ObjectTitleSource; moduleSource: string}> = {};
  if (ids && ids.some(id => !SCENE_OBJECTS.some(planet => planet.id === id))) throw new TypeError(`Unknown title object: ${ids.join(', ')}.`);
  for (const planet of SCENE_OBJECTS) {
    if (ids && !ids.includes(planet.id)) continue;
    let label = planet.name;
    try {
      const content = requireRecord(JSON.parse(await readFile(resolve(projectRoot, `src/objects/${planet.id}/source/content/object.json`), 'utf8')));
      label = requireString(content.displayName, `${planet.id} display name`);
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) throw error;
    }
    const source = createObjectTitleSource(label, font);
    const exportName = `${planet.id.replaceAll('-', '_').toUpperCase()}_TITLE_SOURCE`;
    const moduleSource = serializeObjectTitleSource(exportName, source);
    await writeSource(planet, moduleSource, source);
    prepared[planet.id] = Object.freeze({ source, moduleSource });
  }
  return Object.freeze(prepared);
}

export function createObjectTitleSource(label: string, font: Pick<fontkit.Font, "layout" | "unitsPerEm">) {
  if (!font || typeof font.layout !== "function") {
    throw new TypeError("Planet title generation requires a loaded font.");
  }
  if (typeof label !== "string" || !/^[\p{L}\p{N}]+(?:\.?[ /–-][\p{L}\p{N}]+)*$/u.test(label)) {
    throw new TypeError("Planet title label is invalid.");
  }

  const scale = OBJECT_TITLE_RECIPE.fontSize / font.unitsPerEm;
  const run = font.layout(label);
  if (run.glyphs.some(glyph => glyph.id === 0)) {
    throw new Error(`Planet title ${label} contains a character missing from the title font.`);
  }
  const paths = [];
  let penX = 0;
  let penY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [index, glyph] of run.glyphs.entries()) {
    const position = run.positions[index];
    const path = glyph.path
      .scale(scale, -scale)
      .translate(
        penX + position.xOffset * scale,
        OBJECT_TITLE_RECIPE.baseline - penY - position.yOffset * scale,
      );
    const box = path.bbox;
    minX = Math.min(minX, box.minX);
    minY = Math.min(minY, box.minY);
    maxX = Math.max(maxX, box.maxX);
    maxY = Math.max(maxY, box.maxY);
    paths.push(path);
    penX += position.xAdvance * scale;
    penY += position.yAdvance * scale;
    if (index < run.glyphs.length - 1) {
      penX += OBJECT_TITLE_RECIPE.letterSpacing;
    }
  }

  if (!Number.isFinite(minX) || minY < 0 ||
      maxY > OBJECT_TITLE_RECIPE.viewBoxHeight) {
    throw new Error(`Planet title ${label} exceeds the shared title line box.`);
  }

  const width = stableNumber(maxX - minX);
  const path = paths
    .map((glyphPath) => glyphPath.translate(-minX, 0).toSVG())
    .join("");
  return Object.freeze({
    label,
    viewBox: `0 0 ${width} ${OBJECT_TITLE_RECIPE.viewBoxHeight}`,
    width,
    height: OBJECT_TITLE_RECIPE.viewBoxHeight,
    path,
    source: OBJECT_TITLE_RECIPE.source,
    sourceUrl: OBJECT_TITLE_RECIPE.sourceUrl,
    weight: OBJECT_TITLE_RECIPE.weight,
    opticalSize: OBJECT_TITLE_RECIPE.opticalSize,
    fontSize: OBJECT_TITLE_RECIPE.fontSize,
    letterSpacing: OBJECT_TITLE_RECIPE.letterSpacing,
    baseline: OBJECT_TITLE_RECIPE.baseline,
    xOrigin: OBJECT_TITLE_RECIPE.xOrigin,
    sourceGenerator: OBJECT_TITLE_RECIPE.sourceGenerator,
  });
}

export function serializeObjectTitleSource(exportName: string, source: ObjectTitleSource) {
  if (!/^[A-Z][A-Z0-9_]*$/u.test(exportName ?? "")) {
    throw new TypeError("Planet title source export name is invalid.");
  }
  return [
    "// Generated from the pinned Inter font. Do not edit this file directly.",
    `export const ${exportName} = Object.freeze(${JSON.stringify(source)});`,
    "",
  ].join("\n");
}

function stableNumber(value: number) {
  return Number(value.toFixed(4));
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2);
  await prepareObjectTitleSources(ids.length ? { ids } : {});
}
