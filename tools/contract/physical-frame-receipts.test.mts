import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { auditPhysicalFrameReceipts } from '../ci/check-object-runtime-ownership.mts';
import { requireArray, requireRecord, requireString } from '../sources/source-values.mts';

// Tracked files only: this runs in the contract-lint job before any prepared asset is restored.
const root = resolve(import.meta.dirname, '../..');
const readText = (path: string) => readFile(path, 'utf8');

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

test('every registered object has a current physical frame receipt and declared recipe sources', async () => {
  const { receipts, failures } = await auditPhysicalFrameReceipts({ root });
  assert.deepEqual(failures, []);
  assert.equal(receipts, SCENE_OBJECTS.length);
});

test('a recipe source the manifest does not declare is reported', async () => {
  const fixture = await bodyFixture();
  const manifest = requireRecord(JSON.parse(await readText(fixture.manifestPath)));
  for (const key of ['inputs', 'documents', 'generatedIntermediates']) manifest[key] = requireArray(manifest[key] ?? []).filter(value => requireRecord(value).path !== fixture.manifestEntry);
  const { failures } = await auditPhysicalFrameReceipts({ root, objects: [fixture.object],
    readText: overlay({ [fixture.manifestPath]: JSON.stringify(manifest) }) });
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /not declared in the manifest/);
});

test('a descriptor frame that no longer matches the receipt is reported', async () => {
  const fixture = await bodyFixture();
  const descriptor = structuredClone(fixture.descriptor);
  const frame = requireRecord(requireRecord(descriptor.properties).worldFrame);
  frame.bodyRadiusM = Number(frame.bodyRadiusM) + 1;
  const { failures } = await auditPhysicalFrameReceipts({ root, objects: [fixture.object],
    readText: overlay({ [resolve(fixture.directory, 'object.json')]: JSON.stringify(descriptor) }) });
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /physical frame receipt differs/);
});

test('every object is checked and every failure is reported, not only the first', async () => {
  const objects = SCENE_OBJECTS.slice(0, 2);
  const { failures } = await auditPhysicalFrameReceipts({ root, objects, readText: async path => path.endsWith('object.json') ? '{' : readText(path) });
  assert.equal(failures.length, objects.length);
});
