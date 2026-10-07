/** Bright stars whose discs the NPOI measured (npoi.mts), drafted offline from rows as VizieR serves them. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Archive } from './archives.mts';
import { draftFromNpoi, gaiaPlaces, parseNpoiRow, parseXhipRow } from './npoi.mts';
import { parseStarSpec } from '../spec.mts';

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
  assert.deepEqual([pollux.id, pollux.name, pollux.parent, 'featured' in pollux, pollux.radius.value, pollux.temperature.value], ['pollux', 'Pollux', 'milky-way', false, 9.06, 4586], 'a proper name does not feature a star: the navigational list does');
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

// Rows of the 2023 and 2025 papers as VizieR serves them, 2026-10-06: their tables are numbered 2, 5 or 6, and 7, the parallax
// columns are lower case, and the reference codes are those of each catalogue's own notes.
const baines2023 = {
  parallax: tsv('HD\tSpType\tplx\te_plx\tr_plx', ' \t \tmas\tmas\t ', '112185\tA1 III-IV   \t 41.22\t 1.84\t3'),
  diameter: tsv('HD\tFlag\ttheta-ld-f\te_theta-ld-f\tlogg', ' \t \tmas\tmas\t[cm/s2]', '112185\t \t 1.644\t 0.020\t 3.59', '224014\t*\t 6.000\t 0.050\t 0.50'),
  parameters: tsv('HD\tSpType\tRad\tE_Rad\te_Rad\tTeff\te_Teff\tL\te_L', ' \t \tRsun\tRsun\tRsun\tK\tK\tLsun\tLsun', '112185\tA0 IV      \t  4.29\t 0.19\t 0.21\t8908\t 54\t 104.4\t  9.3', '224014\tK5 Ia      \t500.00\t 9.00\t 9.00\t3600\t 50\t 9000.0\t 90.0'),
};
const baines2025 = {
  parallax: tsv('HD\tSpType\tplx\te_plx\tr_plx', ' \t \tmas\tmas\t ', '139006\tA1 IV         \t 42.24\t 0.98\tGaia22'),
  diameter: tsv('HD\tFlag\ttheta-ld-f\te_theta-ld-f\tlogg\tRef', ' \t \tmas\tmas\t[cm/s2]\t ', '139006\t \t 1.525\t 0.027\t 3.82\tAPL99  '),
  parameters: tsv('HD\tRad\tE_Rad\te_Rad\tL\te_L\tr_L\tTeff\te_Teff', ' \tRsun\tRsun\tRsun\tLsun\tLsun\t \tK\tK', '139006\t  3.88\t     \t  0.11\t   60.0\t  1.0\tMZW17 \t 8152\t  93'),
};

test('the 2023 and 2025 papers are read by their own table numbers, columns and reference codes', () => {
  const alioth = parseNpoiRow(2023, '112185', baines2023);
  assert.deepEqual([alioth.parallax, alioth.parallaxSource, alioth.diameter, alioth.radius, alioth.teff, alioth.luminosity, alioth.gravity],
    [[41.22, 1.84], 'Gaia DR2 (Gaia Collaboration 2018)', [1.644, 0.02], { value: 4.29, lower: 0.21, upper: 0.19 }, [8908, 54], 104.4, { value: 3.59, source: 'McDonald et al. (2017)' }]);
  const drafted = draftFromNpoi(alioth, ['HD 112185', 'NAME Alioth', '* eps UMa', 'HIP 62956'], parseXhipRow(tsv('HIP\tRV\te_RV\tq_RV', ' \tkm/s\tkm/s\t ', ' 62956\t  -9.30\t  0.50\tA'), '62956'));
  assert.deepEqual([drafted.id, drafted.name, drafted.radius.value, drafted.temperature.value, drafted.distance.value], ['alioth', 'Alioth', 4.29, 8908, 24.26]);
  assert.match(drafted.radius.source, /^Baines et al\. \(2023\), AJ 166, 268, HD 112185: radius 4\.29 \+0\.19\/-0\.21 solar radii \(Table 7\), from the limb-darkened angular diameter 1\.644 \+\/- 0\.02 mas \(NPOI, Table 5\) and the Gaia DR2 \(Gaia Collaboration 2018\) parallax$/u);
  assert.equal(drafted.text.locator, 'Tables 2, 5 and 7, HD 112185: parallax, MK type, limb-darkened diameter, radius, Teff, luminosity');
  assert.doesNotThrow(() => parseStarSpec(drafted), 'a 2023 draft is a whole spec');
  assert.throws(() => parseNpoiRow(2023, '224014', { ...baines2023, parallax: tsv('HD\tSpType\tplx\te_plx\tr_plx', ' \t \tmas\tmas\t ', '224014\tK5 Ia\t 0.94\t 0.10\t1') }), /flags the diameter \(Table 5 note: the fit may not be of significant value without the star's pulsation phase\)/u);

  const alphecca = parseNpoiRow(2025, '139006', baines2025);
  // The 2025 luminosity is a literature value (r_L), so none is taken; an empty upper radius error means a symmetric one.
  assert.deepEqual([alphecca.parallaxSource, alphecca.radius, alphecca.teff, alphecca.luminosity, alphecca.gravity],
    ['Gaia DR3 (Gaia Collaboration 2022)', { value: 3.88, lower: 0.11, upper: 0.11 }, [8152, 93], undefined, { value: 3.82, source: 'Allende Prieto & Lambert (1999)' }]);
  const second = draftFromNpoi(alphecca, ['HD 139006', 'NAME Alphecca', '* alf CrB', 'Gaia DR3 1219824223050771968']);
  assert.equal(second.text.locator, 'Tables 2, 6 and 7, HD 139006: parallax, MK type, limb-darkened diameter, radius, Teff');
  assert.equal(second.text.card, 'A subgiant of type A1 IV, 24 parsecs away: 3.9 times the Sun\'s width.');
  assert.throws(() => parseNpoiRow(2025, '139006', { ...baines2025, parallax: tsv('HD\tSpType\tplx\te_plx\tr_plx', ' \t \tmas\tmas\t ', '139006\tA1 IV\t 42.24\t 0.98\tXX99') }), /names parallax source XX99, which the table note does not list/u);
});

test('Gaia DR3 places a star only when its source has a proper motion', async () => {
  // Alnair (Gaia DR3 6560604777055249536) has a two-parameter solution: the row's pmra is empty. Alphecca's holds a motion.
  const gaia = (pmra: string): Archive => ({ async text() { return `pmra\n${pmra}\n`; }, async bytes() { throw new Error('offline'); }, async exists() { return false; } });
  assert.equal(await gaiaPlaces(gaia(''), ['HD 209952', 'Gaia DR3 6560604777055249536', 'HIP 109268']), false);
  assert.equal(await gaiaPlaces(gaia('118.927'), ['HD 139006', 'Gaia DR3 1222646935698492160']), true);
  assert.equal(await gaiaPlaces(gaia('118.927'), ['HD 35468', 'HIP 25336']), false, 'a star SIMBAD links no Gaia DR3 source to');
});
