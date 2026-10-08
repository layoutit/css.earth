/** Which leads a page's ledger settles (read.mts), offline. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { identifiers, markOf, readMarks } from './read.mts';

test('a text\'s DOIs and arXiv numbers are its identifiers, however they are written', () => {
  assert.deepEqual(identifiers('See https://arxiv.org/abs/2503.12521 and arXiv:2104.12078, (doi:10.3847/1538-3881/adc0a4).'), ['10.3847/1538-3881/adc0a4', 'arxiv:2503.12521', 'arxiv:2104.12078']);
  assert.deepEqual(identifiers('10.48550/arXiv.2412.03411'), ['10.48550/arxiv.2412.03411', 'arxiv:2412.03411'], 'an arXiv DOI is its number too');
  assert.deepEqual(identifiers('Lendl et al. 2020, 2020A&A...643A..94L'), []);
});

test('a lead is read when an entry of the page\'s ledger names it; a body with no ledger has read nothing', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'read-'));
  try {
    await mkdir(resolve(root, 'src/objects/planet-b'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/planet-b/investigations.json'), JSON.stringify({ schema: 'cssearth-investigation-ledger@1', objectId: 'planet-b', entries: [
      { id: 'radius', subject: 'Radius', status: 'included', finding: '1.2 Jupiter radii.', evidence: ['https://ui.adsabs.harvard.edu/abs/2020A&A...643A..94L/abstract'] },
      { id: 'published-phase-curves', subject: 'Published phase curves', status: 'excluded', finding: 'The night side is negative; see also doi:10.1051/0004-6361/202243344.', revisitWhen: 'A paper prints a night side.', evidence: ['https://arxiv.org/abs/2512.05175'] }] }));
    const marks = await readMarks(root, 'planet-b');
    assert.deepEqual(markOf('10.48550/arxiv.2512.05175', marks), { status: 'excluded', entry: 'published-phase-curves' });
    assert.deepEqual(markOf('10.1051/0004-6361/202243344', marks), { status: 'excluded', entry: 'published-phase-curves' }, 'a finding names a paper as its evidence does');
    assert.equal(markOf('10.48550/arxiv.2201.04518', marks), undefined);
    assert.equal((await readMarks(root, 'no-such-body')).size, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the checkout\'s own ledgers read: WASP-189 b\'s two phase-curve papers are settled, with the entry that says why', async () => {
  const marks = await readMarks(WORKSPACE, 'wasp-189b');
  assert.deepEqual(markOf('10.48550/arxiv.2512.05175', marks), { status: 'excluded', entry: 'published-phase-curves' });
  assert.deepEqual(markOf('10.48550/arxiv.2201.04518', marks), { status: 'excluded', entry: 'published-phase-curves' });
});
