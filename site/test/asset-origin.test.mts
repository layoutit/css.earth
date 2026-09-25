import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { assetHashSplit, assetShaMap } from '../asset-origin.mts';

test('an object without inventory.json has an empty asset map', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asset-origin-'));
  await mkdir(join(root, 'src/objects/shell-only'), { recursive: true });
  assert.deepEqual(await assetShaMap('shell-only', root), {});
});

test('an unreadable inventory.json still fails the build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asset-origin-'));
  await mkdir(join(root, 'src/objects/broken'), { recursive: true });
  await writeFile(join(root, 'src/objects/broken/inventory.json'), '{not json');
  await assert.rejects(assetShaMap('broken', root));
});

test('an inventory cached in one root cannot be reused for another root', async () => {
  const emptyRoot = await mkdtemp(join(tmpdir(), 'asset-origin-empty-'));
  const brokenRoot = await mkdtemp(join(tmpdir(), 'asset-origin-broken-'));
  await mkdir(join(brokenRoot, 'src/objects/shared'), { recursive: true });
  await writeFile(join(brokenRoot, 'src/objects/shared/inventory.json'), '{not json');
  assert.deepEqual(await assetShaMap('shared', emptyRoot), {});
  await assert.rejects(assetShaMap('shared', brokenRoot), SyntaxError);
});

test('a page embeds the hashes its first view reads and groups the rest by demand', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asset-origin-split-'));
  const hash = (letter: string) => letter.repeat(64);
  const files = { 'marker.webp': 'a', 'page-level-256.webp': 'b', 'page-1-level-256.webp': 'c', 'page-level-1024.webp': 'd', 'page-1-level-1024.webp': 'e', 'clouds.webp': 'f' };
  await mkdir(join(root, 'src/objects/globe/prepared'), { recursive: true });
  await writeFile(join(root, 'src/objects/globe/inventory.json'), JSON.stringify({ schema: 'cssearth-inventory@1',
    assets: Object.entries(files).map(([filename, letter]) => ({ location: 'public', filename, bytes: 1, sha256: hash(letter) })) }));
  const entry = (key: string, file: string) => ({ key, url: `/scenes/globe/${file}`, pool: 'pages' });
  const prepared = { data: {
    tree: { nodes: [{ style: 'background-image:url(\\"/scenes/globe/marker.webp\\")' }] },
    assets: { startup: ['page:normal:0:level:512', 'page:normal:1:level:512'], entries: [
      entry('page:normal:0:level:512', 'page-level-256.webp'), entry('page:normal:1:level:512', 'page-1-level-256.webp'),
      entry('page:normal:0:level:2048', 'page-level-1024.webp'), entry('page:normal:1:level:2048', 'page-1-level-1024.webp'),
      entry('lens:clouds', 'clouds.webp')] } } };
  await writeFile(join(root, 'src/objects/globe/prepared/object.json'), JSON.stringify(prepared));
  const split = await assetHashSplit('globe', root);
  assert.deepEqual(split.embedded, { 'marker.webp': hash('a'), 'page-level-256.webp': hash('b'), 'page-1-level-256.webp': hash('c') });
  assert.deepEqual(Object.fromEntries(split.groups), {
    'page:normal:level:2048': { 'page-level-1024.webp': hash('d'), 'page-1-level-1024.webp': hash('e') },
    '': { 'clouds.webp': hash('f') } });
});

test('a resource the inventory does not publish fails the build, naming the object, key and file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asset-origin-unpublished-'));
  await mkdir(join(root, 'src/objects/globe/prepared'), { recursive: true });
  await writeFile(join(root, 'src/objects/globe/inventory.json'), JSON.stringify({ schema: 'cssearth-inventory@1',
    assets: [{ location: 'public', filename: 'other.webp', bytes: 1, sha256: 'a'.repeat(64) }] }));
  await writeFile(join(root, 'src/objects/globe/prepared/object.json'), JSON.stringify({ data: { assets: { startup: [],
    entries: [{ key: 'page:normal:3:level:2048', url: '/scenes/globe/page-3.webp', pool: 'pages' }] } } }));
  await assert.rejects(assetHashSplit('globe', root), /globe: resource page:normal:3:level:2048 names page-3\.webp, which inventory\.json does not publish/);
});
