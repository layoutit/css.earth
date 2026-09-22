import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { runCachedPreparationObjects } from './prepare-objects.mts';
import type { CachedPreparationOptions } from './prepare-objects.mts';
import { runObjectCommand } from '../cli/run-implemented-objects.mts';
import type { PreparationCommand, PreparationReport } from '../cli/run-implemented-objects.mts';
import { requireRecord } from '../sources/source-values.mts';

const repository = resolve(import.meta.dirname, '../..'), descriptorPath = 'src/objects/mercury/object.json';
const payloadPath = 'src/objects/mercury/prepared/object.json';
// Mirrors an authored preparation: read the descriptor, write the payload from its recipe, then pin the descriptor to
// the payload. Asked to, it also edits its own recipe while running.
const producer = `import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const descriptor = JSON.parse(readFileSync('${descriptorPath}', 'utf8'));
const payload = JSON.stringify({ radiusKm: descriptor.properties.recipe.shape.radiusKm });
mkdirSync('src/objects/mercury/prepared', { recursive: true });
writeFileSync('${payloadPath}', payload);
if (process.argv[2] === 'edit-recipe') descriptor.properties.recipe.shape.radiusKm += 1;
descriptor.prepared = { ...descriptor.prepared, sha256: createHash('sha256').update(payload).digest('hex') };
writeFileSync('${descriptorPath}', JSON.stringify(descriptor, null, 2) + '\\n');
`;
type Descriptor = Record<string, unknown> & { properties: Record<string, unknown> & { catalog: Record<string, unknown>; recipe: { shape: { radiusKm: number } } }; prepared: Record<string, unknown> };
type FixtureContext = { root: string; options: CachedPreparationOptions; runs: string[]; edit: (change: (descriptor: Descriptor) => void) => Promise<void> };

async function fixture(run: (context: FixtureContext) => Promise<void>, argumentsList: string[] = []) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'object-preparation-cache-')));
  try {
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(repository, descriptorPath), 'utf8')), 'Mercury descriptor');
    await mkdir(dirname(join(root, descriptorPath)), { recursive: true });
    await writeFile(join(root, descriptorPath), JSON.stringify(descriptor, null, 2) + '\n');
    await writeFile(join(root, 'producer.mjs'), producer);
    const runs: string[] = [];
    const options: CachedPreparationOptions = {
      projectRoot: root, objectIds: ['mercury'], sharedFiles: async () => [], environment: async () => ({ version: 'fixture' }), onEvent() {},
      async schedule({ objectIds = [], runCommand } = {}) {
        if (!runCommand) throw new TypeError('Fixture schedule requires its command runner.');
        for (const id of objectIds) {
          const outcome = await runCommand({ id, command: process.execPath, argumentsList: [], cwd: root });
          if (outcome.exitCode !== 0) throw new Error(`${id} failed`);
        }
        const report: PreparationReport = { mode: 'prepare', startedAt: 'fixture', requestedConcurrency: 1, concurrency: objectIds.length, elapsedMilliseconds: 0, results: [] };
        return report;
      },
      async runCommand({ id, env }: PreparationCommand) {
        runs.push(id);
        return runObjectCommand({ command: process.execPath, argumentsList: ['producer.mjs', ...argumentsList], cwd: root, env });
      },
    };
    const edit = async (change: (descriptor: Descriptor) => void) => {
      const value = JSON.parse(await readFile(join(root, descriptorPath), 'utf8'));
      change(value);
      await writeFile(join(root, descriptorPath), JSON.stringify(value, null, 2) + '\n');
    };
    await run({ root, options, runs, edit });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('an authored recipe edit rebuilds the object; its card and damaged pins are handled by owner', async () => fixture(async ({ root, options, runs, edit }) => {
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  await edit(descriptor => { descriptor.properties.catalog.description = 'A new card from prepare:text.'; });
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury'], 'reader text does not rebuild the object');
  await edit(descriptor => { descriptor.properties.recipe.shape.radiusKm += 1; });
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury']);
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  await rm(join(root, payloadPath));
  assert.deepEqual((await runCachedPreparationObjects(options)).rebuilt, ['mercury'], 'a missing payload rebuilds');
  assert.deepEqual((await runCachedPreparationObjects(options)).cached, ['mercury']);
  assert.equal(runs.length, 3);
}));

test('a descriptor edit during preparation cannot be sealed as an unchanged authored input', async () => fixture(async ({ root, options }) => {
  await assert.rejects(runCachedPreparationObjects(options), /inputs changed during generation: src\/objects\/mercury\/object\.json/);
  await assert.rejects(readFile(join(root, '.local/preparation/mercury.json')), { code: 'ENOENT' });
}, ['edit-recipe']));
