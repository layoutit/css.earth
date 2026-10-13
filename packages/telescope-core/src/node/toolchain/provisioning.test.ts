import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { mock } from 'node:test';
import * as paths from '../paths.js';
import { installedMarkerIssue, readToolchainPins, type ToolchainPins } from './marker.js';

test('the first async astronomy query installs missing pins and later queries reuse their exact marker', async () => {
  const userRoot = await mkdtemp(resolve(tmpdir(), 'astronomy-provisioning-')), calls: { command: string; args: readonly string[] }[] = [];
  const pins = readToolchainPins('astroquery', 'toolchain.json'), entry = pins.entry;
  const versions = [entry.astroquery, entry.pyvo, entry.scipy, entry.batman, entry.orbitize, entry.whereistheplanet,
    entry.cdflib, entry.pyuvdata, entry.astropyHealpix].join(' ');
  let resolutions = 0;
  const mocks = [
    mock.module(new URL('../paths.ts', import.meta.url).href, { namedExports: { ...paths, USER_ROOT: userRoot,
      telescopePythonEnvironment: (overrides: NodeJS.ProcessEnv = {}) => ({ ...process.env, ...overrides }) } }),
    mock.module(new URL('./micromamba.ts', import.meta.url).href, { namedExports: {
      assertManagedPythonPlatform: () => {}, resolveMicromamba: async () => { resolutions++; return '/test/selected-micromamba'; } } }),
    mock.module(new URL('./resolver.ts', import.meta.url).href, { namedExports: {
      resolveInstalledToolchain: (root: string, expected: ToolchainPins, additional: readonly string[] = []) =>
        [root, ...additional].find(candidate => installedMarkerIssue(candidate, expected) === null) ?? null } }),
    mock.module(new URL('./process.ts', import.meta.url).href, { namedExports: {
      runToolchainProcess: (command: string, args: readonly string[]) => {
        calls.push({ command, args });
        if (command === 'xcrun') return '/fixture-sdk';
        if (command === 'cc' || command === 'gcc') { assert.ok(args.includes('-x')); return ''; }
        if (command.endsWith('/probe')) return 'TELESCOPE_COMPILER_READY';
        if (command === '/test/selected-micromamba') {
          const prefix = args[args.indexOf('-p') + 1]; assert.ok(prefix);
          mkdirSync(resolve(prefix, 'bin'), { recursive: true });
          writeFileSync(resolve(prefix, 'bin/python'), '');
        }
        return args.includes('-I') && args.includes('-c') ? '3.12.1' : args[0] === '-c' ? versions : '';
      } } }),
  ];
  try {
    const { astroqueryToolchain, astroqueryToolchainSync } = await import('./toolchain.js');
    assert.throws(() => astroqueryToolchainSync(), /not installed/u);
    const first = await astroqueryToolchain(), second = await astroqueryToolchain();
    assert.equal(first.python, second.python);
    assert.ok(first.python.startsWith(userRoot));
    assert.equal(resolutions, 1);
    assert.ok(calls.findIndex(call => call.command === 'cc') < calls.findIndex(call => call.command === '/test/selected-micromamba'));
    assert.ok(calls.some(call => call.command.endsWith('/probe')), 'a compiler must produce a working probe before provisioning');
    assert.equal(calls.filter(call => call.command === '/test/selected-micromamba').length, 1);
    assert.ok(calls.some(call => call.args.includes(resolve(paths.TOOLCHAINS, 'requirements.lock'))));
    assert.equal(installedMarkerIssue(resolve(first.python, '../../..'), pins), null);
  } finally { for (const replacement of mocks.reverse()) replacement.restore(); await rm(userRoot, { recursive: true, force: true }); }
});
