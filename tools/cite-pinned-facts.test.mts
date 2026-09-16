import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { citePinnedFacts, displayedValue, equalAtDisplayedPrecision, parseHorizonsElements } from './cite-pinned-facts.mts';

const ELEMENTS = [
  '# https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27588%3B%27&EPHEM_TYPE=ELEMENTS',
  'Start time      : A.D. 2026-Sep-03 00:00:00.0000 TDB',
  '            JDTDB,            Calendar Date (TDB),                     EC,                     QR,                      A,                     PR,',
  '$$SOE',
  '2461286.500000000, A.D. 2026-Sep-03 00:00:00.0000,  1.480262203421814E-01,  6.648240152588009E+08,  7.803338918784760E+08,  4.351420100615534E+03,',
  '$$EOE', '',
].join('\n');

test('displayed values keep their precision and unit', () => {
  assert.deepEqual(displayedValue('About 129,000 km'), { value: 129000, decimals: 0, unit: 'km' });
  assert.deepEqual(displayedValue('11.91 years'), { value: 11.91, decimals: 2, unit: 'year' });
  assert.equal(displayedValue('Assumed synchronous; poorly constrained'), null);
  assert.ok(equalAtDisplayedPrecision({ value: 5.216, decimals: 3, unit: 'au' }, 5.21625));
  assert.ok(!equalAtDisplayedPrecision({ value: 5.22, decimals: 2, unit: 'au' }, 5.2263));
});

test('a fact is cited only when it equals the pinned Horizons record at its displayed precision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-cite-facts-'));
  try {
    await mkdir(join(root, 'source/content'), { recursive: true });
    await mkdir(join(root, 'source/reference'), { recursive: true });
    await writeFile(join(root, 'source/reference/horizons-elements.txt'), ELEMENTS);
    await writeFile(join(root, 'source/manifest.json'), JSON.stringify({ inputs: [], documents: [{ path: 'reference/horizons-elements.txt', expectedBytes: 1, expectedSha256: 'x' }] }));
    const authored = { id: 'radius', label: 'Display reference radius', value: '65.5 km', source: { url: 'https://doi.org/x', label: 'Paper', checked: '2026-09-08', catalogueId: 'paper' } };
    const panel = { facts: [
      authored,
      { id: 'distance-from-sun', label: 'Solar semimajor axis', value: '5.216 AU' },
      { id: 'orbital-period', label: 'Orbital period', value: '11.91 years' },
      { id: 'perihelion', label: 'Perihelion', value: '4.40 AU' },
    ] };
    await writeFile(join(root, 'source/content/object.json'), JSON.stringify({ schema: 'cssearth-object-content@1', panel }));
    assert.deepEqual(await citePinnedFacts(root, { write: false }), ['distance-from-sun', 'orbital-period']);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'source/content/object.json'), 'utf8')).panel, panel, 'check mode writes nothing');
    assert.deepEqual(await citePinnedFacts(root), ['distance-from-sun', 'orbital-period']);
    const written = JSON.parse(await readFile(join(root, 'source/content/object.json'), 'utf8')).panel.facts;
    assert.deepEqual(written[0], authored, 'an authored citation is kept');
    assert.deepEqual(written[1].source, {
      url: 'https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27588%3B%27&EPHEM_TYPE=ELEMENTS', label: 'JPL Horizons, 2026-09-03 epoch',
      checked: '2026-09-16', path: 'source/reference/horizons-elements.txt', catalogueId: 'jpl-horizons', locator: '$$SOE first epoch; A (km) / 149597870.7',
    });
    assert.equal(written[2].source.locator, '$$SOE first epoch; PR (days) / 365.25');
    assert.equal(written[3].source, undefined, 'QR is 4.444 AU, so 4.40 AU came from elsewhere');
    assert.deepEqual(await citePinnedFacts(root), [], 'a second run finds nothing left to cite');
    assert.equal(parseHorizonsElements('no header'), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
