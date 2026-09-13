import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authorSourceRecords, PLACEHOLDER_REVISION } from './author-source-records.mts';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'author-records-'));
  await mkdir(join(root, 'src/objects/rock/source/content'), { recursive: true });
  await mkdir(join(root, 'src/sources'), { recursive: true });
  await writeFile(join(root, 'src/objects/rock/source/content/object.json'), JSON.stringify({ displayName: 'Rock' }));
  await writeFile(join(root, 'src/sources/source-rock-shape.json'), JSON.stringify({ id: 'source-rock-shape', kind: 'model', identityLevel: 'work', title: 'Rock · shape', identifiers: [], links: [{ role: 'landing', url: 'https://archive.example/rock.obj', label: 'Source' }],
    evidence: [{ path: 'src/objects/rock/source/manifest.json', revision: 'a'.repeat(40), sha256: 'b'.repeat(64), locator: '/inputs/0' }], relations: [], statements: [] }, null, 2) + '\n');
  const manifest = { inputs: [
    { id: 'shape', path: 'shape/rock.obj', expectedBytes: 1, expectedSha256: 'c'.repeat(64), sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'source-rock-shape', role: 'material', evidence: `src/objects/rock/source/manifest.json@${'a'.repeat(40)}#/inputs/0` }] } },
    { id: 'frame-01', path: 'observations/frame-01.fits', expectedBytes: 2, expectedSha256: 'd'.repeat(64), origin: 'https://archive.example/frame-01.fits', productId: 'urn:x:frame-01::1.0', credit: 'Agency/Team', license: 'Public data; retain the citation.' },
    { id: 'frame-01-label', path: 'observations/frame-01.xml', expectedBytes: 3, expectedSha256: 'e'.repeat(64), origin: 'https://archive.example/frame-01.xml', productId: 'urn:x:frame-01::1.0' }],
    generatedIntermediates: [], documents: [] };
  await writeFile(join(root, 'src/objects/rock/source/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return root;
}

test('unbound inputs get catalogued bindings and records with placeholder evidence; existing records are untouched', async () => {
  const root = await fixture();
  try {
    const result = await authorSourceRecords({ root, objectId: 'rock' });
    assert.deepEqual(result, { bindings: ['frame-01', 'frame-01-label'], records: ['source-rock-frame-01', 'source-rock-frame-01-label'], pinned: [] });
    const manifest = JSON.parse(await readFile(join(root, 'src/objects/rock/source/manifest.json'), 'utf8'));
    assert.deepEqual(manifest.inputs[1].sourceBinding, { kind: 'catalogued', references: [{ catalogueId: 'source-rock-frame-01', role: 'material', evidence: `src/objects/rock/source/manifest.json@${PLACEHOLDER_REVISION}#/inputs/1` }] });
    const record = JSON.parse(await readFile(join(root, 'src/sources/source-rock-frame-01.json'), 'utf8'));
    assert.equal(record.title, 'Rock · frame 01');
    assert.deepEqual(record.identifiers, [], 'a product id shared by the cube and its label identifies neither record alone');
    assert.deepEqual(record.links, [{ role: 'landing', url: 'https://archive.example/frame-01.fits', label: 'Source' }]);
    assert.deepEqual(record.statements.map((statement: { kind: string }) => statement.kind), ['credit', 'rights']);
    assert.equal(record.evidence[0].revision, PLACEHOLDER_REVISION);
    const shape = JSON.parse(await readFile(join(root, 'src/sources/source-rock-shape.json'), 'utf8'));
    assert.equal(shape.evidence[0].revision, 'a'.repeat(40));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('placeholder evidence is pinned to the manifest bytes of the given revision, in the bindings and the records', async () => {
  const root = await fixture();
  try {
    await authorSourceRecords({ root, objectId: 'rock' });
    const committed = Buffer.from('{"inputs":[]}\n'), revision = 'f'.repeat(40);
    const result = await authorSourceRecords({ root, objectId: 'rock', evidence: revision, manifestAt: async (rev, path) => { assert.equal(rev, revision); assert.equal(path, 'src/objects/rock/source/manifest.json'); return committed; } });
    assert.deepEqual(result.pinned, ['source-rock-frame-01', 'source-rock-frame-01-label']);
    const manifest = JSON.parse(await readFile(join(root, 'src/objects/rock/source/manifest.json'), 'utf8'));
    assert.equal(manifest.inputs[2].sourceBinding.references[0].evidence, `src/objects/rock/source/manifest.json@${revision}#/inputs/2`);
    const record = JSON.parse(await readFile(join(root, 'src/sources/source-rock-frame-01-label.json'), 'utf8'));
    assert.deepEqual(record.evidence, [{ path: 'src/objects/rock/source/manifest.json', revision, sha256: createHash('sha256').update(committed).digest('hex'), locator: '/inputs/2' }]);
    assert.deepEqual(await authorSourceRecords({ root, objectId: 'rock', evidence: revision, manifestAt: async () => committed }), { bindings: [], records: [], pinned: [] }, 'pinned evidence is never rewritten');
    await assert.rejects(authorSourceRecords({ root, objectId: 'rock', evidence: 'short', manifestAt: async () => committed }), /40-character/);
    const manifestPath = join(root, 'src/objects/rock/source/manifest.json'), current = JSON.parse(await readFile(manifestPath, 'utf8'));
    current.inputs.push({ id: 'orphan', path: 'x/orphan.bin', expectedBytes: 1, expectedSha256: 'a'.repeat(64) });
    await writeFile(manifestPath, JSON.stringify(current, null, 2) + '\n');
    await assert.rejects(authorSourceRecords({ root, objectId: 'rock' }), /orphan has no origin URL/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('placeholder evidence of a publication cited by a document is pinned only for that manifest and locator', async () => {
  const root = await fixture();
  try {
    const manifestPath = join(root, 'src/objects/rock/source/manifest.json'), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.documents.push({ path: 'photometry/model.json', expectedBytes: 1, expectedSha256: 'a'.repeat(64),
      sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'doi-10-1000-rock', role: 'method', evidence: 'Table 2 prints the parameters.', locator: 'Table 2' }] } });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const own = { path: 'src/objects/rock/source/manifest.json', revision: PLACEHOLDER_REVISION, sha256: '0'.repeat(64), locator: '/documents/0' };
    const other = { path: 'src/objects/pebble/source/manifest.json', revision: PLACEHOLDER_REVISION, sha256: '0'.repeat(64), locator: '/documents/0' };
    await writeFile(join(root, 'src/sources/doi-10-1000-rock.json'), JSON.stringify({ id: 'doi-10-1000-rock', kind: 'publication', identityLevel: 'work', title: 'Rock photometry',
      identifiers: [{ type: 'DOI', value: '10.1000/rock' }], links: [{ role: 'landing', url: 'https://doi.org/10.1000/rock', label: 'Source' }], evidence: [own, other], relations: [], statements: [] }, null, 2) + '\n');
    const committed = Buffer.from('{"documents":[]}\n'), revision = 'f'.repeat(40);
    const result = await authorSourceRecords({ root, objectId: 'rock', evidence: revision, manifestAt: async () => committed });
    assert.ok(result.pinned.includes('doi-10-1000-rock'));
    const record = JSON.parse(await readFile(join(root, 'src/sources/doi-10-1000-rock.json'), 'utf8'));
    assert.deepEqual(record.evidence, [{ ...own, revision, sha256: createHash('sha256').update(committed).digest('hex') }, other], "another body's placeholder waits for its own manifest");
    manifest.documents[0].sourceBinding.references[0].catalogueId = 'doi-10-1000-missing';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    await assert.rejects(authorSourceRecords({ root, objectId: 'rock', evidence: revision, manifestAt: async () => committed }), /has no catalogue record/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
