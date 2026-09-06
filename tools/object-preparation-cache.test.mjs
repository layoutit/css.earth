import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { objectPreparationFiles, runCachedPreparationObjects } from './prepare-planets.mjs';
import { fingerprintPreparationFiles } from './preparation-cache.mjs';
import { resolveObjectPreparation } from './object-preparation.mjs';

const repository = resolve(import.meta.dirname, '..'), descriptorPath = 'src/planets/mercury/object.json';
const payloadPath = 'objects/prepared/mercury.json';
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'object-preparation-cache-'));
  const write = async (path, value) => {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  try {
    const descriptor = JSON.parse(await readFile(resolve(repository, descriptorPath), 'utf8'));
    await write(descriptorPath, descriptor);
    await write(payloadPath, { prepared: 'fixture' });
    for (const path of ['src/planets/mercury/tools/prepare.mjs', 'tools/object-preparation.mjs', 'src/platform/preparation-runner.mjs']) {
      await write(path, await readFile(resolve(repository, path), 'utf8'));
    }
    const plan = resolveObjectPreparation(descriptor, { projectRoot: root });
    for (const [script] of plan.steps) await write(resolve(plan.toolDirectory, script), '// prepared producer\n');
    await write('src/planets/mercury/source/manifest.json', { generatedIntermediates: [] });
    await write('src/planets/mercury/site/control-content.source.mjs', 'export const objectControls = {};');
    await write('src/planets/mercury/runtime/preparedOutput.mjs', 'export const prepared = {};');
    await run({ root, write, descriptor });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('bridge closure fingerprints the descriptor, shared dispatch and every resolved producer', async () => fixture(async ({ root }) => {
  const files = await objectPreparationFiles(root, 'mercury');
  assert.equal(files.inputKinds[descriptorPath], 'object-descriptor-authored@1');
  assert.ok(files.inputs.includes(descriptorPath));
  assert.ok(files.outputs.includes(descriptorPath));
  assert.ok(files.outputs.includes(payloadPath));
  for (const path of ['tools/object-preparation.mjs', 'src/platform/preparation-runner.mjs',
    'src/planets/mercury/tools/verify-source-manifest.mjs', 'src/planets/mercury/tools/prepare-system-markers.mjs',
    'tools/prepare-object-controls.mjs', 'src/planets/mercury/tools/prepare-runtime-asset-manifest.mjs']) {
    assert.ok(files.inputs.includes(path), `Missing executed preparation dependency: ${path}`);
  }
}));

test('authored recipe and producer mutations rebuild; generated hash updates seal only verified outputs', async () => fixture(async ({ root, write, descriptor }) => {
  const runs = [], options = {
    projectRoot: root, objectIds: ['mercury'], sharedFiles: async () => [], environment: async () => ({ version: 'fixture' }),
    onEvent() {},
    async schedule({ objectIds, runCommand }) {
      for (const id of objectIds) await runCommand({ id });
      return { results: objectIds };
    },
    async runCommand({ id }) {
      runs.push(id);
      const current = JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'));
      await write(descriptorPath, { ...current, prepared: { ...current.prepared, sha256: '1'.repeat(64) } });
      await write(payloadPath, { prepared: 'fixture' });
      return { exitCode: 0, signal: null };
    },
  };
  const files = await objectPreparationFiles(root, 'mercury');
  const original = await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), original);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 1);

  const modified = JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'));
  modified.properties.preparation.steps = modified.properties.preparation.steps.filter(step => step !== 'system-markers');
  await write(descriptorPath, modified);
  assert.notDeepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), original);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  await write('src/planets/mercury/tools/prepare-title.mjs', '// changed producer\n');
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);

  const stable = await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds);
  const damaged = JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'));
  damaged.prepared.sha256 = '2'.repeat(64);
  await write(descriptorPath, damaged);
  assert.deepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), stable);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 4);
  await rm(resolve(root, payloadPath));
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 5);
  assert.equal(descriptor.properties.preparation.steps.includes('system-markers'), true);
}));

test('a descriptor edit during preparation cannot be sealed as an unchanged authored input', async () => fixture(async ({ root, write }) => {
  await assert.rejects(runCachedPreparationObjects({ projectRoot: root, objectIds: ['mercury'],
    sharedFiles: async () => [], environment: async () => ({}), onEvent() {},
    async schedule({ runCommand }) { await runCommand({ id: 'mercury' }); },
    async runCommand() {
      const current = JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'));
      current.properties.preparation.label = 'Changed during generation';
      await write(descriptorPath, current);
      return { exitCode: 0, signal: null };
    },
  }), /inputs changed during generation/);
}));
