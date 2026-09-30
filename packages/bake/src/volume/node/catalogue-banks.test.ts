import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { MAX_CATALOGUE_POINTS, catalogueCells, cataloguePointSpread } from '@cssearth/objects';
import { readCatalogueBank, recipePublished, writeCatalogueBank } from './catalogue-banks.ts';

const bank = (points: number) => ({ schema: 'cssearth-catalogue-points@1', id: 'x', points: Array.from({ length: points }, (_, i) => [i, 0, 0]) });

test('a bake input goes to output/, a published bank to prepared/ with its inventory', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-banks-')), objectDirectory = resolve(root, 'src/objects/galaxy');
  const inventoried: string[] = [];
  const inventory = async ({ objectId }: { objectId: string }) => { inventoried.push(objectId); };
  expect(await writeCatalogueBank({ objectDirectory, id: 'raw', bank: bank(3), published: false, repositoryRoot: root, inventory }))
    .toBe(resolve(root, 'output/catalogue-points/galaxy/raw.json'));
  await mkdir(resolve(objectDirectory, 'prepared'), { recursive: true });
  await writeFile(resolve(objectDirectory, 'prepared/dots.json'), '{}');
  expect(await writeCatalogueBank({ objectDirectory, id: 'dots', bank: bank(2), published: true, repositoryRoot: root, inventory }))
    .toBe(resolve(objectDirectory, 'prepared/dots.bin'));
  expect(inventoried).toEqual(['galaxy']);
  expect(existsSync(resolve(objectDirectory, 'prepared/dots.json')), 'the JSON form the bank replaced is removed').toBe(false);
  const raw = await readCatalogueBank(objectDirectory, 'raw', root) as { points: unknown[]; spread?: unknown; cells?: unknown };
  const dots = await readCatalogueBank(objectDirectory, 'dots', root) as { points: number[][]; spread?: unknown; cells?: unknown };
  expect(raw.points).toHaveLength(3);
  expect(raw.spread, 'a bake input is not drawn, so it carries no spread').toBeUndefined();
  expect(dots.points).toHaveLength(2);
  expect(dots.spread, 'a published bank carries the spread its points trace').toEqual(cataloguePointSpread(dots.points));
  expect(raw.cells, 'nor cells').toBeUndefined();
  expect(dots.cells, 'a published bank carries its cells').toEqual(catalogueCells(dots.points));
  await expect(readCatalogueBank(objectDirectory, 'missing', root)).rejects.toThrow(/galaxy: catalogue bank missing has not been prepared/u);
  await rm(root, { recursive: true, force: true });
});

test('a published bank never exceeds what the app draws', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-banks-')), objectDirectory = resolve(root, 'src/objects/galaxy');
  await expect(writeCatalogueBank({ objectDirectory, id: 'stars', bank: bank(MAX_CATALOGUE_POINTS + 1), published: true, repositoryRoot: root, inventory: async () => {} }))
    .rejects.toThrow(/galaxy: bank stars holds 40001 points and the app draws at most 40000/u);
  await expect(writeCatalogueBank({ objectDirectory, id: 'stars', bank: { schema: 'cssearth-catalogue-points@1', points: [[0, 0]] }, published: true, repositoryRoot: root, inventory: async () => {} }))
    .rejects.toThrow(/galaxy: bank stars point 0 must be finite numbers starting with x, y, z, got \[0,0\]/u);
  expect(recipePublished({}, 'recipe')).toBe(false);
  expect(recipePublished({ published: true }, 'recipe')).toBe(true);
  expect(() => recipePublished({ published: 'yes' }, 'recipe')).toThrow(/recipe: published must be true or false/u);
  await rm(root, { recursive: true, force: true });
});
