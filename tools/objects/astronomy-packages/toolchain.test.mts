import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { toolchainRootIssue } from './toolchain.mts';

test('a dangling shared astronomy toolchain link names the missing target', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'astroquery-link-'));
  try {
    const link = resolve(root, 'astroquery');
    await symlink('missing-shared-env', link);
    assert.match(toolchainRootIssue(link) ?? '', /points to missing .*missing-shared-env/u);
    assert.equal(toolchainRootIssue(resolve(root, 'not-installed')), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
