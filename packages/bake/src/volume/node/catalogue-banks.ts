// Where a catalogue point bank lives. A recipe's `published: true` says the app fetches the bank: it goes to the object's
// `prepared/` as a packed binary (`<id>.bin`, @cssearth/renderer prepared-data/catalogue-bank-binary.ts) and its inventory, and must fit
// what the app draws. Every other bank is a bake input for a later merge or
// stack and stays in the repository's ignored `output/`, out of the inventory, R2 and the site's module graph.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { CATALOGUE_POINTS_SCHEMA, MAX_CATALOGUE_POINTS, catalogueCells, cataloguePointSpread } from '@cssearth/objects';
import { decodeCatalogueBankBinary, encodeCatalogueBankBinary } from '@cssearth/renderer/prepared-data/catalogue-bank-binary.ts';
import { inventoryPreparedAssets, packPreparedBinary, unpackPreparedBinary } from '@cssearth/objects/node';

/** A bake input: `output/catalogue-points/<object>/<id>.json` under the repository root. */
export function catalogueBankInputPath(objectDirectory: string, id: string, repositoryRoot = resolve(objectDirectory, '../../..')): string {
  return resolve(repositoryRoot, 'output/catalogue-points', basename(objectDirectory), `${id}.json`);
}

/** A published bank: `prepared/<id>.bin` beside the object. */
export function publishedCatalogueBankPath(objectDirectory: string, id: string): string {
  return resolve(objectDirectory, 'prepared', `${id}.bin`);
}

/** A bank an earlier recipe wrote: the bake input first, else the published bank (a published bank can feed a merge). */
export async function readCatalogueBank(objectDirectory: string, id: string, repositoryRoot?: string): Promise<unknown> {
  const paths = [catalogueBankInputPath(objectDirectory, id, repositoryRoot), publishedCatalogueBankPath(objectDirectory, id)];
  for (const path of paths) {
    const bytes = await readFile(path).catch((error: unknown) => {
      if ((error as { code?: unknown }).code === 'ENOENT') return null;
      throw error;
    });
    if (bytes === null) continue;
    return path.endsWith('.bin') ? decodeCatalogueBankBinary(unpackPreparedBinary(bytes, path), path) : JSON.parse(bytes.toString('utf8')) as unknown;
  }
  throw new Error(`${basename(objectDirectory)}: catalogue bank ${id} has not been prepared (looked for ${paths.join(' and ')}); run its recipe first.`);
}

/** Write a bank where its recipe says it belongs. A published bank is inventoried, never exceeds MAX_CATALOGUE_POINTS and
 * carries its `spread` (the shape its points trace, which the app reads instead of deriving it on every mount) and its
 * `cells` (boxes of nearby points the app skips whole when they are out of view, each within one level). */
export async function writeCatalogueBank({ objectDirectory, id, bank, published, repositoryRoot, inventory = inventoryPreparedAssets }: {
  objectDirectory: string; id: string; published: boolean;
  bank: { readonly schema: unknown; readonly points: readonly unknown[]; readonly appearance?: unknown };
  repositoryRoot?: string; inventory?: (object: { objectId: string; objectDirectory: string }) => Promise<unknown>;
}): Promise<string> {
  const objectId = basename(objectDirectory);
  if (bank.schema !== CATALOGUE_POINTS_SCHEMA) throw new TypeError(`${objectId}: bank ${id} has schema ${String(bank.schema)}, not ${CATALOGUE_POINTS_SCHEMA}.`);
  if (published && bank.points.length > MAX_CATALOGUE_POINTS) {
    throw new RangeError(`${objectId}: bank ${id} holds ${bank.points.length} points and the app draws at most ${MAX_CATALOGUE_POINTS} ` +
      '(MAX_CATALOGUE_POINTS). Merge or stack it into the published bank, and leave published out of this recipe.');
  }
  const path = published ? publishedCatalogueBankPath(objectDirectory, id) : catalogueBankInputPath(objectDirectory, id, repositoryRoot);
  await mkdir(dirname(path), { recursive: true });
  const rows = published ? pointRows(objectId, id, bank.points) : [];
  const levels = published ? levelPoints(objectId, id, bank.appearance) : undefined;
  if (published) {
    const { bytes, regions } = encodeCatalogueBankBinary({ ...bank, spread: cataloguePointSpread(rows), cells: catalogueCells(rows, levels) }, `${objectId}: bank ${id}`);
    await writeFile(path, packPreparedBinary(bytes, regions, `${objectId}: bank ${id}`));
    // The same bank's JSON form, which the `.bin` replaced, must not stay beside it: the inventory counts every baked file.
    await rm(resolve(dirname(path), `${id}.json`), { force: true });
  } else await writeFile(path, JSON.stringify(bank) + '\n');
  if (published) await inventory({ objectId, objectDirectory });
  return path;
}

/** A stacked bank's level sizes in order (`appearance.levels[].points`), or undefined for a bank without levels. */
function levelPoints(objectId: string, id: string, appearance: unknown): number[] | undefined {
  const levels = appearance && typeof appearance === 'object' ? (appearance as { levels?: unknown }).levels : undefined;
  if (levels === undefined) return undefined;
  if (!Array.isArray(levels)) throw new TypeError(`${objectId}: bank ${id} appearance.levels must be a list, got ${JSON.stringify(levels)}.`);
  return levels.map((level: unknown, index) => {
    const points = level && typeof level === 'object' ? (level as { points?: unknown }).points : undefined;
    if (!Number.isSafeInteger(points) || (points as number) < 1) throw new TypeError(`${objectId}: bank ${id} level ${index} needs a positive whole points count, got ${JSON.stringify(points)}.`);
    return points as number;
  });
}

function pointRows(objectId: string, id: string, points: readonly unknown[]): readonly (readonly number[])[] {
  return points.map((point, index) => {
    if (!Array.isArray(point) || point.length < 3 || !point.every(value => typeof value === 'number' && Number.isFinite(value))) {
      throw new TypeError(`${objectId}: bank ${id} point ${index} must be finite numbers starting with x, y, z, got ${JSON.stringify(point)}.`);
    }
    return point as readonly number[];
  });
}

/** `published` in a points, merge or stack recipe: true for a bank the app fetches, absent or false for a bake input. */
export function recipePublished(recipe: Record<string, unknown>, recipePath: string): boolean {
  if (recipe.published !== undefined && typeof recipe.published !== 'boolean') {
    throw new TypeError(`${recipePath}: published must be true or false, not ${JSON.stringify(recipe.published)}.`);
  }
  return recipe.published === true;
}
