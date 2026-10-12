import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStarSpec } from './spec.mts';
import { astronomyRecord } from './generate.mts';
import { fetchCatalogueRow, type Archive } from './archives/archives.mts';

const url = 'https://doi.org/10.1088/2041-8205/808/1/L3';
const position = { archive: 'paper', catalogue: '10.1088/2041-8205/808/1/L3',
  row: { ID: 'HL Tau · Band 6', RA: '04:31:38.42548', Dec: '+18:13:57.242', pmRA: '18.5', pmDec: '-22.3' },
  columns: { ra: 'RA', dec: 'Dec' }, motion: { epoch: 2014.83, ra: 'pmRA', dec: 'pmDec' },
  credit: 'ALMA Partnership (2015), Table 1 and Section 3.1.1', url };
const cited = { value: 1, source: 'fixture', url };
const star = { id: 'test-paper-star', name: 'Test Paper Star', parent: 'milky-way', description: 'Fixture.',
  paper: { url, credit: 'fixture' }, position, radius: cited, mass: cited, temperature: { ...cited, value: 4000 },
  distance: { ...cited, value: 140 }, radialVelocity: { ...cited, value: 0 } };
const archive: Archive = {
  text: async () => { throw new Error('A printed position must not ask an archive.'); },
  bytes: async () => { throw new Error('A printed position must not ask an archive.'); },
  exists: async () => { throw new Error('A printed position must not ask an archive.'); },
};

test('a printed radio position preserves its observing epoch and motion through the astronomy record', async () => {
  const spec = parseStarSpec(star);
  assert.ok(spec.position);
  const row = await fetchCatalogueRow(archive, spec.position, spec.id);
  assert.deepEqual([row.epoch, row.pmra, row.pmdec], [2014.83, 18.5, -22.3]);
  assert.ok(Math.abs(row.ra - 67.91010616666667) < 1e-12);
  assert.ok(Math.abs(row.dec - 18.23256722222222) < 1e-12);
  const body = astronomyRecord(spec, row, { main: spec.name }, 1);
  assert.deepEqual([body.star.positionEpochJulianYear, body.star.properMotionRaMasPerYear, body.star.properMotionDecMasPerYear], [2014.83, 18.5, -22.3]);
  assert.match(body.star.sources.position, /epoch J2014\.83/u);
  assert.match(body.star.sources.properMotion, /^DOI /u);
});

test('a printed J2000 position with no motion retains the existing fixed-position behavior', async () => {
  const spec = parseStarSpec({ ...star, position: { ...position, motion: undefined } });
  assert.ok(spec.position);
  const row = await fetchCatalogueRow(archive, spec.position, spec.id);
  assert.deepEqual([row.epoch, row.pmra, row.pmdec], [2000, undefined, undefined]);
});

test('printed motion refuses an invalid epoch or missing or nonnumeric proper-motion cells', async () => {
  assert.throws(() => parseStarSpec({ ...star, position: { ...position, motion: { ...position.motion, epoch: 2400000 } } }), /Julian year/u);
  for (const pmRA of ['', 'not measured']) {
    const spec = parseStarSpec({ ...star, position: { ...position, row: { ...position.row, pmRA } } });
    assert.ok(spec.position);
    await assert.rejects(fetchCatalogueRow(archive, spec.position, spec.id), /finite proper motion in pmRA/u);
  }
});
