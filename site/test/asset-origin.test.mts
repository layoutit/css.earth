import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assetShaMap } from '../asset-origin.mts';

test('an object without runtime-assets.json has an empty asset map', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asset-origin-'));
  await mkdir(join(root, 'src/objects/shell-only'), { recursive: true });
  assert.deepEqual(await assetShaMap('shell-only', root), {});
});

test('an unreadable runtime-assets.json still fails the build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'asset-origin-'));
  await mkdir(join(root, 'src/objects/broken'), { recursive: true });
  await writeFile(join(root, 'src/objects/broken/runtime-assets.json'), '{not json');
  await assert.rejects(assetShaMap('broken', root));
});
