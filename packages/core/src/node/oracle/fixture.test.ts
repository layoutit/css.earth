import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { requireRecord, requireString } from '../../index.js';
import { projectRoot } from '../project-root.js';
import { assertPinnedInputs, pinnedOracleVersions, readOracleInput, readOracleFixture } from './fixture.mts';

const root = projectRoot(import.meta.url);

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions()),fixture:(await m.readOracleFixture('fits/core.json')).generatedBy}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ root, pins: sourcePins, fixture: (await readOracleFixture('fits/core.json')).generatedBy });
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

it('Python records preserve historical input identities for relocated FITS and hosted-orbit inputs', async () => {
  const reader = await readFile(new URL('fixture.mts', import.meta.url), 'utf8');
  const table = /const relocatedPaths:[^=]+ = (\{[\s\S]*?\n\});/u.exec(reader);
  if (!table) throw new Error('Expected the reader relocation table.');
  const entries = [...table[1]!.matchAll(/"([^"]+)":\s*"([^"]+)"/gu)]
    .map(match => [match[1]!, match[2]!] as const)
    .filter(([historical, current]) => historical.startsWith('tests/fixtures/') &&
      (current.startsWith('packages/fits/') || current.startsWith('packages/bake/src/astronomy/')));
  entries.push(['tests/fixtures/fits/float32.fits', 'packages/fits/src/node/fixtures/fits/float32.fits']);
  for (const [historical, current] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    const result = spawnSync('python3', ['-c',
      'import json, runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); m = runpy.run_path(sys.argv[1]); print(json.dumps(m["input_record"](m["ROOT"] / sys.argv[2])))',
      resolve(root, 'packages/core/src/node/oracle/fixture.py'), current], { cwd: tmpdir(), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(requireString(requireRecord(JSON.parse(result.stdout)).path), current).toBe(historical);
  }
});

it('Python and TypeScript resolve relocated oracle fixtures to the same current files', async () => {
  const result = spawnSync('python3', ['-c',
    'import json, runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); m = runpy.run_path(sys.argv[1]); print(json.dumps({k: str(m["fixture_path"](k)) for k in sorted(m["relocated"])}))',
    resolve(root, 'packages/core/src/node/oracle/fixture.py')], { cwd: tmpdir(), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  const paths: unknown = JSON.parse(result.stdout);
  expect(typeof paths).toBe('object');
  if (!paths || typeof paths !== 'object') throw new TypeError('Expected oracle fixture paths.');
  for (const name of Object.keys(paths).sort()) {
    const path: unknown = Reflect.get(paths, name);
    if (typeof path !== 'string') throw new TypeError('Expected an oracle fixture path.');
    const { name: logicalName, ...logical } = await readOracleFixture(name);
    const { name: absoluteName, ...absolute } = await readOracleFixture(path);
    expect(logicalName).toBe(name);
    expect(absoluteName).toBe(path);
    expect(logical, name).toEqual(absolute);
  }
});


it('the historical float32 input resolves after its global fixture copy is removed', async () => {
  const fixture = await readOracleFixture('fits/core.json');
  const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/float32.fits');
  expect(input).toBeDefined();
  if (!input) throw new Error('Missing float32 oracle input.');
  expect(await readOracleInput(input)).toEqual(await readFile(resolve(root, 'packages/fits/src/node/fixtures/fits/float32.fits')));
});
