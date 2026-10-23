import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { mock } from 'node:test';
import * as paths from '../paths/index.js';
import { installedMarkerIssue, readToolchainPins, writeInstalledMarker } from '../toolchain/marker.js';

test('PICASO migration installs and verifies the destination rather than a compatible legacy root', async t => {
  const directory = await mkdtemp(resolve(tmpdir(), 'picaso-migration-'));
  const userRoot = resolve(directory, 'user'), legacyHome = resolve(directory, 'legacy');
  const destination = resolve(userRoot, 'output/toolchains/picaso'), legacy = resolve(legacyHome, 'output/toolchains/picaso');
  const pins = readToolchainPins('picaso', 'picaso-toolchain.json');
  const profile = 't1000g100nc_m0.0.dat', tables = ['sonora_2121grid_feh0.0_co0.46.hdf5', 'sonora_2121grid_feh0.5_co0.46.hdf5'];
  const put = (file: string) => { mkdirSync(resolve(file, '..'), { recursive: true }); writeFileSync(file, 'fixture'); };
  put(resolve(legacy, 'bobcat-2021/structures', profile));
  put(resolve(legacy, 'reference/config.json'));
  for (const table of tables) put(resolve(legacy, 'opacities', table));
  writeInstalledMarker(legacy, pins);
  const previousHome = process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME;
  process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME = legacyHome;
  const calls: { command: string; args: readonly string[] }[] = [];
  let extractProfiles = true;
  const run = (command: string, args: readonly string[], options?: { env?: NodeJS.ProcessEnv }) => {
    calls.push({ command, args });
    if (command === '/fixture/micromamba') put(resolve(destination, 'env/bin/python'));
    if (command === 'curl') put(args[args.indexOf('-o') + 1]!);
    if (command === 'tar' && extractProfiles) put(resolve(args[args.indexOf('-C') + 1]!, profile));
    if (command === 'unzip') {
      const folder = args[args.indexOf('-d') + 1]!;
      if (args.includes('pressure-temperature_profiles/*')) put(resolve(folder, 'pressure-temperature_profiles/t1000.pt'));
      else for (const table of tables) put(resolve(folder, table));
    }
    if (args.some(arg => arg.includes('d.get_reference'))) put(resolve(options?.env?.picaso_refdata ?? '', 'config.json'));
    if (args.includes('-I') && args.includes('-c')) return '3.11.16';
    return args[0] === '-c' ? '4.1' : '';
  };
  const mocks = [
    mock.module(new URL('../http-download.ts', import.meta.url).href, { namedExports: {
      downloadHttpFile: async (url: string, path: string) => { calls.push({ command: 'download', args: [url, path] }); put(path); } } }),
    mock.module(new URL('../paths/index.ts', import.meta.url).href, { namedExports: { ...paths, USER_ROOT: userRoot, WORKSPACE: undefined } }),
    mock.module(new URL('../toolchain/micromamba.ts', import.meta.url).href, { namedExports: {
      assertManagedPythonPlatform: () => {}, resolveMicromamba: async () => '/fixture/micromamba' } }),
    mock.module(new URL('../toolchain/process.ts', import.meta.url).href, { namedExports: {
      runToolchainProcess: run, runToolchainProcessAsync: async (command: string, args: readonly string[], options?: { env?: NodeJS.ProcessEnv }) => run(command, args, options),
    } }),
  ];
  try {
    const { installPicaso, bobcatNodes, picasoToolchainSync } = await import('./picaso.js');
    assert.equal(bobcatNodes().length, 1, 'the real reader resolves the compatible legacy installation');
    await t.test('fresh destination downloads and extracts profiles even when legacy profiles exist', async () => {
      assert.equal(await installPicaso(), destination);
      assert.ok(calls.some(call => call.command === 'download' && call.args.includes(resolve(destination, 'bobcat-2021/structures/structures.tar.gz'))));
      assert.ok(calls.some(call => call.command === 'tar' && call.args.includes(resolve(destination, 'bobcat-2021/structures'))));
      assert.ok(existsSync(resolve(destination, 'bobcat-2021/structures', profile)));
      assert.ok(existsSync(resolve(destination, 'reference/config.json')));
      for (const table of tables) assert.ok(existsSync(resolve(destination, 'opacities', table)));
      assert.equal(installedMarkerIssue(destination, pins), null);
      assert.equal(picasoToolchainSync().python, resolve(destination, 'env/bin/python'));
    });
    await t.test('destination verification refuses missing profiles and leaves no completion marker', async () => {
      await rm(destination, { recursive: true, force: true });
      extractProfiles = false;
      await assert.rejects(installPicaso(), /holds no Sonora Bobcat profiles/u);
      assert.equal(installedMarkerIssue(destination, pins), 'missing');
      assert.equal(bobcatNodes().length, 1, 'legacy profiles remain readable but cannot verify this destination');
    });
  } finally {
    for (const replacement of mocks.reverse()) replacement.restore();
    if (previousHome === undefined) delete process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME;
    else process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME = previousHome;
    await rm(directory, { recursive: true, force: true });
  }
});
