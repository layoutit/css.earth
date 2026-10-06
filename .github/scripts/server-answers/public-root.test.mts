import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { publicRoot } from './public-root.mts';

test('each checkout is read in its own layout', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'public-root-'));
  try {
    await mkdir(resolve(root, 'public/scenes'), { recursive: true });
    assert.equal(publicRoot(root), 'public');
    await mkdir(resolve(root, 'site/public/scenes'), { recursive: true });
    assert.equal(publicRoot(root), 'site/public', 'the moved directory wins over a leftover root copy');
  } finally { await rm(root, { recursive: true, force: true }); }
});
