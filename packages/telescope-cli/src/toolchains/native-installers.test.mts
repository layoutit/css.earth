/** Real native installer entry points must validate a marked installation before accepting it. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

test('NACO and every native interferometry installer reject deleted executables and enter repair', async () => {
  const userRoot = await mkdtemp(resolve(tmpdir(), 'native-installers-'));
  try {
    const script = `
import assert from 'node:assert/strict';
import * as childProcess from 'node:child_process';
import { mock } from 'node:test';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
mock.module('node:child_process', { namedExports: { ...childProcess,
  spawn: () => { throw new Error('repair reached native build'); },
  spawnSync: () => { throw new Error('repair reached native build'); } } });
globalThis.fetch = async () => { throw new Error('repair reached download'); };
const core = await import('@cssearth/telescope-core/node');
const naco = await import(${JSON.stringify(pathToFileURL(resolve('packages/telescope-cli/src/archives/naco/toolchain.mts')).href)});
const interferometry = await import(${JSON.stringify(pathToFileURL(resolve('packages/telescope-cli/src/archives/interferometry/toolchain.mts')).href)});
const completed = [];
for (const id of ['naco', 'squeeze', 'rotir', 'pionier', 'amber', 'gravity', 'matisse']) {
  const pins = id === 'naco' ? await naco.nacoToolchainDescriptor() : await interferometry.toolchainDescriptor(id);
  const root = resolve(core.USER_ROOT, 'output/toolchains', id);
  const executable = resolve(root, id === 'naco' ? 'pipeline/bin/esorex' : pins.entry.executable);
  await mkdir(dirname(executable), { recursive: true });
  await writeFile(executable, '#!/bin/sh\\nexit 0\\n'); await chmod(executable, 0o755);
  if (id === 'naco') await mkdir(resolve(root, 'pipeline/lib/esopipes-plugins/naco-fixture'), { recursive: true });
  core.writeInstalledMarker(root, pins);
  const install = () => id === 'naco' ? naco.installNacoToolchain() : interferometry.installToolchain(id);
  assert.equal(await install(), root, id + ': healthy marker reuses executable');
  await rm(executable);
  await assert.rejects(install(), error => {
    if (error instanceof core.DownloadInterruptedError) {
      assert.match(error.message, /^Download interrupted at 0\.0 MB after 3 attempts\. Run the same command again to retry\.$/u);
      assert.equal(error.rawMessage, 'repair reached download');
    } else assert.equal(error.message, 'repair reached native build');
    return true;
  }, id + ': missing executable must enter repair');
  assert.equal(core.installedMarkerIssue(root, pins), 'missing', id + ': failed repair must invalidate marker');
  completed.push(id);
}
process.stdout.write('VERIFIED ' + completed.join(','));
`;
    const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', script], {
      cwd: resolve('.'), encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, CSSEARTH_TELESCOPE_HOME: userRoot, CSSEARTH_WORKSPACE: undefined },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'VERIFIED naco,squeeze,rotir,pionier,amber,gravity,matisse');
  } finally { await rm(userRoot, { recursive: true, force: true }); }
});
