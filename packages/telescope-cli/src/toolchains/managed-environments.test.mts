import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { USER_ROOT, withInstallLock, writeInstalledMarker } from '@cssearth/telescope-core/node';
import { listManagedEnvironments, removeManagedEnvironment } from './managed-environments.mts';
import { main, type CliIo } from '../cli.mts';

async function installed(user: string, name = 'astroquery/packages-fixture') {
  const folder = resolve(user, 'toolchains', name);
  await mkdir(resolve(folder, 'env/bin'), { recursive: true });
  await writeFile(resolve(folder, 'env/bin/python'), 'fixture bytes');
  writeInstalledMarker(folder, { id: 'astroquery', file: 'pins.json', descriptor: '{}', lock: null, entry: {} });
  return folder;
}
test('list reports installed environments, allocated disk bytes, folders and no unmarked directories', async () => {
  const user = await mkdtemp(resolve(tmpdir(), 'toolchain-list-'));
  try {
    assert.deepEqual(await listManagedEnvironments(user), []);
    const folder = await installed(user);
    await mkdir(resolve(user, 'toolchains/unmarked'));
    await symlink(resolve(folder, 'env/bin/python'), resolve(folder, 'linked'));
    const result = await listManagedEnvironments(user);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.name, 'astroquery/packages-fixture');
    assert.equal(result[0]!.folder, folder); assert.equal(result[0]!.removable, true);
    assert.ok(result[0]!.bytes >= (await stat(resolve(folder, 'env/bin/python'))).blocks * 512);
    const bytes = result[0]!.bytes;
    await writeFile(resolve(folder, 'large'), Buffer.alloc(1_000_000, 1));
    assert.ok((await listManagedEnvironments(user))[0]!.bytes > bytes + 900_000);
    assert.deepEqual(await readdir(user), ['toolchains']);
  } finally { await rm(user, { recursive: true, force: true }); }
});
test('remove deletes one installed environment and keeps peers, outside files and reusable machinery', async () => {
  const user = await mkdtemp(resolve(tmpdir(), 'toolchain-remove-'));
  try {
    const folder = await installed(user), peer = await installed(user, 'astroquery/packages-peer');
    await writeFile(resolve(user, 'micromamba'), 'keep');
    await assert.rejects(removeManagedEnvironment('astroquery', user), /Several installs/u);
    const result = await removeManagedEnvironment('astroquery/packages-fixture', user);
    assert.equal(result.removed, true); assert.equal(result.folder, folder);
    await assert.rejects(stat(folder), { code: 'ENOENT' });
    assert.equal(await readFile(resolve(peer, 'env/bin/python'), 'utf8'), 'fixture bytes');
    assert.equal(await readFile(resolve(user, 'micromamba'), 'utf8'), 'keep');
    assert.equal((await removeManagedEnvironment('astroquery', user)).folder, peer);
    await assert.rejects(removeManagedEnvironment('astroquery', user), /No installed/u);
  } finally { await rm(user, { recursive: true, force: true }); }
});
test('remove refuses traversal, absolute paths, symlink escapes, legacy installs and every install lock', async () => {
  const user = await mkdtemp(resolve(tmpdir(), 'toolchain-refuse-')), outside = await mkdtemp(resolve(tmpdir(), 'toolchain-outside-'));
  try {
    const folder = await installed(user), other = await installed(outside, 'external');
    for (const name of ['../external', '/tmp/external', '.', '..', 'astroquery/../../external', 'astroquery\\external', ''])
      await assert.rejects(removeManagedEnvironment(name, user), /managed toolchain name/u);
    await symlink(other, resolve(user, 'toolchains/external'));
    await assert.rejects(removeManagedEnvironment('external', user));
    for (const prefix of [folder, resolve(folder, 'env'), resolve(folder, 'native')]) {
      await withInstallLock(prefix, async () => {
        await assert.rejects(removeManagedEnvironment('astroquery', user), /locked/u);
        assert.equal(await readFile(resolve(folder, 'env/bin/python'), 'utf8'), 'fixture bytes');
      });
    }
    await mkdir(resolve(user, 'output/toolchains'), { recursive: true });
    await rm(resolve(user, 'toolchains/external'));
    await symlink(other, resolve(user, 'toolchains/linked'));
    const legacy = resolve(user, 'output/toolchains/old');
    await mkdir(legacy); writeInstalledMarker(legacy, { id: 'old', file: 'old.json', descriptor: '{}', lock: null, entry: {} });
    assert.equal((await listManagedEnvironments(user)).find(item => item.name === 'old')!.removable, false);
    await assert.rejects(removeManagedEnvironment('old', user), /only environments inside/u);
    await rm(resolve(user, 'toolchains'), { recursive: true });
    await symlink(resolve(outside, 'toolchains'), resolve(user, 'toolchains'));
    await assert.rejects(removeManagedEnvironment('external', user));
    assert.equal(await readFile(resolve(other, 'env/bin/python'), 'utf8'), 'fixture bytes');
  } finally { await rm(user, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});
test('toolchain list and remove --json run through the public CLI with one complete document', async () => {
  const folder = await installed(USER_ROOT), stdout: string[] = [], stderr: string[] = [];
  const io: CliIo = { stdinIsTTY: false, stdoutIsTTY: false, write: text => stdout.push(text), error: text => stderr.push(text), question: async () => { throw new Error('Unexpected question'); }, close: () => {} };
  assert.equal(await main(['toolchain', 'list', '--json'], undefined, io.write, io), 0);
  assert.equal(stdout.length, 1); assert.equal(JSON.parse(stdout[0]!).toolchains[0].folder, folder);
  stdout.length = 0;
  assert.equal(await main(['toolchain', 'remove', 'astroquery', '--json'], undefined, io.write, io), 0);
  assert.equal(stdout.length, 1); assert.equal(JSON.parse(stdout[0]!).removed, true);
  await assert.rejects(stat(folder), { code: 'ENOENT' }); assert.deepEqual(stderr, []);
});
