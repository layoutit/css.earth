import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinObjectDocuments } from './pin-object-documents.mts';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'pin-documents-'));
  await mkdir(join(root, 'source/preparation'), { recursive: true });
  const recipe = '{\n  "raster": {}\n}\n', plan = '{"operations":[]}\n';
  await writeFile(join(root, 'source/preparation/terrestrial.json'), recipe);
  await writeFile(join(root, 'source/preparation/acquisition.json'), plan);
  await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [], documents: [
    { path: 'preparation/terrestrial.json', expectedBytes: 1, expectedSha256: '0'.repeat(64) },
    { path: 'preparation/acquisition.json', expectedBytes: plan.length, expectedSha256: sha(plan) }] }, null, 2) + '\n');
  await writeFile(join(root, 'object.json'), JSON.stringify({ id: 'x', properties: { recipe: { sources: [
    { id: 'terrestrial', path: 'source/preparation/terrestrial.json', sha256: '0'.repeat(64) },
    { id: 'acquisition', path: 'source/preparation/acquisition.json', sha256: sha(plan) }] } } }, null, 2) + '\n');
  return { root, recipe };
}

test('stale document pins are refreshed in both the manifest and the descriptor, current ones are untouched', async () => {
  const { root, recipe } = await fixture();
  try {
    const checked = await pinObjectDocuments(root, { write: false });
    assert.deepEqual(checked.map(change => [change.file, change.path]), [['source/manifest.json', 'preparation/terrestrial.json'], ['object.json', 'source/preparation/terrestrial.json']]);
    assert.equal(JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).documents[0].expectedSha256, '0'.repeat(64), 'check mode writes nothing');
    const changes = await pinObjectDocuments(root);
    assert.equal(changes.length, 2);
    const manifest = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')), descriptor = JSON.parse(await readFile(join(root, 'object.json'), 'utf8'));
    assert.deepEqual(manifest.documents[0], { path: 'preparation/terrestrial.json', expectedBytes: recipe.length, expectedSha256: sha(recipe) });
    assert.equal(descriptor.properties.recipe.sources[0].sha256, sha(recipe));
    assert.equal(descriptor.properties.recipe.sources[1].sha256, sha('{"operations":[]}\n'));
    assert.deepEqual(await pinObjectDocuments(root), [], 'a second run finds nothing stale');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('authored local inputs are repinned; catalogued and downloaded inputs keep their upstream pins', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pin-inputs-'));
  try {
    await mkdir(join(root, 'source/shape'), { recursive: true }); await mkdir(join(root, 'source/preparation'), { recursive: true });
    const plan = '{"operations":[{"kind":"download","path":"shape/download.zip"}]}\n';
    await writeFile(join(root, 'source/preparation/acquisition.json'), plan);
    for (const name of ['model.json', 'catalogue.tab', 'download.zip']) await writeFile(join(root, 'source/shape', name), `${name} edited\n`);
    const stale = { expectedBytes: 1, expectedSha256: '0'.repeat(64) };
    await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ generatedIntermediates: [], inputs: [
      { path: 'shape/model.json', ...stale, sourceBinding: { kind: 'local', reason: 'authored' } },
      { path: 'shape/catalogue.tab', ...stale, sourceBinding: { kind: 'catalogued', record: 'x' } },
      { path: 'shape/download.zip', ...stale, sourceBinding: { kind: 'local', reason: 'awaiting its source record' } }],
    documents: [{ path: 'preparation/acquisition.json', expectedBytes: plan.length, expectedSha256: sha(plan) }] }, null, 2) + '\n');
    await writeFile(join(root, 'object.json'), JSON.stringify({ id: 'x', properties: { recipe: { sources: [] } } }) + '\n');
    assert.deepEqual((await pinObjectDocuments(root)).map(change => change.path), ['shape/model.json']);
    const inputs = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).inputs;
    assert.equal(inputs[0].expectedSha256, sha('model.json edited\n'));
    assert.deepEqual([inputs[1].expectedSha256, inputs[2].expectedSha256], ['0'.repeat(64), '0'.repeat(64)]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the navigation marker takes its source identity and attribution from the manifest record', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pin-navigation-'));
  try {
    await mkdir(join(root, 'source/preparation'), { recursive: true }); await mkdir(join(root, 'source/presentation'), { recursive: true });
    await writeFile(join(root, 'source/presentation/context.png'), 'regenerated');
    const record = { path: 'presentation/context.png', expectedBytes: 11, expectedSha256: sha('regenerated'), origin: 'https://example.org/shape', credit: 'Shape paper', license: 'MIT', acquisition: 'Reproduced from the ellipsoid record.', redistribution: 'Keep attribution.' };
    const navigation = { schema: 'cssearth-navigation-marker@1', source: { ...record, expectedBytes: 4, expectedSha256: '0'.repeat(64), acquisition: 'Reproduced from a retired mesh.', licenseEvidence: [] } };
    await writeFile(join(root, 'source/preparation/navigation.json'), JSON.stringify(navigation, null, 2) + '\n');
    await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [record], documents: [
      { path: 'preparation/navigation.json', expectedBytes: 1, expectedSha256: '0'.repeat(64) }] }, null, 2) + '\n');
    await writeFile(join(root, 'object.json'), JSON.stringify({ id: 'x', properties: { recipe: { sources: [
      { id: 'navigation', path: 'source/preparation/navigation.json', sha256: '0'.repeat(64) }] } } }, null, 2) + '\n');
    const checked = await pinObjectDocuments(root, { write: false });
    assert.deepEqual(checked.map(change => change.file), ['source/preparation/navigation.json', 'source/manifest.json', 'object.json']);
    assert.equal(JSON.parse(await readFile(join(root, 'source/preparation/navigation.json'), 'utf8')).source.expectedBytes, 4, 'check mode writes nothing');
    assert.deepEqual((await pinObjectDocuments(root)).map(change => change.file), checked.map(change => change.file));
    const written = await readFile(join(root, 'source/preparation/navigation.json'), 'utf8'), marker = JSON.parse(written).source;
    assert.deepEqual({ ...marker, licenseEvidence: undefined }, { ...record, licenseEvidence: undefined });
    assert.equal(JSON.parse(await readFile(join(root, 'object.json'), 'utf8')).properties.recipe.sources[0].sha256, sha(written), 'the descriptor pins the synchronised marker');
    assert.deepEqual(await pinObjectDocuments(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
