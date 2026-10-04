/** Cepheids of the Andromeda Galaxy drafted from their catalogue rows (m31-cepheids.mts), offline on fixtures. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { Archive } from './archives.mts';
import { draftsFromM31Cepheids, HUBBLE_V1, KODRIC_2018, LI_2021, vizierRows } from './m31-cepheids.mts';
import { parseStarSpec } from '../spec.mts';

// The two tables as VizieR's ASU TSV serves them, comment lines dropped: one GRP pointing with two Cepheids, one star listed in
// both samples, and one Cepheid of its own pointing.
const li = ['ID\tRAJ2000\tDEJ2000\tPer\tSample\tSimbadName', ' \tdeg\tdeg\td\t \t', '---\t---\t---\t---\t---\t---',
  'GRP-10.92725+41.24822 \t010.925\t+41.249\t15.249\tGold  \tDIRECT V635 M31D', 'GRP-10.92725+41.24822 \t010.929\t+41.248\t43.433\tGold  \tDIRECT V836 M31D',
  'GRP-11.09581+41.35417 \t011.100\t+41.353\t35.903\tGold  \tDIRECT V9029 M31C', 'GRP-11.09581+41.35417 \t011.100\t+41.353\t36.130\tSilver\tDIRECT V9029 M31C',
  'CEPH-11.05340+41.30685\t011.053\t+41.307\t10.631\tGold  \tPSO J011.0534+41.3068'].join('\n');
const kodric = ['ID\tRAJ2000\tDEJ2000\tPr\tPSO', ' \tdeg\tdeg\td\t ', '---\t---\t---\t---\t---', ' 579568\t010.36375\t+41.16965\t 31.376577\tPSO J010.3637+41.1696'].join('\n');
const root = resolve(import.meta.dirname, '../../../../..');
const archive: Archive = {
  async text(url, form) {
    if (form?.['-source'] === LI_2021.catalogue) return li;
    if (form?.['-source'] === KODRIC_2018.catalogue) return kodric;
    // SIMBAD: the galaxy's velocity, then each star's identifiers (only its own name here).
    const query = form?.QUERY ?? '';
    if (query.includes('rvz_radvel')) return 'rvz_radvel,rvz_err,rvz_bibcode\n-300,4,2012AJ....144....4M\n';
    const name = /n\.id = '([^']+)'/u.exec(query)?.[1];
    return `id\n"${name}"\n`;
  },
  async bytes() { throw new Error('no bytes offline'); }, async exists() { return false; }, async redirect() { return undefined; },
} as Archive;

test('a VizieR answer is read by column name, past its unit and rule lines', () => {
  assert.deepEqual(vizierRows(kodric, ['ID', 'Pr'], KODRIC_2018.catalogue).map(row => [row.ID, row.Pr]), [['579568', '31.376577']]);
  assert.throws(() => vizierRows(kodric, ['Per'], KODRIC_2018.catalogue), /no Per column/u);
});

test('every row is one star once: a shared pointing ID is told apart by period, and a star in both samples is drafted once', async () => {
  const { stars } = await draftsFromM31Cepheids(['all'], archive, root), specs = stars.map(star => parseStarSpec(star));
  assert.deepEqual(specs.map(spec => spec.name), [HUBBLE_V1.name, 'DIRECT V635 M31D', 'DIRECT V836 M31D', 'DIRECT V9029 M31C', 'PSO J011.0534+41.3068']);
  assert.equal(new Set(specs.map(spec => spec.id)).size, specs.length);
  assert.deepEqual(specs[1]!.position?.row, { ID: 'GRP-10.92725+41.24822', Per: '15.249' });
  assert.deepEqual(specs[3]!.position?.row, { ID: 'GRP-11.09581+41.35417', Per: '35.903' }, 'the Gold row of the star listed twice');
  assert.deepEqual(specs[4]!.aliases, ['CEPH-11.05340+41.30685'], 'a Cepheid of its own pointing keeps the table\'s name as an alias; a pointing\'s ID names no star');
  assert.equal(specs[1]!.aliases, undefined);
});

test("Hubble's V1 is the one featured star, placed in the galaxy as it is drawn, with sizes named as a relation's", async () => {
  const { stars } = await draftsFromM31Cepheids(['V1'], archive, root), [v1] = stars.map(star => parseStarSpec(star));
  assert.deepEqual([v1!.id, v1!.featured, v1!.position?.row], ['m31-v1', true, { ID: HUBBLE_V1.row }]);
  // In the galaxy as drawn (776 kpc), not at the galaxy's Cepheid distance (761 kpc), which would put it 15 kpc in front of the disc.
  assert.ok(Math.abs(v1!.distance!.value - 776_247) < 15_000 && v1!.distance!.value !== Math.round(10 ** (LI_2021.modulus[0] / 5 + 1)));
  assert.match(v1!.distance!.source, /Placed in M31 as the app draws it.*761 kpc; it places the galaxy, not a star within it/u);
  assert.equal(v1!.mass, 'unmeasured');
  assert.match(v1!.radius === 'gaia-flame' ? '' : v1!.radius.source, /not a measurement of this star/u);
  const { stars: others } = await draftsFromM31Cepheids(['CEPH-11.05340+41.30685'], archive, root);
  assert.equal(parseStarSpec(others[0]).featured, undefined);
});
