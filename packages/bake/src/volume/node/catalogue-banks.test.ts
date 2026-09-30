import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { MAX_CATALOGUE_POINTS, catalogueCells, cataloguePointSpread } from '@cssearth/objects';
import { readCatalogueBank, recipePublished, writeCatalogueBank } from './catalogue-banks.ts';

const bank = (points: number) => ({ schema: 'cssearth-catalogue-points@1', id: 'x', points: Array.from({ length: points }, (_, i) => [i, 0, 0]) });

test('a bake input goes to output/, a published bank to prepared/ with its inventory', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-banks-')), objectDirectory = resolve(root, 'src/objects/galaxy');
  const inventoried: string[] = [];
  const inventory = async ({ objectId }: { objectId: string }) => { inventoried.push(objectId); };
  assert.equal((await writeCatalogueBank({ objectDirectory, id: 'raw', bank: bank(3), published: false, repositoryRoot: root, inventory })), resolve(root, 'output/catalogue-points/galaxy/raw.json'));
  await mkdir(resolve(objectDirectory, 'prepared'), { recursive: true });
  await writeFile(resolve(objectDirectory, 'prepared/dots.json'), '{}');
  assert.equal((await writeCatalogueBank({ objectDirectory, id: 'dots', bank: bank(2), published: true, repositoryRoot: root, inventory })), resolve(objectDirectory, 'prepared/dots.bin'));
  assert.deepEqual(inventoried, ['galaxy']);
  assert.equal(existsSync(resolve(objectDirectory, 'prepared/dots.json')), false, 'the JSON form the bank replaced is removed');
  const raw = await readCatalogueBank(objectDirectory, 'raw', root) as { points: unknown[]; spread?: unknown; cells?: unknown };
  const dots = await readCatalogueBank(objectDirectory, 'dots', root) as { points: number[][]; spread?: unknown; cells?: unknown };
  assert.equal(raw.points.length, 3);
  assert.equal(raw.spread, undefined, 'a bake input is not drawn, so it carries no spread');
  assert.equal(dots.points.length, 2);
  assert.deepEqual(dots.spread, cataloguePointSpread(dots.points), 'a published bank carries the spread its points trace');
  assert.equal(raw.cells, undefined, 'nor cells');
  assert.deepEqual(dots.cells, catalogueCells(dots.points), 'a published bank carries its cells');
  await assert.rejects(readCatalogueBank(objectDirectory, 'missing', root), /galaxy: catalogue bank missing has not been prepared/u);
  await rm(root, { recursive: true, force: true });
});

test('a published bank never exceeds what the app draws', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-banks-')), objectDirectory = resolve(root, 'src/objects/galaxy');
  await assert.rejects(writeCatalogueBank({ objectDirectory, id: 'stars', bank: bank(MAX_CATALOGUE_POINTS + 1), published: true, repositoryRoot: root, inventory: async () => {} }), /galaxy: bank stars holds 40001 points and the app draws at most 40000/u);
  await assert.rejects(writeCatalogueBank({ objectDirectory, id: 'stars', bank: { schema: 'cssearth-catalogue-points@1', points: [[0, 0]] }, published: true, repositoryRoot: root, inventory: async () => {} }), /galaxy: bank stars point 0 must be finite numbers starting with x, y, z, got \[0,0\]/u);
  assert.equal(recipePublished({}, 'recipe'), false);
  assert.equal(recipePublished({ published: true }, 'recipe'), true);
  assert.throws(() => recipePublished({ published: 'yes' }, 'recipe'), /recipe: published must be true or false/u);
  await rm(root, { recursive: true, force: true });
});
