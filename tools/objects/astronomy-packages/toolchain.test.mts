import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { findInstalledRoot, installedToolchain, toolchainRootIssue } from './toolchain.mts';

test('a dangling shared astronomy toolchain link names the missing target', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'astroquery-link-'));
  try {
    const link = resolve(root, 'astroquery');
    await symlink('missing-shared-env', link);
    assert.match(toolchainRootIssue(link) ?? '', /points to missing .*missing-shared-env/u);
    assert.equal(toolchainRootIssue(resolve(root, 'not-installed')), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a verified shared pin survives a dangling checkout link; incomplete pins are not published', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'astroquery-shared-'));
  try {
    const local = resolve(root, 'checkout/astroquery'), shared = resolve(root, 'cache/pin'), digest = 'a'.repeat(64);
    await mkdir(resolve(root, 'checkout'), { recursive: true });
    await symlink(resolve(root, 'deleted-env'), local);
    await mkdir(resolve(shared, 'env/bin'), { recursive: true });
    await writeFile(resolve(shared, 'env/bin/python'), 'fixture');
    assert.equal(findInstalledRoot(local, shared, digest), null);
    await writeFile(resolve(shared, 'installed.json'), JSON.stringify({ id: 'astroquery', pinsSha256: digest }));
    assert.equal(installedToolchain(shared, digest), true);
    assert.equal(findInstalledRoot(local, shared, digest), shared);
    assert.equal(findInstalledRoot(local, shared, 'b'.repeat(64)), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
