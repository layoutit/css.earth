import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { mock } from 'node:test';
import * as paths from '../paths/index.js';
import { installedMarkerIssue, readToolchainPins, writeInstalledMarker, type ToolchainPins } from './marker.js';
import { DownloadCancelledError, withTransferConsent, type TransferConsent } from '../consent.js';

test('the first async astronomy query installs missing pins and later queries reuse their exact marker', async () => {
  const userRoot = await mkdtemp(resolve(tmpdir(), 'astronomy-provisioning-')), calls: { command: string; args: readonly string[] }[] = [];
  const pins = readToolchainPins('astroquery', 'toolchain.json'), entry = pins.entry;
  const versions = [entry.astroquery, entry.pyvo, entry.scipy, entry.batman, entry.orbitize, entry.whereistheplanet,
    entry.cdflib, entry.pyuvdata, entry.astropyHealpix].join(' ');
  const scratch = resolve(userRoot, 'scratch'); mkdirSync(scratch, { recursive: true });
  let resolutions = 0;
  const run = (command: string, args: readonly string[]) => {
    calls.push({ command, args });
    if (command === 'xcrun') return args[0] === '--find' ? 'cc' : '/fixture-sdk';
    if (command === 'cc' || command === 'gcc') { assert.ok(args.includes('-x') || args.some(arg => arg.endsWith('/probe.o'))); return ''; }
    if (command.endsWith('/probe')) return 'TELESCOPE_COMPILER_READY';
    if (command === '/test/selected-micromamba') {
      const prefix = args[args.indexOf('-p') + 1]; assert.ok(prefix);
      mkdirSync(resolve(prefix, 'bin'), { recursive: true });
      writeFileSync(resolve(prefix, 'bin/python'), '');
    }
    return args.includes('-I') && args.includes('-c') ? '3.12.1' : args[0] === '-c' ? versions : '';
  };
  const mocks = [
    mock.module(new URL('../paths/index.ts', import.meta.url).href, { namedExports: { ...paths, USER_ROOT: userRoot, SCRATCH_ROOT: scratch,
      telescopePythonEnvironment: (overrides: NodeJS.ProcessEnv = {}) => ({ ...process.env, TMPDIR: scratch, TMP: scratch, TEMP: scratch, ...overrides }) } }),
    mock.module(new URL('./micromamba.ts', import.meta.url).href, { namedExports: {
      assertManagedPythonPlatform: () => {}, resolveMicromamba: async () => { resolutions++; return '/test/selected-micromamba'; } } }),
    mock.module(new URL('./resolver.ts', import.meta.url).href, { namedExports: {
      resolveInstalledToolchain: (root: string, expected: ToolchainPins, additional: readonly string[] = []) =>
        [root, ...additional].find(candidate => installedMarkerIssue(candidate, expected) === null) ?? null } }),
    mock.module(new URL('./process.ts', import.meta.url).href, { namedExports: {
      runToolchainProcess: run, runToolchainProcessAsync: async (command: string, args: readonly string[]) => run(command, args),
    } }),
  ];
  try {
    const { astroqueryToolchain, astroqueryToolchainSync, findInstalledRoot, installAstroquery } = await import('./toolchain.js');
    assert.throws(() => astroqueryToolchainSync(), /not installed/u);
    await assert.rejects(withTransferConsent(async () => { throw new DownloadCancelledError(); }, () => astroqueryToolchain()), DownloadCancelledError);
    assert.equal(resolutions, 0, 'refusal must precede micromamba resolution and installation');
    assert.equal(calls.length, 0, 'refusal must precede even compiler and Python processes');
    await assert.rejects(access(resolve(userRoot, 'toolchains')), { code: 'ENOENT' });
    const legacy = resolve(userRoot, 'astroquery/packages-legacy');
    mkdirSync(resolve(legacy, 'env/bin'), { recursive: true });
    writeFileSync(resolve(legacy, 'env/bin/python'), '');
    writeInstalledMarker(legacy, pins);
    assert.equal(findInstalledRoot(resolve(userRoot, 'absent'), resolve(userRoot, 'toolchains/astroquery/packages-legacy'), pins), legacy,
      'moving new installs into toolchains must keep the previous user-cache install readable');
    await rm(legacy, { recursive: true });
    const requests: TransferConsent[] = [];
    const [first, second] = await withTransferConsent(async info => { requests.push(info); }, () => Promise.all([astroqueryToolchain(), astroqueryToolchain()]));
    assert.equal(first.python, second.python);
    assert.ok(first.python.startsWith(userRoot));
    assert.equal(resolutions, 1);
    assert.ok(calls.findIndex(call => call.command === 'cc') < calls.findIndex(call => call.command === '/test/selected-micromamba'));
    assert.ok(calls.some(call => call.command.endsWith('/probe')), 'a compiler must produce a working probe before provisioning');
    assert.equal(calls.filter(call => call.command === '/test/selected-micromamba').length, 1);
    assert.ok(calls.some(call => call.args.includes(resolve(paths.TOOLCHAINS, 'requirements.lock'))));
    assert.equal(installedMarkerIssue(resolve(first.python, '../../..'), pins), null);
    assert.equal(requests.length, 1, 'concurrent consumers request consent once for the shared install');
    assert.equal(requests[0]?.kind, 'toolchain');
    assert.equal(requests[0]?.bytes, 1_000_000_000);
    assert.equal(requests[0]?.destination, resolve(first.python, '../../..'));
    assert.ok(requests[0]?.kind === 'toolchain' && requests[0].packages.includes('Python'));
    assert.ok(first.python.startsWith(resolve(userRoot, 'toolchains/astroquery') + '/'));
    await withTransferConsent(async () => { throw new Error('installed or explicit setup must not ask'); }, async () => {
      await astroqueryToolchain();
      await rm(resolve(first.python, '../../..'), { recursive: true });
      await installAstroquery();
    });
    assert.equal(resolutions, 2, 'explicit setup of missing pins performs a fresh install without consent');
  } finally { for (const replacement of mocks.reverse()) replacement.restore(); await rm(userRoot, { recursive: true, force: true }); }
});
