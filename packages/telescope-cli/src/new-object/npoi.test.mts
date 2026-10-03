/** Bright stars whose discs the NPOI measured (npoi.mts), drafted offline from rows as VizieR serves them. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { draftFromNpoi, parseNpoiRow, parseXhipRow } from './npoi.mts';
import { parseStarSpec } from './spec.mts';

// Rows as VizieR serves them, 2026-10-03 (header, units, dashes, the star's row), with only the columns the route reads.
const tsv = (header: string, units: string, ...rows: string[]) => [header, units, header.replace(/[^\t]+/gu, '------'), ...rows].join('\n');
const baines2018 = {
  parallax: tsv('HD\tSpType\tPlx\te_Plx', ' \t \tmas\tmas', ' 62509\tK0 III   \t 96.54\t 0.27'),
  diameter: tsv('HD\ttheta-LDf\te_theta-LDf\tlogg\tRef', ' \tmas\tmas\t[cm/s2]\t ', ' 62509\t 8.134\t 0.013\t 2.77\t 3   '),
  parameters: tsv('HD\tSpType\tRad\te_Rad\tE_Rad\tf_Rad\tTeff\te_Teff\tLum\te_Lum\tf_Lum', ' \t \tRsun\tRsun\tRsun\t \tK\tK\tLsun\tLsun\t ',
    ' 62509\tK0 III  \t  9.06\t 0.03\t     \t \t 4586\t  57\t   32.7\t    1.6\t', ' 31964\tA2 I    \t      \t     \t     \t*\t 7977\t 292\t       \t       \t*'),
  mass: tsv('HD\tMass\te_Mass', ' \tMsun\tMsun', ' 62509\t 0.98\t 0.10'),
};
const baines2021 = {
  parallax: tsv('Target\tSpT\tPlx\te_Plx\tr_Plx', ' \t \tmas\tmas\t ', '131873\tK4 III    \t 24.91\t 0.12\t2'),
  diameter: tsv('Target\ttheta-ld-f\te_theta-ld-f\tlogg\tRef', ' \tmas\tmas\t[cm/s2]\t ', '131873\t10.229\t 0.012\t 1.83\t5'),
  parameters: tsv('Target\tSpT\tRad\tE_Rad\te_Rad\tTeff\te_Teff\tLum\te_Lum', ' \t \tRsun\tRsun\tRsun\tK\tK\tLsun\tLsun', '131873\tK4 III\t 44.13\t 0.22\t 0.22\t 4008\t 37\t  453.7\t   17.2'),
};
const xhip = tsv('HIP\tRV\te_RV\tq_RV', ' \tkm/s\tkm/s\t ', ' 37826\t   3.23\t  0.02\tA');

test('a 2018 NPOI row drafts a weighed star placed at the parallax its radius was computed with, by Hipparcos when Gaia lists none', () => {
  const pollux = draftFromNpoi(parseNpoiRow(2018, '62509', baines2018), ['HD 62509', 'NAME Pollux', '* bet Gem', 'HIP 37826'], parseXhipRow(xhip, '37826'));
  assert.deepEqual([pollux.id, pollux.name, pollux.parent, pollux.featured, pollux.radius.value, pollux.temperature.value], ['pollux', 'Pollux', 'milky-way', true, 9.06, 4586]);
  assert.deepEqual([pollux.distance.value, pollux.distance.uncertainty], [10.358, 0.029]);
  assert.equal(pollux.description, "A giant of type K0 III 10.4 parsecs away, 9.1 times the Sun's width: its disc was measured with the Navy Precision Optical Interferometer.");
  assert.match(pollux.distance.source, /Hipparcos \(van Leeuwen 2007\) parallax .* 96\.54 \+\/- 0\.27 mas/u);
  assert.match(typeof pollux.mass === 'string' ? '' : pollux.mass.source, /PARAM .* estimates only/u, 'the mass is cited as the model estimate it is');
  assert.equal('gravity' in pollux, false, 'a weighed star takes its log g from the mass and radius');
  assert.deepEqual([pollux.position?.row, pollux.radialVelocity?.value], [{ HIP: '37826' }, 3.23]);
  assert.doesNotThrow(() => parseStarSpec(pollux), 'an NPOI draft is a whole spec');
  assert.throws(() => parseNpoiRow(2018, '31964', baines2018), /HD 31964: the paper flags the radius as not useful/u);
  assert.throws(() => parseNpoiRow(2018, '1', baines2018), /HD 1: Table 5 has 0 rows, not one/u);
});

test('a 2021 NPOI row has no mass, so its limb reads the literature log g the paper lists, unless that log g is a class value', () => {
  const kochab = draftFromNpoi(parseNpoiRow(2021, '131873', baines2021), ['HD 131873', 'NAME Kochab', '* bet UMi', 'Gaia DR3 1']);
  assert.deepEqual([kochab.id, kochab.mass, kochab.radius.value, kochab.gravity?.value, 'position' in kochab], ['kochab', 'unmeasured', 44.13, 1.83, false]);
  assert.match(kochab.gravity?.source ?? '', /Valdes et al\. \(2004\), as the paper lists it/u);
  assert.match(kochab.distance.source, /Hipparcos \(van Leeuwen 2007\) parallax/u, 'the 2021 paper names each star\'s parallax');
  assert.equal(kochab.text.card, "A giant of type K4 III, 40 parsecs away: 44.1 times the Sun's width and 454 times its light.", 'the kind of star, in the table\'s own type; widths to a tenth');
  assert.doesNotThrow(() => parseStarSpec(kochab));
  // Bordé et al. (2002), the 2021 paper's reference 3, read log g off the spectral type.
  const borde = { ...baines2021, diameter: baines2021.diameter.replace(/\t5$/u, '\t3') };
  assert.equal(parseNpoiRow(2021, '131873', borde).gravity, undefined);
});
