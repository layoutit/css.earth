#!/usr/bin/env node
/** Write the page's title font: one static WOFF2 instance of the checked Inter variable font, cut to the scripts
 * object names use. The recipe owns the weight, optical size and character ranges; nothing here is object-specific. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OBJECT_TITLE_RECIPE as recipe } from '../../src/platform/object-title-recipe.mts';

type SubsetFont = (font: Buffer, text: string, options: { targetFormat: 'woff2'; variationAxes: Record<string, number> }) => Promise<Buffer>;

function loadSubsetter(): SubsetFont {
  const loaded: unknown = createRequire(import.meta.url)('subset-font');
  if (typeof loaded !== 'function') throw new TypeError('subset-font must export the subsetting function.');
  return async (font, text, options) => {
    const output: unknown = await loaded(font, text, options);
    if (!Buffer.isBuffer(output) || output.length === 0) throw new TypeError(`subset-font returned no font for ${recipe.webFontPath}.`);
    return output;
  };
}

/** Every character the title font keeps, from the recipe's inclusive code point ranges. */
export function titleFontCharacters(): string {
  return recipe.webFontUnicodeRanges.flatMap(([first, last]) =>
    Array.from({ length: last - first + 1 }, (_, index) => String.fromCodePoint(first + index))).join('');
}

export async function prepareTitleFont({ projectRoot = resolve(import.meta.dirname, '../..') } = {}) {
  const source = await readFile(resolve(projectRoot, recipe.checkedFontPath));
  const font = await loadSubsetter()(source, titleFontCharacters(), {
    targetFormat: 'woff2',
    variationAxes: { wght: recipe.weight, opsz: recipe.opticalSize },
  });
  const destination = resolve(projectRoot, recipe.webFontPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, font);
  return { destination, bytes: font.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { destination, bytes } = await prepareTitleFont();
  console.log(`${destination}: ${bytes} bytes`);
}
