import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { requireRecord, requireString } from '../../index.js';
import { projectRoot } from '../project-root.js';
import { assertPinnedInputs, pinnedOracleVersions, readOracleInput, readOracleFixture, fitsArchiveInputs } from './fixture.mts';

const root = projectRoot(import.meta.url);

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  const archiveInputs = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/bake/src/objects/layers/observation/fixtures/fits/archive-inputs.json'), 'utf8'))).inputs;
  expect(await fitsArchiveInputs()).toEqual(archiveInputs);
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions()),archiveInputs:await m.fitsArchiveInputs(),fixture:(await m.readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/core.json')).generatedBy}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ root, pins: sourcePins, archiveInputs, fixture: (await readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/core.json')).generatedBy });
  }
  for (const name of ['fixture.py', 'requirements.txt']) {
    expect(await readFile(resolve(root, 'packages/core/dist/oracle', name))).toEqual(
      await readFile(new URL(name, import.meta.url)));
  }
});

it('kernel inputs require their owner verifier and propagate its rejection', async () => {
  const inputs = [{ path: 'src/spice/new-horizons/lsk/naif0012.tls' }];
  await expect(assertPinnedInputs(inputs)).rejects.toThrow('Kernel oracle inputs require the caller bank verifier.');
  await expect(assertPinnedInputs(inputs, async (set, kernels) => {
    expect(set).toBe('new-horizons');
    expect(kernels).toEqual(['lsk/naif0012.tls']);
    throw new Error('bank rejected');
  })).rejects.toThrow('bank rejected');
});

it('the Python writer finds the module-relative root in both source and distribution', () => {
  for (const path of ['packages/core/src/node/oracle/fixture.py', 'packages/core/dist/oracle/fixture.py']) {
    const result = spawnSync('python3', ['-c',
      'import runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); print(runpy.run_path(sys.argv[1])["ROOT"])',
      fileURLToPath(new URL(path, `file://${root}/`))], { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(root);
  }
});

it('a fixture input resolves at its recorded path', async () => {
  const fixture = await readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/core.json');
  const input = fixture.inputs.find(entry => entry.path === 'packages/fits/src/node/fixtures/fits/float32.fits');
  expect(input).toBeDefined();
  if (!input) throw new Error('Missing float32 oracle input.');
  expect(await readOracleInput(input)).toEqual(await readFile(resolve(root, 'packages/fits/src/node/fixtures/fits/float32.fits')));
});

it('source and built oracle runners list the known oracles', () => {
  for (const path of ['packages/core/src/node/oracle/run.mts', 'packages/core/dist/oracle/run.js']) {
    const result = spawnSync(process.execPath, [resolve(root, path), '__unknown__'], { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown oracle __unknown__; known:');
    expect(result.stderr).toContain('astronomy/hosted-eccentric');
    expect(result.stderr).not.toContain('ENOENT');
  }
});

it('every oracle fixture names a generator that exists', () => {
  const listed = spawnSync('git', ['grep', '-l', 'cssearth-oracle-fixture@1', '--', '*.json'], { cwd: root, encoding: 'utf8' });
  const fixtures = listed.stdout.split('\n').filter(Boolean);
  expect(fixtures.length).toBeGreaterThan(20);
  for (const path of fixtures) {
    const fixture = requireRecord(JSON.parse(readFileSync(resolve(root, path), 'utf8')));
    expect(existsSync(resolve(root, requireString(fixture.generatedBy))), path).toBe(true);
  }
});
