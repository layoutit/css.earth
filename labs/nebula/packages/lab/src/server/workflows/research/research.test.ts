import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { configuredLabObjects } from '../lab-objects.ts';
import { buildResearch, linkKey, readResearchRecord, readSourceIndex, RESEARCH_SCHEMA } from './research.ts';

const root = process.cwd();
const valid = () => ({ schema: RESEARCH_SCHEMA, id: 'cassiopeia-a-layers', name: 'Cassiopeia A', type: 'Supernova remnant',
  papers: [{ label: 'DeLaney et al. (2010)', url: 'https://arxiv.org/abs/1011.3858', record: 'src/sources/publication-delaney-2010-cassiopeia-a-3d.json' }],
  models: [], images: [], symmetry: { kind: 'published-surfaces', label: 'Published surfaces: shape' },
  velocity: { available: true, items: [{ label: 'Doppler table', kind: 'doppler-table', path: 'src/objects/cassiopeia-a-layers/source/ejecta-speeds.dat' }] },
  method: { chosen: 'paper-surfaces', status: 'published', available: ['paper-surfaces'], geometry: ['shape'] } });

test('research.json: the schema reads a whole record and refuses a wrong field', () => {
  assert.equal(readResearchRecord(valid()).papers[0]!.record, 'src/sources/publication-delaney-2010-cassiopeia-a-3d.json');
  const broken = (change: (record: ReturnType<typeof valid>) => void) => { const record = valid(); change(record); return record; };
  assert.throws(() => readResearchRecord(broken(record => { (record as { schema: string }).schema = 'other@1'; })), /Expected/);
  assert.throws(() => readResearchRecord(broken(record => { record.papers[0]!.record = 'labs/nebula/x.json'; })), /src\/sources record/);
  assert.throws(() => readResearchRecord(broken(record => { record.papers[0]!.url = 'ftp://example.org'; })), /web link or an object path/);
  assert.throws(() => readResearchRecord(broken(record => { record.velocity.available = false; })), /says whether/);
  assert.throws(() => readResearchRecord(broken(record => { (record.method as { chosen: string }).chosen = 'guess'; })), /method needs/);
  assert.throws(() => readResearchRecord(broken(record => { (record.symmetry as { kind: string }).kind = 'spherical'; })), /symmetry.kind/);
});

test('every site nebula keeps a research.json the schema reads, and each named record exists', async () => {
  const objects = configuredLabObjects(root), bySubject = new Map(objects.map(item => [item.subject, item]));
  const site = objects.filter(item => !item.parent || bySubject.get(item.parent)?.kind !== item.kind);
  assert.equal(site.length, 18, 'the 17 site nebulae, M1 counted for its volume and its plates');
  for (const object of site) {
    const record = readResearchRecord(JSON.parse(await readFile(`${object.object}/source/research.json`, 'utf8')));
    assert.equal(record.id, object.id);
    for (const item of [...record.papers, ...record.models, ...record.images]) if (item.record) await readFile(item.record);
  }
});

test('links name the same page whatever the arXiv view or DOI form', () => {
  assert.equal(linkKey('https://arxiv.org/html/2411.03825v1#S2'), linkKey('https://arxiv.org/abs/2411.03825'));
  assert.equal(linkKey('https://arxiv.org/pdf/astro-ph/0504295v1'), 'arxiv:astro-ph/0504295');
  assert.equal(linkKey('https://doi.org/10.1111/CGF.12216'), linkKey('https://doi.org/10.1111/cgf.12216'));
  assert.equal(linkKey('https://www.eso.org/public/images/eso1723a/'), 'eso.org/public/images/eso1723a');
});

test('Cas A research: the README rows meet their records, the recipe adds its geometry sources, the speed table is velocity', async () => {
  const object = configuredLabObjects(root).find(item => item.id === 'cassiopeia-a-layers')!;
  const record = await buildResearch(root, object, await readSourceIndex(root));
  assert.ok(record.papers.some(item => item.record === 'src/sources/publication-delaney-2010-cassiopeia-a-3d.json'));
  assert.ok(record.models.some(item => item.record === 'src/sources/chandra-cassiopeia-a-3d-model.json'));
  assert.ok(record.images.some(item => /weic2330a/.test(item.url)));
  assert.deepEqual(record.velocity.items.map(item => item.kind), ['doppler-table']);
  assert.deepEqual([record.method.chosen, record.method.status, record.symmetry.kind], ['paper-surfaces', 'published', 'published-surfaces']);
  readResearchRecord(record);
});
