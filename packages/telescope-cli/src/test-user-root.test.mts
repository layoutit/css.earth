import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { packagePath } from './paths.mts';
import { writeInstalledMarker, readToolchainPins } from '@cssearth/telescope-core/node';

test('isolated test caches preserve an explicitly provisioned astronomy toolchain home', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'provisioned-telescope-'));
  try {
    const install = resolve(root, 'astroquery/packages-test'); await mkdir(resolve(install, 'env/bin'), { recursive: true });
    const { writeFile } = await import('node:fs/promises'); await writeFile(resolve(install, 'env/bin/python'), '');
    writeInstalledMarker(install, readToolchainPins('astroquery', 'toolchain.json'));
    const code = `await import(${JSON.stringify(packagePath('src/test-user-root.mts'))}); const { USER_ROOT, astroqueryToolchainSync } = await import('@cssearth/telescope-core/node'); console.log(JSON.stringify({ root: USER_ROOT, python: astroqueryToolchainSync().python }));`;
    const result = JSON.parse(execFileSync(process.execPath, ['--import', './packages/core/src/node/register-vite-suffix.mts', '--input-type=module', '-e', code], { encoding: 'utf8', env: { ...process.env, CSSEARTH_TELESCOPE_HOME: root, CSSEARTH_TELESCOPE_TOOLCHAIN_HOME: '', CSS_EARTH_ASTROQUERY_CACHE: resolve(root, 'absent') } }).trim().split("\n")[0]!);
    assert.notEqual(result.root, root);
    assert.equal(result.python, resolve(install, 'env/bin/python'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('qualification test workers isolate user records on every launch before loading their owners', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'qualification-user-state-'));
  try {
    const directory = resolve(root, 'output/telescopes/test/qualifications');
    await mkdir(directory, { recursive: true });
    const sentinel = resolve(directory, 'existing.json');
    await writeFile(sentinel, 'existing user record');
    const roots = new Set<string>();
    for (const owner of ['vo/session.test.mts', 'vo/spectrum-session.test.mts', 'qualification/qualify.test.mts']) {
      for (let run = 0; run < 2; run++) {
        // Load the real test entry while excluding its cases: localhost access is unnecessary for this boundary check.
        const probe = `console.log(JSON.stringify({ root: USER_ROOT, records: await loadQualifiedObservations(process.cwd(), 'test') }));`;
        const code = `await import(${JSON.stringify(packagePath(`src/${owner}`))}); const { USER_ROOT } = await import('@cssearth/telescope-core/node'); const { loadQualifiedObservations, qualificationDirectory } = await import(${JSON.stringify(packagePath('src/qualification/qualified-observations.mts'))});
          ${owner === 'vo/session.test.mts' ? `const { mkdirSync, writeFileSync } = await import('node:fs'); const { test } = await import('node:test'); mkdirSync(qualificationDirectory('test'), { recursive: true }); writeFileSync(qualificationDirectory('test') + '/previous-case.json', 'previous scenario record'); test('isolation probe', async () => { ${probe} });` : probe}`;
        const stdout = execFileSync(process.execPath, ['--import', './packages/core/src/node/register-vite-suffix.mts', '--test-name-pattern=^isolation probe$', '--input-type=module', '-e', code],
          { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_TEST_CONTEXT: undefined, CSSEARTH_TELESCOPE_HOME: root } });
        const signal = stdout.split('\n').map(line => line.replace(/^# /u, '')).find(line => line.startsWith('{'));
        assert.ok(signal, `${owner} must emit its isolation probe result`);
        const result = JSON.parse(signal);
        assert.notEqual(result.root, root, `${owner} must not use the supplied persistent user store`);
        assert.equal(roots.has(result.root), false, `${owner} must receive fresh user state on each launch`);
        roots.add(result.root);
        assert.deepEqual(result.records, []);
        assert.equal(await readFile(sentinel, 'utf8'), 'existing user record');
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
