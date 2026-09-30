// Where a catalogue point bank lives. A recipe's `published: true` says the app fetches the bank: it goes to the object's
// `prepared/` and its inventory, and must fit what the app draws. Every other bank is a bake input for a later merge or
// stack and stays in the repository's ignored `output/`, out of the inventory, R2 and the site's module graph.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { CATALOGUE_POINTS_SCHEMA, MAX_CATALOGUE_POINTS, cataloguePointSpread } from '@cssearth/objects';
import { inventoryPreparedAssets } from '@cssearth/objects/node';

/** A bake input: `output/catalogue-points/<object>/<id>.json` under the repository root. */
export function catalogueBankInputPath(objectDirectory: string, id: string, repositoryRoot = resolve(objectDirectory, '../../..')): string {
  return resolve(repositoryRoot, 'output/catalogue-points', basename(objectDirectory), `${id}.json`);
}

/** A published bank: `prepared/<id>.json` beside the object. */
export function publishedCatalogueBankPath(objectDirectory: string, id: string): string {
  return resolve(objectDirectory, 'prepared', `${id}.json`);
}

/** A bank an earlier recipe wrote: the bake input first, else the published bank (a published bank can feed a merge). */
export async function readCatalogueBank(objectDirectory: string, id: string, repositoryRoot?: string): Promise<unknown> {
  const paths = [catalogueBankInputPath(objectDirectory, id, repositoryRoot), publishedCatalogueBankPath(objectDirectory, id)];
  for (const path of paths) {
    const text = await readFile(path, 'utf8').catch((error: unknown) => {
      if ((error as { code?: unknown }).code === 'ENOENT') return null;
      throw error;
    });
    if (text !== null) return JSON.parse(text) as unknown;
  }
  throw new Error(`${basename(objectDirectory)}: catalogue bank ${id} has not been prepared (looked for ${paths.join(' and ')}); run its recipe first.`);
}

/** Write a bank where its recipe says it belongs. A published bank is inventoried, never exceeds MAX_CATALOGUE_POINTS and
 * carries its `spread` (the shape its points trace, which the app reads instead of deriving it on every mount). */
export async function writeCatalogueBank({ objectDirectory, id, bank, published, repositoryRoot, inventory = inventoryPreparedAssets }: {
  objectDirectory: string; id: string; bank: { readonly schema: unknown; readonly points: readonly unknown[] }; published: boolean;
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
  await writeFile(path, JSON.stringify(published ? { ...bank, spread: cataloguePointSpread(pointRows(objectId, id, bank.points)) } : bank) + '\n');
  if (published) await inventory({ objectId, objectDirectory });
  return path;
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
