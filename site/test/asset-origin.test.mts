import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { assetShaMap } from '../asset-origin.mts';

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
