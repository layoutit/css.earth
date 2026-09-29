import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { it as test } from 'vitest';
import { findInstalledRoot, installedToolchain, toolchainRootIssue } from './toolchain.js';
import { writeInstalledMarker, type ToolchainPins } from './toolchain-marker.js';

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
    const local = resolve(root, 'checkout/astroquery'), shared = resolve(root, 'cache/pin');
    const pins: ToolchainPins = { id: 'astroquery', file: 'toolchain.json', descriptor: '{"astroquery":"0.4.11"}', lock: 'astroquery==0.4.11\n', entry: {} };
    await mkdir(resolve(root, 'checkout'), { recursive: true });
    await symlink(resolve(root, 'deleted-env'), local);
    await mkdir(resolve(shared, 'env/bin'), { recursive: true });
    await writeFile(resolve(shared, 'env/bin/python'), 'fixture');
    assert.equal(findInstalledRoot(local, shared, pins), null);
    writeInstalledMarker(shared, pins);
    assert.equal(installedToolchain(shared, pins), true);
    assert.equal(findInstalledRoot(local, shared, pins), shared);
    assert.equal(findInstalledRoot(local, shared, { ...pins, lock: 'astroquery==0.4.12\n' }), null, 'a changed lock asks for a reinstall');
    await writeFile(resolve(shared, 'installed.json'), JSON.stringify({ id: 'astroquery' }));
    assert.equal(installedToolchain(shared, pins), false, 'a marker without the pinned texts is not an install');
  } finally { await rm(root, { recursive: true, force: true }); }
});
