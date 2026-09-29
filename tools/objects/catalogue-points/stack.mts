/**
 * Stack nested merged levels (merge.mts, each naming the levels it lies `within`) into one bank the app draws as a
 * growing prefix, so zooming in adds dots one at a time and never takes one away. `source/<id>/stack.json` lists the
 * levels from the outermost in: the first with `fullDetailUnits` (the camera distance within which it is drawn whole;
 * farther, a share that falls with distance), each next one with `appearUnits: [from, to]`, the half-width of the view
 * at the bank's origin over which its dots appear, the first at `from` and the last at `to`, evenly in the logarithm of
 * the half-width. A level starts where its region covers the view, so its edge is never on screen while it fills in,
 * and its dots are in merge.mts's fixed shuffle, so they appear across the region at once. Writes `prepared/<id>.json`.
 *
 * Usage: node tools/objects/catalogue-points/stack.mts <object-directory> <id>
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseDensityVolumeFrame } from '@cssearth/objects';

const [objectArgument, id] = process.argv.slice(2);
if (!objectArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: stack.mts <object-directory> <id>');
const objectDirectory = resolve(objectArgument), prepared = resolve(objectDirectory, 'prepared');
const recipePath = resolve(objectDirectory, 'source', id, 'stack.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as { schema?: unknown; id?: unknown; meaning?: unknown; basis?: unknown;
  levels?: { bank?: unknown; fullDetailUnits?: unknown; appearUnits?: unknown }[] };
const fail = (message: string): never => { throw new TypeError(`${recipePath}: ${message}`); };
if (recipe.schema !== 'cssearth-catalogue-points-stack@1' || recipe.id !== id || typeof recipe.meaning !== 'string' || typeof recipe.basis !== 'string') {
  fail(`needs schema cssearth-catalogue-points-stack@1, id ${id}, its meaning and the basis of its windows.`);
}
const levels = recipe.levels;
if (!Array.isArray(levels) || levels.length < 2) fail('stacks two or more levels.');
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

const palette: string[] = [], points: number[][] = [], counts: number[] = [];
let frame: unknown = null, metersPerUnit = 0;
for (const [index, level] of levels!.entries()) {
  const bank = JSON.parse(await readFile(resolve(prepared, `${String(level.bank)}.json`), 'utf8')) as { schema?: unknown; source?: unknown; frame?: unknown;
    within?: unknown; appearance?: { palette?: unknown }; points?: unknown };
  const parsed = parseDensityVolumeFrame(bank.frame);
  if (bank.schema !== 'cssearth-catalogue-points@1' || bank.source !== 'merge' || !Array.isArray(bank.points) || !Array.isArray(bank.appearance?.palette)) {
    fail(`${String(level.bank)} is not a merged level.`);
  }
  // Each inner level names every level outside it, so no dot is drawn twice.
  const outside = levels!.slice(0, index).map(entry => entry.bank);
  if (JSON.stringify(bank.within ?? []) !== JSON.stringify(outside)) fail(`${String(level.bank)} must be merged within ${JSON.stringify(outside)}.`);
  if (frame === null) { frame = bank.frame; metersPerUnit = parsed.metersPerUnit; }
  else if (parsed.metersPerUnit !== metersPerUnit || parsed.originM.some(value => value !== 0)) fail(`${String(level.bank)} is not in the first level's frame and unit.`);
  const levelPalette = bank.appearance!.palette as string[];
  for (const point of bank.points as number[][]) {
    const colour = levelPalette[point[3]!];
    if (typeof colour !== 'string') fail(`${String(level.bank)} names a colour its palette lacks.`);
    let entry = palette.indexOf(colour!);
    if (entry < 0) entry = palette.push(colour!) - 1;
    points.push([point[0]!, point[1]!, point[2]!, entry]);
  }
  counts.push((bank.points as unknown[]).length);
}
const output = { schema: 'cssearth-catalogue-points@1', id, source: 'stack', meaning: recipe.meaning, frame,
  appearance: { colorCss: '#ffffff', radiusPx: 0.75, opacity: 1, palette,
    levels: levels!.map((level, index) => ({ bank: level.bank, points: counts[index],
      ...(index === 0 ? { fullDetailUnits: level.fullDetailUnits } : { appearUnits: level.appearUnits }) })) },
  basis: recipe.basis, counts: { points: points.length }, points };
await writeFile(resolve(prepared, `${id}.json`), JSON.stringify(output) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Stacked ${points.length} dots in ${levels!.length} levels: ${counts.join(', ')}.`);
