import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archivePage, authorSourceRecords, ENTRY_EVIDENCE } from '@cssearth/bake/sources';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'author-records-'));
  await mkdir(join(root, 'src/objects/rock/source/content'), { recursive: true });
  await mkdir(join(root, 'src/sources'), { recursive: true });
  await writeFile(join(root, 'src/objects/rock/source/content/object.json'), JSON.stringify({ displayName: 'Rock' }));
  await writeFile(join(root, 'src/sources/source-rock-shape.json'), JSON.stringify({ id: 'source-rock-shape', kind: 'model', identityLevel: 'work', title: 'Rock · shape', identifiers: [], links: [{ role: 'landing', url: 'https://archive.example/shapes/', label: 'Source page' }, { role: 'original', url: 'https://archive.example/rock.obj', label: 'Source file' }],
    evidence: [{ path: 'src/objects/rock/source/manifest.json', locator: '/inputs/0' }], relations: [], statements: [] }, null, 2) + '\n');
  const manifest = { inputs: [
    { id: 'shape', path: 'shape/rock.obj', sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'source-rock-shape', role: 'material', evidence: ENTRY_EVIDENCE }] } },
    { id: 'frame-01', path: 'observations/frame-01.fits', origin: 'https://archive.example/frame-01.fits', sourceUrl: 'https://archive.example/frames/', productId: 'urn:x:frame-01::1.0', credit: 'Agency/Team', license: 'Public data; retain the citation.' },
    { id: 'frame-01-label', path: 'observations/frame-01.xml', origin: 'https://archive.example/frame-01.xml', sourceUrl: 'https://archive.example/frames/', productId: 'urn:x:frame-01::1.0' }],
    generatedIntermediates: [], documents: [] };
  await writeFile(join(root, 'src/objects/rock/source/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return root;
}

test('unbound inputs get catalogued bindings and records that name the citing manifest entry; existing records are untouched', async () => {
  const root = await fixture();
  try {
    const result = await authorSourceRecords({ root, objectId: 'rock' });
    assert.deepEqual(result, { bindings: ['frame-01', 'frame-01-label'], records: ['source-rock-frame-01', 'source-rock-frame-01-label'] });
    const manifest = JSON.parse(await readFile(join(root, 'src/objects/rock/source/manifest.json'), 'utf8'));
    assert.deepEqual(manifest.inputs[1].sourceBinding, { kind: 'catalogued', references: [{ catalogueId: 'source-rock-frame-01', role: 'material', evidence: ENTRY_EVIDENCE }] });
    const record = JSON.parse(await readFile(join(root, 'src/sources/source-rock-frame-01.json'), 'utf8'));
    assert.equal(record.title, 'Rock · frame 01');
    assert.deepEqual(record.identifiers, [], 'a product id shared by the cube and its label identifies neither record alone');
    assert.deepEqual(record.links, [{ role: 'landing', url: 'https://archive.example/frames/', label: 'Source page' }, { role: 'original', url: 'https://archive.example/frame-01.fits', label: 'Source file' }],
      'a reader lands on the page that presents the file');
    assert.deepEqual(record.statements.map((statement: { kind: string }) => statement.kind), ['credit', 'rights']);
    assert.deepEqual(record.evidence, [{ path: 'src/objects/rock/source/manifest.json', locator: '/inputs/1' }]);
    const shape = JSON.parse(await readFile(join(root, 'src/sources/source-rock-shape.json'), 'utf8'));
    assert.deepEqual(shape.evidence, [{ path: 'src/objects/rock/source/manifest.json', locator: '/inputs/0' }]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a second pass changes nothing, and an input without an origin is refused', async () => {
  const root = await fixture();
  try {
    await authorSourceRecords({ root, objectId: 'rock' });
    const manifestPath = join(root, 'src/objects/rock/source/manifest.json'), before = await readFile(manifestPath, 'utf8');
    assert.deepEqual(await authorSourceRecords({ root, objectId: 'rock' }), { bindings: [], records: [] }, 'existing bindings and records are never rewritten');
    assert.equal(await readFile(manifestPath, 'utf8'), before);
    const current = JSON.parse(before);
    current.inputs.push({ id: 'orphan', path: 'x/orphan.bin' });
    await writeFile(manifestPath, JSON.stringify(current, null, 2) + '\n');
    await assert.rejects(authorSourceRecords({ root, objectId: 'rock' }), /orphan has no origin URL/);
    current.inputs[3] = { id: 'table', path: 'x/table.csv', origin: 'https://archive.example/table.csv' };
    await writeFile(manifestPath, JSON.stringify(current, null, 2) + '\n');
    await assert.rejects(authorSourceRecords({ root, objectId: 'rock' }), /table comes from a file, https:\/\/archive\.example\/table\.csv\. Record the page that presents it as the entry's sourceUrl/);
    current.inputs[3] = { id: 'paper', path: 'x/paper.json', origin: 'https://doi.org/10.1000/example' };
    await writeFile(manifestPath, JSON.stringify(current, null, 2) + '\n');
    assert.deepEqual((await authorSourceRecords({ root, objectId: 'rock' })).records, ['source-rock-paper']);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'src/sources/source-rock-paper.json'), 'utf8')).links, [{ role: 'landing', url: 'https://doi.org/10.1000/example', label: 'Source' }]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a document that cites a missing catalogue record is refused', async () => {
  const root = await fixture();
  try {
    const manifestPath = join(root, 'src/objects/rock/source/manifest.json'), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.documents.push({ path: 'photometry/model.json',
      sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'doi-10-1000-rock', role: 'method', evidence: 'Table 2 prints the parameters.', locator: 'Table 2' }] } });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const record = { id: 'doi-10-1000-rock', kind: 'publication', identityLevel: 'work', title: 'Rock photometry',
      identifiers: [{ type: 'DOI', value: '10.1000/rock' }], links: [{ role: 'landing', url: 'https://doi.org/10.1000/rock', label: 'Source' }],
      evidence: [{ path: 'src/objects/rock/source/manifest.json', locator: '/documents/0' }], relations: [], statements: [] };
    const recordPath = join(root, 'src/sources/doi-10-1000-rock.json'), text = JSON.stringify(record, null, 2) + '\n';
    await writeFile(recordPath, text);
    await authorSourceRecords({ root, objectId: 'rock' });
    assert.equal(await readFile(recordPath, 'utf8'), text, 'a hand-authored record is never rewritten');
    manifest.documents[0].sourceBinding.references[0].catalogueId = 'doi-10-1000-missing';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    await assert.rejects(authorSourceRecords({ root, objectId: 'rock' }), /has no catalogue record/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an archive whose addresses name their page needs no sourceUrl: a query service, a deposited file, a raw repository file', async () => {
  for (const [address, page] of [
    ['https://gea.esac.esa.int/tap-server/tap/sync', 'https://gea.esac.esa.int/archive/'],
    ['https://gea.esac.esa.int/data-server/data?RETRIEVAL_TYPE=XP_SAMPLED&ID=1&FORMAT=csv', 'https://gea.esac.esa.int/archive/'],
    ['https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/A%2BA/600/A30/tableab&-out.max=200', 'https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/A+A/600/A30'],
    ['https://vizier.cds.unistra.fr/viz-bin/asu-tsv', 'https://vizier.cds.unistra.fr/viz-bin/VizieR'],
    ['https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%27-32%27', 'https://ssd.jpl.nasa.gov/horizons/'],
    ['https://zenodo.org/records/5627945/files/diagfi.nc?download=1', 'https://zenodo.org/records/5627945'],
    ['https://zenodo.org/api/records/4558194/files/diviner.tiff/content', 'https://zenodo.org/records/4558194'],
    ['https://raw.githubusercontent.com/owner/repository/abc123/data/frame.fits', 'https://github.com/owner/repository/blob/abc123/data/frame.fits'],
    ['https://arxiv.org/pdf/1612.00834', 'https://arxiv.org/abs/1612.00834'],
  ] as const) assert.equal(archivePage(address), page, address);
  assert.equal(archivePage('https://vizier.cds.unistra.fr/viz-bin/asu-tsv', { '-source': 'I/355/gaiadr3' }), 'https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/355');
  assert.equal(archivePage('https://archive.example/frame-01.fits'), undefined, 'an archive not listed names its page in sourceUrl');

  const root = await fixture();
  try {
    const manifestPath = join(root, 'src/objects/rock/source/manifest.json'), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.inputs = [manifest.inputs[0], { id: 'limb', path: 'photometry/limb.tsv', origin: 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv', credit: 'Claret & Bloemen (2011)' },
      { id: 'row', path: 'photometry/row.csv', origin: 'https://gea.esac.esa.int/tap-server/tap/sync' }];
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    await mkdir(join(root, 'src/objects/rock/source/preparation'), { recursive: true });
    await writeFile(join(root, 'src/objects/rock/source/preparation/acquisition.json'), JSON.stringify({ operations: [
      { kind: 'request-download', path: 'photometry/limb.tsv', url: 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv', form: { '-source': 'J/A+A/529/A75/table-af', '-out.max': '500' } }] }));
    assert.deepEqual((await authorSourceRecords({ root, objectId: 'rock' })).records, ['source-rock-limb', 'source-rock-row']);
    const links = async (id: string) => JSON.parse(await readFile(join(root, `src/sources/${id}.json`), 'utf8')).links;
    assert.deepEqual(await links('source-rock-limb'), [{ role: 'landing', url: 'https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/A+A/529/A75', label: 'Source page' },
      { role: 'original', url: 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv', label: 'Source file' }], 'the request recorded for the entry names the catalogue');
    assert.deepEqual((await links('source-rock-row'))[0], { role: 'landing', url: 'https://gea.esac.esa.int/archive/', label: 'Source page' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
