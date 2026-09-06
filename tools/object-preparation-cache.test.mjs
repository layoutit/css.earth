import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { objectPreparationFiles, runCachedPreparationObjects } from './prepare-planets.mjs';
import { fingerprintPreparationFiles } from './preparation-cache.mjs';

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
    await write('tools/objects/compiler.ts', '// shared compiler\n');
    await write('objects/preparation/mercury/runtime.json', {prepared:'fixture'});
    await run({ root, write, descriptor });
  } finally { await rm(root, { recursive: true, force: true }); }
}

const packageFiles = async () => ({
  inputs: [descriptorPath, 'tools/objects/compiler.ts'].sort(),
  outputs: [descriptorPath, payloadPath, 'objects/preparation/mercury/runtime.json'].sort(),
  inputKinds: {[descriptorPath]: 'object-descriptor-authored@1'},
});
test('authored closure binds source JSON and shared TypeScript compilers without object executables', async () => {
  const files = await objectPreparationFiles(repository, 'mercury');
  assert.equal(files.inputKinds[descriptorPath], 'object-descriptor-authored@1');
  for (const path of ['tools/objects/prepare-authored.ts', 'src/renderers/css/preparation/scene/index.ts',
    'src/planets/mercury/source/preparation/raster.json']) assert.ok(files.inputs.includes(path), path);
  assert.ok(files.outputs.includes(payloadPath));
  assert.ok(!files.inputs.some(path => /^src\/planets\/mercury\/(tools|runtime|site)\//.test(path)));
});

test('authored recipe and producer mutations rebuild; generated hash updates seal only verified outputs', async () => fixture(async ({ root, write, descriptor }) => {
  const runs = [], options = {
    projectRoot: root, objectIds: ['mercury'], packageFiles, sharedFiles: async () => [], environment: async () => ({ version: 'fixture' }),
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
  const files = await packageFiles();
  const original = await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), original);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 1);

  const modified = JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'));
  modified.properties.recipe.shape.radiusKm += 1;
  await write(descriptorPath, modified);
  assert.notDeepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), original);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  await write('tools/objects/compiler.ts', '// changed producer\n');
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
  assert.equal(descriptor.properties.recipe.schema, 'cssearth-authored-object@1');
}));

test('a descriptor edit during preparation cannot be sealed as an unchanged authored input', async () => fixture(async ({ root, write }) => {
  await assert.rejects(runCachedPreparationObjects({ projectRoot: root, objectIds: ['mercury'], packageFiles,
    sharedFiles: async () => [], environment: async () => ({}), onEvent() {},
    async schedule({ runCommand }) { await runCommand({ id: 'mercury' }); },
    async runCommand() {
      const current = JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8'));
      current.properties.recipe.shape.radiusKm += 1;
      await write(descriptorPath, current);
      return { exitCode: 0, signal: null };
    },
  }), /inputs changed during generation/);
}));
