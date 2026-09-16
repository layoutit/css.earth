import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinManifestsReferencing, pinObjectDocuments } from './pin-object-documents.mts';

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
  return { root, recipe };
}

test('stale document pins are refreshed in the manifest, current ones are untouched', async () => {
  const { root, recipe } = await fixture();
  try {
    const checked = await pinObjectDocuments(root, { write: false });
    assert.deepEqual(checked.map(change => [change.file, change.path]), [['source/manifest.json', 'preparation/terrestrial.json']]);
    assert.equal(JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).documents[0].expectedSha256, '0'.repeat(64), 'check mode writes nothing');
    const changes = await pinObjectDocuments(root);
    assert.equal(changes.length, 1);
    const manifest = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8'));
    assert.deepEqual(manifest.documents[0], { path: 'preparation/terrestrial.json', expectedBytes: recipe.length, expectedSha256: sha(recipe) });
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
    assert.deepEqual((await pinObjectDocuments(root)).map(change => change.path), ['shape/model.json']);
    const inputs = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).inputs;
    assert.equal(inputs[0].expectedSha256, sha('model.json edited\n'));
    assert.deepEqual([inputs[1].expectedSha256, inputs[2].expectedSha256], ['0'.repeat(64), '0'.repeat(64)]);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('a marker recipe that still copies its manifest record is reduced to its source path, and the manifest repins it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pin-marker-'));
  try {
    await mkdir(join(root, 'source/preparation'), { recursive: true });
    const copy = { path: 'presentation/context.png', expectedBytes: 4, expectedSha256: '0'.repeat(64), origin: 'https://example.org', credit: 'Paper', license: 'MIT', raster: { kind: 'isis3-float-monochrome' } };
    const stale = JSON.stringify({ schema: 'cssearth-navigation-marker@1', source: copy }, null, 2) + '\n';
    await writeFile(join(root, 'source/preparation/navigation.json'), stale);
    await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [], documents: [
      { path: 'preparation/navigation.json', expectedBytes: stale.length, expectedSha256: sha(stale) }] }, null, 2) + '\n');
    const checked = await pinObjectDocuments(root, { write: false });
    assert.deepEqual(checked.map(change => change.file), ['source/preparation/navigation.json', 'source/manifest.json']);
    assert.equal(await readFile(join(root, 'source/preparation/navigation.json'), 'utf8'), stale, 'check mode writes nothing');
    await pinObjectDocuments(root);
    const lean = await readFile(join(root, 'source/preparation/navigation.json'), 'utf8');
    assert.deepEqual(JSON.parse(lean).source, { path: 'presentation/context.png', raster: { kind: 'isis3-float-monochrome' } }, "decoding hints stay; the record is the manifest's");
    assert.equal(JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).documents[0].expectedSha256, sha(lean));
    assert.deepEqual(await pinObjectDocuments(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('generated intermediates and tool-written inputs are repinned; a download is adopted only once, on request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pin-generated-'));
  try {
    await mkdir(join(root, 'source/observations'), { recursive: true }); await mkdir(join(root, 'source/preparation'), { recursive: true });
    const plan = '{"operations":[{"kind":"download","path":"observations/new.fits"},{"kind":"download","path":"observations/old.fits"}]}\n';
    await writeFile(join(root, 'source/preparation/acquisition.json'), plan);
    for (const name of ['marker.png', 'sphere.tab', 'new.fits', 'old.fits']) await writeFile(join(root, 'source/observations', name), `${name} bytes\n`);
    const placeholder = { expectedBytes: 1, expectedSha256: '0'.repeat(64) };
    await writeFile(join(root, 'source/manifest.json'), JSON.stringify({
      inputs: [
        { path: 'observations/sphere.tab', ...placeholder, recipe: { generator: 'tools/author.mts' }, sourceBinding: { kind: 'catalogued' } },
        { path: 'observations/new.fits', ...placeholder, sourceBinding: { kind: 'catalogued' } },
        { path: 'observations/old.fits', expectedBytes: 3, expectedSha256: 'a'.repeat(64), sourceBinding: { kind: 'catalogued' } }],
      generatedIntermediates: [{ path: 'observations/marker.png', ...placeholder }],
      documents: [{ path: 'preparation/acquisition.json', expectedBytes: plan.length, expectedSha256: sha(plan) }] }, null, 2) + '\n');
    assert.deepEqual((await pinObjectDocuments(root)).map(change => change.path).sort(), ['observations/marker.png', 'observations/sphere.tab']);
    assert.deepEqual((await pinObjectDocuments(root, { adoptDownloads: true })).map(change => change.path), ['observations/new.fits'], 'only the placeholder download is adopted');
    const inputs = JSON.parse(await readFile(join(root, 'source/manifest.json'), 'utf8')).inputs;
    assert.equal(inputs[1].expectedSha256, sha('new.fits bytes\n'));
    assert.equal(inputs[2].expectedSha256, 'a'.repeat(64), 'a real upstream pin is never overwritten');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a manifest that pins a repository output by its repository path follows that output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pin-referencing-'));
  try {
    await mkdir(join(root, 'src/objects/sun/prepared'), { recursive: true }); await mkdir(join(root, 'src/objects/context/source'), { recursive: true });
    await mkdir(join(root, 'src/objects/other/source'), { recursive: true });
    await writeFile(join(root, 'src/objects/sun/prepared/world-context.json'), '{"bodies":["new-star"]}\n');
    const entry = { id: 'navigation-frame', path: 'src/objects/sun/prepared/world-context.json', expectedBytes: 3, expectedSha256: 'b'.repeat(64) };
    await writeFile(join(root, 'src/objects/context/source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [entry], documents: [] }, null, 2) + '\n');
    await writeFile(join(root, 'src/objects/other/source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [], documents: [] }, null, 2) + '\n');
    const changes = await pinManifestsReferencing(root, 'src/objects/sun/prepared/world-context.json');
    assert.deepEqual(changes.map(change => [change.objectId, change.path]), [['context', 'src/objects/sun/prepared/world-context.json']]);
    const pinned = JSON.parse(await readFile(join(root, 'src/objects/context/source/manifest.json'), 'utf8')).generatedIntermediates[0];
    assert.equal(pinned.expectedSha256, sha('{"bodies":["new-star"]}\n'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
