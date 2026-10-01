/**
 * Stack nested merged levels (or one level, for a bank thinned only by the camera's distance) (merge-catalogue-points.mts, each naming the levels it lies `within`) into one bank the app draws as a
 * growing prefix, so zooming in adds dots one at a time and never takes one away. `source/<id>/stack.json` lists the
 * levels from the outermost in: the first with `fullDetailUnits` (the camera distance within which it is drawn whole;
 * farther, a share that falls with distance), each next one with `appearUnits: [from, to]`, the half-width of the view
 * at the bank's origin over which its dots appear, the first at `from` and the last at `to`, evenly in the logarithm of
 * the half-width. A level starts where its region covers the view, so its edge is never on screen while it fills in,
 * and its dots are in merge-catalogue-points.mts's fixed shuffle, so they appear across the region at once. The stacked bank
 * is what the app fetches, so its recipe says `published: true` and it is written to `prepared/<id>.json` and inventoried.
 *
 * Usage: node packages/bake/cli/stack-catalogue-points.mts <object-directory> <id>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { readCatalogueBank, recipePublished, writeCatalogueBank } from '@cssearth/bake/volume/node';

const [objectArgument, id] = process.argv.slice(2);
if (!objectArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: stack-catalogue-points.mts <object-directory> <id>');
const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared');
const recipePath = resolve(objectDirectory, 'source', id, 'stack.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as { schema?: unknown; id?: unknown; meaning?: unknown; basis?: unknown; screenBudget?: unknown; fadeOutUnits?: unknown;
  outsidePixelsPerDot?: unknown; levels?: { bank?: unknown; fullDetailUnits?: unknown; appearUnits?: unknown; nearOpacity?: unknown; screenBudget?: unknown }[] };
const fail = (message: string): never => { throw new TypeError(`${recipePath}: ${message}`); };
if (recipe.schema !== 'cssearth-catalogue-points-stack@1' || recipe.id !== id || typeof recipe.meaning !== 'string' || typeof recipe.basis !== 'string') {
  fail(`needs schema cssearth-catalogue-points-stack@1, id ${id}, its meaning and the basis of its windows.`);
}
const levels = recipe.levels;
if (!Array.isArray(levels) || levels.length < 1) fail('stacks one or more levels.');
const [outer, ...inner] = levels!;
if (typeof outer!.bank !== 'string' || !(typeof outer!.fullDetailUnits === 'number' && outer!.fullDetailUnits > 0) || outer!.appearUnits !== undefined) {
  fail('the first level is { bank, fullDetailUnits }.');
}
let previousTo = outer!.fullDetailUnits as number;
for (const level of inner) {
  const window = level.appearUnits;
  if (typeof level.bank !== 'string' || level.fullDetailUnits !== undefined || !Array.isArray(window) || window.length !== 2 ||
      !(window[0] > window[1] && window[1] > 0) || window[0] > previousTo) {
    fail(`${String(level.bank)}: an inner level is { bank, appearUnits: [from, to] }, from above to, starting no farther out than the level before it is whole.`);
  }
  previousTo = (window as number[])[1]!;
}

// A level may dim to `nearOpacity` as the innermost level fills the view (catalogue-points.ts).
for (const level of levels!) if (level.nearOpacity !== undefined && !(typeof level.nearOpacity === 'number' && level.nearOpacity > 0 && level.nearOpacity <= 1)) {
  fail(`${String(level.bank)}: nearOpacity must be in (0, 1], got ${JSON.stringify(level.nearOpacity)}.`);
}
if (recipe.screenBudget !== undefined && !(Number.isSafeInteger(recipe.screenBudget) && (recipe.screenBudget as number) > 0)) {
  fail(`screenBudget must be a positive whole number, got ${JSON.stringify(recipe.screenBudget)}.`);
}
// The whole bank may fade out as the view narrows at its origin (catalogue-points.ts): [from, to], from above to above 0.
const fadeOut = recipe.fadeOutUnits, outsidePixelsPerDot = recipe.outsidePixelsPerDot;
if (outsidePixelsPerDot !== undefined && !(typeof outsidePixelsPerDot === 'number' && outsidePixelsPerDot > 0 && Number.isFinite(outsidePixelsPerDot))) {
  fail(`outsidePixelsPerDot is a positive number of square pixels, got ${JSON.stringify(outsidePixelsPerDot)}.`);
}
if (fadeOut !== undefined && !(Array.isArray(fadeOut) && fadeOut.length === 2 && fadeOut.every(value => typeof value === 'number') && fadeOut[0] > fadeOut[1] && fadeOut[1] > 0)) {
  fail(`fadeOutUnits is [from, to], from above to above 0, got ${JSON.stringify(fadeOut)}.`);
}
// An inner level may raise or lower the bank's budget: it moves to the level's as the level appears (catalogue-points.ts).
for (const [index, level] of levels!.entries()) if (level.screenBudget !== undefined && (index === 0 || recipe.screenBudget === undefined
  || !(Number.isSafeInteger(level.screenBudget) && (level.screenBudget as number) > 0))) {
  fail(`${String(level.bank)}: a level's screenBudget is a positive whole number on an inner level of a bank with a screenBudget, got ${JSON.stringify(level.screenBudget)}.`);
}
const palette: string[] = [], points: number[][] = [], counts: number[] = [];
// Each level's dots, read first: a palette entry is a colour, or once any level sizes its dots a (colour, radius) pair.
const levelEntries: { position: number[]; colour: string; radius: number }[][] = [];
let sized = false;
let frame: unknown = null, metersPerUnit = 0;
for (const [index, level] of levels!.entries()) {
  const bank = await readCatalogueBank(objectDirectory, String(level.bank)) as { schema?: unknown; source?: unknown; frame?: unknown;
    within?: unknown; appearance?: { palette?: unknown; paletteRadiusPx?: unknown; radiusPx?: unknown }; points?: unknown };
  const parsed = parseDensityVolumeFrame(bank.frame);
  if (bank.schema !== 'cssearth-catalogue-points@1' || bank.source !== 'merge' || !Array.isArray(bank.points) || !Array.isArray(bank.appearance?.palette)) {
    fail(`${String(level.bank)} is not a merged level.`);
  }
  // Each inner level names every level outside it, so no dot is drawn twice.
  const outside = levels!.slice(0, index).map(entry => entry.bank);
  if (JSON.stringify(bank.within ?? []) !== JSON.stringify(outside)) fail(`${String(level.bank)} must be merged within ${JSON.stringify(outside)}.`);
  if (frame === null) { frame = bank.frame; metersPerUnit = parsed.metersPerUnit; }
  else if (parsed.metersPerUnit !== metersPerUnit || parsed.originM.some(value => value !== 0)) fail(`${String(level.bank)} is not in the first level's frame and unit.`);
  const levelPalette = bank.appearance!.palette as string[], levelRadii = bank.appearance!.paletteRadiusPx;
  if (levelRadii !== undefined && (!Array.isArray(levelRadii) || levelRadii.length !== levelPalette.length || !levelRadii.every(value => typeof value === 'number' && value > 0))) {
    fail(`${String(level.bank)}: paletteRadiusPx holds one positive radius per palette colour.`);
  }
  levelEntries.push((bank.points as number[][]).map(point => {
    const colour = levelPalette[point[3]!];
    if (typeof colour !== 'string') fail(`${String(level.bank)} names a colour its palette lacks.`);
    const radius = levelRadii ? (levelRadii as number[])[point[3]!]! : typeof bank.appearance!.radiusPx === 'number' ? bank.appearance!.radiusPx : 0.75;
    if (levelRadii) sized = true;
    return { position: [point[0]!, point[1]!, point[2]!], colour: colour!, radius };
  }));
  counts.push((bank.points as unknown[]).length);
}
const keys: string[] = [], paletteRadiusPx: number[] = [];
for (const entries of levelEntries) for (const { position, colour, radius } of entries) {
  const key = sized ? `${colour}|${radius}` : colour;
  let entry = keys.indexOf(key);
  if (entry < 0) { entry = keys.push(key) - 1; palette.push(colour); paletteRadiusPx.push(radius); }
  points.push([...position, entry]);
}
const output = { schema: 'cssearth-catalogue-points@1', id, source: 'stack', meaning: recipe.meaning, frame,
  appearance: { colorCss: '#ffffff', radiusPx: 0.75, opacity: 1, palette, ...(sized ? { paletteRadiusPx } : {}),
    levels: levels!.map((level, index) => ({ bank: level.bank, points: counts[index],
      ...(index === 0 ? { fullDetailUnits: level.fullDetailUnits } : { appearUnits: level.appearUnits }),
      ...(level.nearOpacity === undefined ? {} : { nearOpacity: level.nearOpacity }),
      ...(level.screenBudget === undefined ? {} : { screenBudget: level.screenBudget }) })),
    ...(recipe.screenBudget === undefined ? {} : { screenBudget: recipe.screenBudget }),
    ...(fadeOut === undefined ? {} : { fadeOutUnits: fadeOut }),
    ...(outsidePixelsPerDot === undefined ? {} : { outsidePixelsPerDot }) },
  basis: recipe.basis, counts: { points: points.length }, points };
await writeCatalogueBank({ objectDirectory, id, bank: output, published: recipePublished(recipe, recipePath) });
console.log(`Stacked ${points.length} dots in ${levels!.length} levels: ${counts.join(', ')}.`);
