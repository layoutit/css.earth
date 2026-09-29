import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { MAX_CATALOGUE_POINTS } from '@cssearth/objects';
import { readCatalogueBank, recipePublished, writeCatalogueBank } from './catalogue-banks.ts';

const bank = (points: number) => ({ schema: 'cssearth-catalogue-points@1', id: 'x', points: Array.from({ length: points }, (_, i) => [i, 0, 0]) });

test('a bake input goes to output/, a published bank to prepared/ with its inventory', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-banks-')), objectDirectory = resolve(root, 'src/objects/galaxy');
  const inventoried: string[] = [];
  const inventory = async ({ objectId }: { objectId: string }) => { inventoried.push(objectId); };
  expect(await writeCatalogueBank({ objectDirectory, id: 'raw', bank: bank(3), published: false, repositoryRoot: root, inventory }))
    .toBe(resolve(root, 'output/catalogue-points/galaxy/raw.json'));
  expect(await writeCatalogueBank({ objectDirectory, id: 'dots', bank: bank(2), published: true, repositoryRoot: root, inventory }))
    .toBe(resolve(objectDirectory, 'prepared/dots.json'));
  expect(inventoried).toEqual(['galaxy']);
  expect((await readCatalogueBank(objectDirectory, 'raw', root) as { points: unknown[] }).points).toHaveLength(3);
  expect((await readCatalogueBank(objectDirectory, 'dots', root) as { points: unknown[] }).points).toHaveLength(2);
  await expect(readCatalogueBank(objectDirectory, 'missing', root)).rejects.toThrow(/galaxy: catalogue bank missing has not been prepared/u);
  await rm(root, { recursive: true, force: true });
});

test('a published bank never exceeds what the app draws', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-banks-')), objectDirectory = resolve(root, 'src/objects/galaxy');
  await expect(writeCatalogueBank({ objectDirectory, id: 'stars', bank: bank(MAX_CATALOGUE_POINTS + 1), published: true, repositoryRoot: root, inventory: async () => {} }))
    .rejects.toThrow(/galaxy: bank stars holds 40001 points and the app draws at most 40000/u);
  expect(recipePublished({}, 'recipe')).toBe(false);
  expect(recipePublished({ published: true }, 'recipe')).toBe(true);
  expect(() => recipePublished({ published: 'yes' }, 'recipe')).toThrow(/recipe: published must be true or false/u);
  await rm(root, { recursive: true, force: true });
});
