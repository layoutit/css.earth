import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { requireRecord, requireString } from '../../index.js';
import { projectRoot } from '../project-root.js';
import { assertPinnedInputs, pinnedOracleVersions, readOracleInput, readOracleFixture, fitsArchiveInputs } from './fixture.mts';

const root = projectRoot(import.meta.url);

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  const archiveInputs = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/bake/src/objects/layers/observation/fixtures/fits/archive-inputs.json'), 'utf8'))).inputs;
  assert.deepEqual((await fitsArchiveInputs()), archiveInputs);
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions()),archiveInputs:await m.fitsArchiveInputs(),fixture:(await m.readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/core.json')).generatedBy}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { root, pins: sourcePins, archiveInputs, fixture: (await readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/core.json')).generatedBy });
  }
  for (const name of ['fixture.py', 'requirements.txt']) {
    assert.deepEqual((await readFile(resolve(root, 'packages/core/dist/oracle', name))), await readFile(new URL(name, import.meta.url)));
  }
});

it('kernel inputs require their owner verifier and propagate its rejection', async () => {
  const inputs = [{ path: 'src/spice/new-horizons/lsk/naif0012.tls' }];
  await assert.rejects(assertPinnedInputs(inputs), /Kernel oracle inputs require the caller bank verifier\./);
  await assert.rejects(assertPinnedInputs(inputs, async (set, kernels) => {
    assert.equal(set, 'new-horizons');
    assert.deepEqual(kernels, ['lsk/naif0012.tls']);
    throw new Error('bank rejected');
  }), /bank rejected/);
});

it('the Python writer finds the module-relative root in both source and distribution', () => {
  for (const path of ['packages/core/src/node/oracle/fixture.py', 'packages/core/dist/oracle/fixture.py']) {
    const result = spawnSync('python3', ['-c',
      'import runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); print(runpy.run_path(sys.argv[1])["ROOT"])',
      fileURLToPath(new URL(path, `file://${root}/`))], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), root);
  }
});

it('a fixture input resolves at its recorded path', async () => {
  const fixture = await readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/core.json');
  const input = fixture.inputs.find(entry => entry.path === 'packages/fits/src/node/fixtures/fits/float32.fits');
  assert.notEqual(input, undefined);
  if (!input) throw new Error('Missing float32 oracle input.');
  assert.deepEqual((await readOracleInput(input)), await readFile(resolve(root, 'packages/fits/src/node/fixtures/fits/float32.fits')));
});

it('missing oracle inputs name their recorded path and owner restoration without a dead command', async () => {
  const path = 'packages/core/src/node/fixtures/absent-oracle-input.fits';
  await assert.rejects(readOracleInput({ path }), {
    message: `Missing oracle input ${path}. Restore it from its owner's declared source record.`,
  });
});

it('source and built oracle runners list the known oracles', () => {
  for (const path of ['packages/core/src/node/oracle/run.mts', 'packages/core/dist/oracle/run.js']) {
    const result = spawnSync(process.execPath, [resolve(root, path), '__unknown__'], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('Unknown oracle __unknown__; known:'));
    assert.ok(result.stderr.includes('astronomy/hosted-eccentric'));
    assert.ok(!result.stderr.includes('ENOENT'));
  }
});

it('every oracle fixture names a generator that exists', () => {
  const listed = spawnSync('git', ['grep', '-l', 'cssearth-oracle-fixture@1', '--', '*.json'], { cwd: root, encoding: 'utf8' });
  const fixtures = listed.stdout.split('\n').filter(Boolean);
  assert.ok(fixtures.length > 20);
  for (const path of fixtures) {
    const fixture = requireRecord(JSON.parse(readFileSync(resolve(root, path), 'utf8')));
    assert.ok(existsSync(resolve(root, requireString(fixture.generatedBy))), path);
  }
});
