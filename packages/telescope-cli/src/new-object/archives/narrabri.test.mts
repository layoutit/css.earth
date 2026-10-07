/** A star whose disc the Narrabri interferometer measured (narrabri.mts), drafted offline from rows as VizieR serves them. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { draftFromNarrabri, NARRABRI, parseNarrabriRow, SOLAR_RADII_PER_MAS_PARSEC } from './narrabri.mts';
import { parseXhipRow } from './npoi.mts';
import { parseStarSpec } from '../spec.mts';

// Rows as VizieR serves them, 2026-10-06 (header, units, dashes, the star's rows), with only the columns the route reads.
const tsv = (header: string, units: string, ...rows: string[]) => [header, units, header.replace(/[^\t]+/gu, '------'), ...rows].join('\n');
const jmdc = tsv('ID1\tLDdiam\te_LDdiam\tMethod\tBibCode', ' \tmas\tmas\t \t ', 'HD35468\t 0.7600\t        \t3\t1967MNRAS.137..393H', 'HD35468\t 0.7200\t  0.0400\t3\t1974MNRAS.167..121H',
  'HD35468\t 0.7100\t  0.0050\t1\t2014A&A...570A.104C', 'HD35468\t 0.7850\t  0.0070\t1\t2021A&A...652A..26S');
const xhip = tsv('HIP\tPlx\te_Plx\tRV\te_RV\tq_RV', ' \tmas\tmas\tkm/s\tkm/s\t ', ' 25336\t 12.92\t 0.52\t  18.20\t  0.90\tA');

test('the typed tables hold the paper\'s 32 program stars, five of them primaries of multiple stars', () => {
  assert.equal(NARRABRI.stars.length, 32);
  assert.deepEqual(NARRABRI.stars.filter(star => star.primaryComponent).map(star => star.hd), [37742, 68273, 111123, 116658, 143275]);
  // Vega and Sirius as the two tables print them: a check of the typing on the stars everyone knows.
  assert.deepEqual(NARRABRI.stars.filter(star => [172167, 48915].includes(star.hd)).map(star => [star.diameterMas, star.diameterErrorMas, star.teffK, star.teffErrorK]), [[5.89, 0.16, 9970, 160], [3.24, 0.07, 9660, 140]]);
});

test('a Narrabri star is drafted with the 1974 diameter, the 1976 temperature and a radius computed from the Hipparcos parallax', () => {
  const row = parseNarrabriRow('35468', jmdc, xhip, '25336');
  assert.deepEqual([row.spectralType, row.diameter, row.teff, row.parallax], ['B2 III', [0.72, 0.04], [21580, 790], [12.92, 0.52]]);
  const bellatrix = draftFromNarrabri(row, ['HD 35468', 'NAME Bellatrix', '* gam Ori', 'HIP 25336'], parseXhipRow(xhip, '25336'), false);
  // 0.72 mas at 1000 / 12.92 pc: 0.1075 x 0.72 x 77.4 = 5.99 solar radii; the errors of 5.6% and 4.0% add to 6.8%.
  assert.ok(Math.abs(SOLAR_RADII_PER_MAS_PARSEC - 0.107516) < 0.000001);
  assert.deepEqual([bellatrix.id, bellatrix.name, bellatrix.radius.value, bellatrix.radius.uncertainty, bellatrix.temperature.value, bellatrix.temperature.uncertainty, bellatrix.distance.value, bellatrix.mass],
    ['bellatrix', 'Bellatrix', 5.99, 0.41, 21580, 790, 77.399, 'unmeasured']);
  assert.match(bellatrix.radius.source, /^Computed here, not printed by a paper: 5\.99 \+\/- 0\.41 solar radii, from the limb-darkened angular diameter 0\.72 \+\/- 0\.04 mas of Hanbury Brown, Davis & Allen \(1974\), MNRAS 167, 121/u);
  assert.equal(bellatrix.description, 'A giant of type B2 III 77.4 parsecs away, 6.0 times the Sun\'s width: its disc was measured with the Narrabri intensity interferometer.');
  assert.equal(bellatrix.position?.row.HIP, '25336');
  assert.doesNotThrow(() => parseStarSpec(bellatrix), 'a Narrabri draft is a whole spec');
});

test('a typing that differs from the JMDC, a primary of a multiple star and a star outside the programme are refused', () => {
  assert.throws(() => parseNarrabriRow('35468', jmdc.replace('0.7200', '0.7300'), xhip, '25336'), /the diameter typed from Table 1 \(0\.72 \+\/- 0\.04 mas\) is not the JMDC's \(0\.73 \+\/- 0\.04 mas\)/u);
  assert.throws(() => parseNarrabriRow('116658', jmdc, xhip, '65474'), /primary component of a multiple star/u);
  assert.throws(() => parseNarrabriRow('1', jmdc, xhip, '1'), /not one of the paper's 32 program stars/u);
});
