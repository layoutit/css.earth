/** A Gaia benchmark star (benchmark.mts), drafted offline from its row as VizieR serves it. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { draftFromBenchmark, parseBenchmarkRow } from './benchmark.mts';
import { parseXhipRow } from './npoi.mts';
import { parseStarSpec } from '../spec.mts';

// The row as VizieR serves it, 2026-10-06 (header, units, dashes, the star's row), with only the columns the route reads.
const tsv = (header: string, units: string, ...rows: string[]) => [header, units, header.replace(/[^\t]+/gu, '------'), ...rows].join('\n');
const header = 'HD\tThetaLD\te_ThetaLD\tIndirect\tr_ThetaLD\tPlx\te_Plx\to_Plx\tTeff\te_Teff\tLum\te_Lum\tRad\te_Rad\tlogg\te_logg';
const units = ' \tmas\tmas\t \t \tmas\tmas\t \tK\tK\tLsun\tLsun\tRsun\tRsun\t[cm/s2]\t[cm/s2]';
const table = tsv(header, units, 'HD18884\t12.200\t0.040\t \t2006A&A...460..855W\t 13.09\t0.44\tH\t3738\t170\t1764.364\t341.889\t100.206\t3.384\t0.66\t0.07',
  'HD999999\t 1.000\t0.010\t1\t2020A&A...000..000X\t 10.00\t0.10\tG\t5000\t 50\t   1.000\t  0.100\t  1.000\t0.010\t4.40\t0.02');

test('a benchmark star is drafted from its row: measured diameter, the paper\'s radius, temperature and log g, and no mass', () => {
  const row = parseBenchmarkRow(table, '18884');
  assert.deepEqual([row.diameter, row.diameterPaper, row.parallax, row.parallaxSource, row.teff, row.radius, row.gravity], [[12.2, 0.04], '2006A&A...460..855W', [13.09, 0.44], 'Hipparcos (van Leeuwen 2007)', [3738, 170], [100.206, 3.384], [0.66, 0.07]]);
  const menkar = draftFromBenchmark(row, ['HD 18884', 'NAME Menkar', '* alf Cet', 'HIP 14135'], parseXhipRow(tsv('HIP\tRV\te_RV\tq_RV', ' \tkm/s\tkm/s\t ', ' 14135\t -26.08\t  0.02\tA'), '14135'));
  assert.deepEqual([menkar.id, menkar.name, menkar.target, menkar.aliases, menkar.mass, menkar.radius.value, menkar.temperature.value, menkar.gravity.value, menkar.distance.value], ['menkar', 'Menkar', 'HD 18884', ['HD 18884'], 'unmeasured', 100.206, 3738, 0.66, 76.394]);
  assert.equal(menkar.text.card, 'One of the Gaia benchmark stars, 76 parsecs away: 100 times the Sun\'s width and 1,764 times its light.');
  assert.match(menkar.radius.source, /measured in 2006A&A\.\.\.460\.\.855W, as the table lists it\) and the Hipparcos \(van Leeuwen 2007\) parallax$/u);
  assert.equal(menkar.position?.row.HIP, '14135', 'a star Gaia DR3 does not list is placed by Hipparcos');
  assert.doesNotThrow(() => parseStarSpec(menkar), 'a benchmark draft is a whole spec');
});

test('a star whose diameter is indirect, or that the table does not hold, is refused', () => {
  assert.throws(() => parseBenchmarkRow(table, '999999'), /marks its angular diameter as an indirect measurement/u);
  assert.throws(() => parseBenchmarkRow(table, '12345'), /the table has 0 rows, not one/u);
});
