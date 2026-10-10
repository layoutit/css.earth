import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { readRegionList, readRegions, saveRegions } from './regions.ts';

const square = [[0, 0], [10, 0], [10, 10.04]];

test('regions are read back as saved, whole, beside the picture they were drawn on', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'regions-')), source = resolve(root, 'src/objects/thing/source');
  try {
    await mkdir(source, { recursive: true });
    await writeFile(resolve(source, 'recipe.json'), JSON.stringify({ source: { path: 'picture.png', dimensions: [40, 30] } }));
    assert.deepEqual(await readRegions(root, 'thing'), { picture: 'picture.png', width: 40, height: 30, regions: [] });
    await Promise.all([saveRegions(root, 'thing', [{ name: 'skirt', points: square }]), saveRegions(root, 'thing', [{ name: 'fan', points: square }])]);
    const saved = JSON.parse(await readFile(resolve(source, 'regions.json'), 'utf8')) as { dimensions: number[]; regions: { name: string }[] };
    assert.deepEqual(saved.dimensions, [40, 30]); assert.equal(saved.regions.length, 1, 'one save wins whole');
    assert.deepEqual((await readRegions(root, 'thing')).regions[0]!.points[2], [10, 10]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a region list refuses what the bake could not read', () => {
  assert.throws(() => readRegionList([{ name: 'Skirt', points: square }]), /lower-case name/u);
  assert.throws(() => readRegionList([{ name: 'a', points: square.slice(0, 2) }]), /three points/u);
  assert.throws(() => readRegionList([{ name: 'a', points: square }, { name: 'a', points: square }]), /Two regions/u);
  assert.throws(() => readRegionList([{ name: 'a', points: [[0, 0], [1, NaN], [2, 2]] }]), /\[x, y\]/u);
});
