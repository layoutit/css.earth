import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { MissingSourceInputError } from '../../source-input.ts';
import { projectRoot } from '../project-root.ts';
import { assertPinnedInputs, pinnedOracleVersions, readOracleInput, readOracleFixture, registerOracleInputResolvers, setupOracleInputResolvers } from './fixture.mts';

const root = projectRoot(import.meta.url);
const directory = await mkdtemp(resolve(tmpdir(), 'oracle-reader-'));
registerOracleInputResolvers([{ id: 'test-inputs', accepts: path => path.startsWith(directory), verify: async () => {} }]);

it('source and built readers find the same root and shipped pins from another working directory', async () => {
  const sourcePins = Object.fromEntries(await pinnedOracleVersions());
  for (const path of ['packages/core/src/node/oracle/fixture.mts', 'packages/core/dist/oracle/fixture.js']) {
    const url = new URL(path, `file://${root}/`).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify({root:m.ORACLE_ROOT,pins:Object.fromEntries(await m.pinnedOracleVersions())}));`],
    { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { root, pins: sourcePins });
  }
  for (const name of ['fixture.py', 'requirements.txt']) {
    assert.deepEqual(await readFile(resolve(root, 'packages/core/dist/oracle', name)), await readFile(new URL(name, import.meta.url)));
  }
});

it('the owner registry rejects unregistered and ambiguous inputs', async () => {
  await assert.rejects(assertPinnedInputs([{ path: 'unregistered/input' }]), /exactly one registered owner.*0 found/u);
  registerOracleInputResolvers([{ id: 'overlap-a', accepts: path => path === 'ambiguous/input', verify: async () => {} },
    { id: 'overlap-b', accepts: path => path === 'ambiguous/input', verify: async () => {} }]);
  await assert.rejects(assertPinnedInputs([{ path: 'ambiguous/input' }]), /exactly one registered owner.*2 found/u);
  assert.throws(() => registerOracleInputResolvers([{ id: 'test-inputs', accepts: () => true, verify: async () => {} }]), /already registered/u);
});

it('owner setup is singleton-idempotent and failed admissions change no registry state', async () => {
  const resolver = (id: string) => ({ id, accepts: (path: string) => path === id, verify: async () => {} });
  setupOracleInputResolvers('setup-example', [resolver('setup-input')]);
  assert.doesNotThrow(() => setupOracleInputResolvers('setup-example', [resolver('setup-input')]));
  assert.throws(() => registerOracleInputResolvers([resolver('setup-input')]), /already registered/u);
  assert.throws(() => setupOracleInputResolvers('retry-owner', [resolver('retry-input'), resolver('setup-input')]), /already registered/u);
  await assert.rejects(assertPinnedInputs([{ path: 'retry-input' }]), /0 found/u);
  assert.doesNotThrow(() => setupOracleInputResolvers('retry-owner', [resolver('retry-input')]));
  await assert.rejects(assertPinnedInputs([{ path: 'retry-input' }]), MissingSourceInputError);
  assert.throws(() => registerOracleInputResolvers([resolver('same-batch'), resolver('same-batch')]), /already registered/u);
  await assert.rejects(assertPinnedInputs([{ path: 'same-batch' }]), /0 found/u);
});

it('owner verifiers receive kernel callbacks and propagate pin failures', async () => {
  registerOracleInputResolvers([{ id: 'test-bank', accepts: path => path === 'test-bank/input', verify: async (_input, bank) => {
    if (!bank) throw new Error('owner requires bank');
    await bank('example-bank', ['example.file']);
  } }]);
  await assert.rejects(assertPinnedInputs([{ path: 'test-bank/input' }]), /owner requires bank/u);
  await assert.rejects(assertPinnedInputs([{ path: 'test-bank/input' }], async (set, kernels) => {
    assert.equal(set, 'example-bank'); assert.deepEqual(kernels, ['example.file']); throw new Error('bank rejected');
  }), /bank rejected/u);
});

it('the Python writer finds the module-relative root in source and distribution', () => {
  for (const path of ['packages/core/src/node/oracle/fixture.py', 'packages/core/dist/oracle/fixture.py']) {
    const result = spawnSync('python3', ['-c',
      'import runpy, sys, types; sys.modules["numpy"] = types.ModuleType("numpy"); print(runpy.run_path(sys.argv[1])["ROOT"])',
      resolve(root, path)], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), root);
  }
});

it('a fixture and its bytes resolve through the registered owner', async () => {
  const path = resolve(directory, 'input'), name = resolve(directory, 'fixture.json');
  await writeFile(path, 'abc');
  await writeFile(name, JSON.stringify({ schema: 'cssearth-oracle-fixture@1', oracle: 'example', generatedBy: 'owner/script', tool: {}, inputs: [{ path, bytes: 3 }], cases: {} }));
  const fixture = await readOracleFixture(name);
  assert.deepEqual(await readOracleInput(fixture.inputs[0]!), Buffer.from('abc'));
  await assert.rejects(readOracleInput({ path, bytes: 4 }), /source size differs/u);
});

it('both assertion and reading report missing inputs through the shared typed error', async () => {
  const path = resolve(directory, 'absent');
  for (const read of [assertPinnedInputs([{ path }]), readOracleInput({ path })]) {
    await assert.rejects(read, error => error instanceof MissingSourceInputError && error.message.includes(path));
  }
  await rm(directory, { recursive: true, force: true });
});

it('source and built runners read owner registrations without domain literals', () => {
  for (const path of ['packages/core/src/node/oracle/run.mts', 'packages/core/dist/oracle/run.js']) {
    const result = spawnSync(process.execPath, [resolve(root, path), '__unknown__'], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /Unknown oracle __unknown__; known:/u);
    assert.ok(!result.stderr.includes('ENOENT'));
  }
});

it('core production source contains no authored body ids', async () => {
  const ids = (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const escaped = ids.map(id => id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|');
  const bodyLiteral = new RegExp(`(?:['"/])(?:${escaped})(?:['"/.]|$)`, 'u');
  async function inspect(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await inspect(path);
      else if (/\.(?:ts|mts|py)$/u.test(entry.name) && !/\.test\./u.test(entry.name)) {
        assert.doesNotMatch(await readFile(path, 'utf8'), bodyLiteral, path);
      }
    }
  }
  await inspect(resolve(root, 'packages/core/src'));
});
