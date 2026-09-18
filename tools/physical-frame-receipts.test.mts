import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { sha256 } from '../src/platform/sha256.mts';
import { auditPhysicalFrameReceipts } from './check-object-runtime-ownership.mts';
import { requireArray, requireRecord, requireString } from './source-values.mts';

// Tracked files only: this runs in the contract-lint job before any prepared asset is restored.
const root = resolve(import.meta.dirname, '..');
const readText = (path: string) => readFile(path, 'utf8');
const noStalePins = async () => [];

async function bodyFixture() {
  for (const object of SCENE_OBJECTS) {
    const directory = resolve(root, 'src/objects', object.id);
    const descriptor = requireRecord(JSON.parse(await readText(resolve(directory, 'object.json'))));
    const recipe = requireRecord(requireRecord(descriptor.properties).recipe);
    const sources = requireArray(recipe.sources).map(value => requireRecord(value));
    if (sources.some(source => source.id === 'world-context')) continue;
    const source = sources[0]!;
    return { object, directory, descriptor, sourcePath: resolve(directory, requireString(source.path)), manifestPath: resolve(directory, 'source/manifest.json'),
      manifestEntry: requireString(source.path).replace(/^source\//u, '') };
  }
  throw new Error('The registry contains no body with a numerical publication stage.');
}

function overlay(files: Record<string, string>) {
  return (path: string) => Object.hasOwn(files, path) ? Promise.resolve(files[path]!) : readText(path);
}

test('every registered object has a current physical frame receipt, source pins and document pins', async () => {
  const { receipts, failures } = await auditPhysicalFrameReceipts({ root });
  assert.deepEqual(failures, []);
  assert.equal(receipts, SCENE_OBJECTS.length);
});

test('a source repinned in the manifest without refreshing the receipt is reported as a stale receipt', async () => {
  const fixture = await bodyFixture();
  const edited = `${await readText(fixture.sourcePath)}\n`;
  const manifest = requireRecord(JSON.parse(await readText(fixture.manifestPath)));
  const record = ['inputs', 'documents', 'generatedIntermediates'].flatMap(key => requireArray(manifest[key] ?? []).map(value => requireRecord(value)))
    .find(entry => entry.path === fixture.manifestEntry);
  assert.ok(record);
  record.expectedSha256 = sha256(edited);
  const { failures } = await auditPhysicalFrameReceipts({ root, objects: [fixture.object], stalePins: noStalePins,
    readText: overlay({ [fixture.sourcePath]: edited, [fixture.manifestPath]: JSON.stringify(manifest) }) });
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /receipt differs from its manifest source pins or descriptor/);
});

test('a recipe source that drifted from its manifest pin is reported', async () => {
  const fixture = await bodyFixture();
  const { failures } = await auditPhysicalFrameReceipts({ root, objects: [fixture.object], stalePins: noStalePins,
    readText: overlay({ [fixture.sourcePath]: `${await readText(fixture.sourcePath)}\n` }) });
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /Authored source digest drifted/);
});

test('a descriptor frame that no longer matches the receipt is reported', async () => {
  const fixture = await bodyFixture();
  const descriptor = structuredClone(fixture.descriptor);
  const frame = requireRecord(requireRecord(descriptor.properties).worldFrame);
  frame.bodyRadiusM = Number(frame.bodyRadiusM) + 1;
  const { failures } = await auditPhysicalFrameReceipts({ root, objects: [fixture.object], stalePins: noStalePins,
    readText: overlay({ [resolve(fixture.directory, 'object.json')]: JSON.stringify(descriptor) }) });
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /physical frame receipt differs/);
});

test('stale document pins are reported for every object, not only the first', async () => {
  const objects = SCENE_OBJECTS.slice(0, 2);
  const { failures } = await auditPhysicalFrameReceipts({ root, objects, stalePins: async directory => [{ file: 'source/manifest.json',
    path: `${directory.split('/').at(-1)}.md`, expectedBytes: 1, expectedSha256: '0'.repeat(64), previousSha256: '1'.repeat(64) }] });
  assert.deepEqual(failures, objects.map(object =>
    `${object.id}: stale pin in source/manifest.json for ${object.id}.md (run: pnpm pin:documents ${object.id})`));
});
