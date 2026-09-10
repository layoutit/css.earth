import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { objectPreparationFiles, runCachedPreparationObjects } from './prepare-planets.mts';
import { fingerprintPreparationFiles } from './preparation-cache.mts';
import type { CachedPreparationOptions, PreparationFileSet } from './prepare-planets.mts';
import type { PreparationCommand, PreparationReport } from './run-implemented-planets.mts';
import { requireRecord } from './source-values.mts';

const repository = resolve(import.meta.dirname, '..'), descriptorPath = 'src/planets/mercury/object.json';
const payloadPath = 'src/planets/mercury/prepared/object.json';
type FixtureContext = { root: string; write: (path: string, value: unknown) => Promise<void>; descriptor: Record<string, unknown> };
async function fixture(run: (context: FixtureContext) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'object-preparation-cache-'));
  const write = async (path: string, value: unknown): Promise<void> => {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  try {
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(repository, descriptorPath), 'utf8')), 'Mercury descriptor');
    await write(descriptorPath, descriptor);
    await write(payloadPath, { prepared: 'fixture' });
    await write('tools/objects/compiler.ts', '// shared compiler\n');
    await write('src/planets/mercury/prepared/runtime.json', {prepared:'fixture'});
    await run({ root, write, descriptor });
  } finally { await rm(root, { recursive: true, force: true }); }
}

const packageFiles = async (): Promise<PreparationFileSet> => ({
  inputs: [descriptorPath, 'tools/objects/compiler.ts'].sort(),
  outputs: [descriptorPath, payloadPath, 'src/planets/mercury/prepared/runtime.json'].sort(),
  inputKinds: {[descriptorPath]: 'object-descriptor-authored@1'} as const,
});
const scheduleFixture: NonNullable<CachedPreparationOptions['schedule']> = async (options = {}) => {
  const { objectIds = [], runCommand } = options;
  if (!runCommand) throw new TypeError('Fixture schedule requires its command runner.');
  for (const id of objectIds) await runCommand({ id, command: 'fixture', argumentsList: [], cwd: '' });
  const report: PreparationReport = { mode: 'prepare', startedAt: 'fixture', requestedConcurrency: 1, concurrency: objectIds.length, elapsedMilliseconds: 0, results: [] };
  return report;
};
test('authored closure binds source JSON and shared TypeScript compilers without object executables', async () => {
  const files = await objectPreparationFiles(repository, 'mercury');
  assert.equal(files.inputKinds?.[descriptorPath], 'object-descriptor-authored@1');
  for (const path of ['tools/objects/prepare-authored.ts', 'src/renderers/css/preparation/scene/index.ts',
    'src/planets/mercury/source/preparation/raster.json']) assert.ok(files.inputs.includes(path), path);
  assert.ok(files.outputs.includes(payloadPath));
  assert.ok(!files.inputs.some(path => /^src\/planets\/mercury\/(tools|runtime|site)\//.test(path)));
});

test('authored recipe and producer mutations rebuild; generated hash updates seal only verified outputs', async () => fixture(async ({ root, write, descriptor }) => {
  const runs = [], options = {
    projectRoot: root, objectIds: ['mercury'], packageFiles, sharedFiles: async () => [], environment: async () => ({ version: 'fixture' }),
    onEvent() {},
    schedule: scheduleFixture,
    async runCommand({ id }: PreparationCommand) {
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

  const modified = requireRecord(JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8')), 'modified Mercury descriptor');
  const modifiedRecipe = requireRecord(requireRecord(modified.properties, 'modified Mercury properties').recipe, 'modified Mercury recipe');
  requireRecord(requireRecord(modifiedRecipe.shape, 'modified Mercury shape'), 'modified Mercury shape').radiusKm = Number(requireRecord(modifiedRecipe.shape, 'modified Mercury shape').radiusKm) + 1;
  await write(descriptorPath, modified);
  assert.notDeepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), original);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  await write('tools/objects/compiler.ts', '// changed producer\n');
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);

  const stable = await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds);
  const damaged = requireRecord(JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8')), 'damaged Mercury descriptor');
  requireRecord(damaged.prepared, 'damaged Mercury prepared output').sha256 = '2'.repeat(64);
  await write(descriptorPath, damaged);
  assert.deepEqual(await fingerprintPreparationFiles(root, [descriptorPath], files.inputKinds), stable);
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 4);
  await rm(resolve(root, payloadPath));
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 5);
  assert.equal(requireRecord(requireRecord(descriptor.properties, 'Mercury properties').recipe, 'Mercury recipe').schema, 'cssearth-authored-object@1');
}));

test('a descriptor edit during preparation cannot be sealed as an unchanged authored input', async () => fixture(async ({ root, write }) => {
  await assert.rejects(runCachedPreparationObjects({ projectRoot: root, objectIds: ['mercury'], packageFiles,
    sharedFiles: async () => [], environment: async () => ({}), onEvent() {},
    schedule: scheduleFixture,
    async runCommand() {
      const current = requireRecord(JSON.parse(await readFile(resolve(root, descriptorPath), 'utf8')), 'current Mercury descriptor');
      const recipe = requireRecord(requireRecord(current.properties, 'current Mercury properties').recipe, 'current Mercury recipe');
      const shape = requireRecord(recipe.shape, 'current Mercury shape');
      shape.radiusKm = Number(shape.radiusKm) + 1;
      await write(descriptorPath, current);
      return { exitCode: 0, signal: null };
    },
  }), /inputs changed during generation/);
}));
