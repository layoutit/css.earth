/** Cepheids of the Triangulum Galaxy drafted from their catalogue rows (m33-cepheids.mts), offline on fixtures. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { Archive } from './archives.mts';
import { BREUVAL_2023, draftsFromM33Cepheids, surveyName } from './m33-cepheids.mts';
import { parseStarSpec } from '../spec.mts';

// Breuval et al. (2023) table 9 as VizieR's ASU TSV serves it, comment lines dropped: the longest period is a Silver row.
const table = ['ID\tRAJ2000\tDEJ2000\tlogP\tSet', ' \tdeg\tdeg\t[d]\t ', '---\t---\t---\t---\t---',
  '01332610+3033200\t023.35862\t+30.55548\t 1.301\tG', '01334390+3032452\t023.43275\t+30.54584\t 1.873\tG', '01340516+3038511\t023.52135\t+30.64750\t 1.942\tS'].join('\n');
const archive = {
  async text(_url: string, form?: Readonly<Record<string, string>>) {
    if (form?.['-source'] === BREUVAL_2023.catalogue) return table;
    const query = form?.QUERY ?? '';
    if (query.includes('rvz_radvel')) return 'rvz_radvel,rvz_err,rvz_bibcode\n-179,3,1991rc3..book.....D\n';
    // SIMBAD lists a van den Bergh, Herbst & Kowal number for one star only.
    const name = /n\.id = '([^']+)'/u.exec(query)?.[1];
    return `id\n"${name}"\n${name === 'M33SSS J013343.90+303245.2' ? '"VHK 45"\n' : ''}`;
  },
} as unknown as Archive;

test('the table\'s ID is the survey name SIMBAD lists', () => {
  assert.equal(surveyName('01334390+3032452'), 'M33SSS J013343.90+303245.2');
  assert.throws(() => surveyName('CEPH-1'), /not an ID/u);
});

test('each row is a star at the galaxy\'s Cepheid distance, named by the order of preference, the longest Gold period featured', async () => {
  const { stars } = await draftsFromM33Cepheids(['all'], archive, resolve(import.meta.dirname, '../../../../..')), specs = stars.map(star => parseStarSpec(star));
  assert.deepEqual(specs.map(spec => [spec.name, spec.featured ?? false]), [['M33SSS J013326.10+303320.0', false], ['VHK 45', true], ['M33SSS J013405.16+303851.1', false]]);
  assert.deepEqual(specs[1]!.aliases, ['M33SSS J013343.90+303245.2']);
  assert.deepEqual(specs[1]!.position?.row, { ID: '01334390+3032452' });
  // On the disc as drawn (859 kpc, 9 kpc in radius), not at the galaxy's Cepheid distance (840 kpc), 19 kpc in front of it.
  for (const spec of specs) assert.ok(Math.abs(spec.distance!.value - 859_014) < 9_000, `${spec.name} at ${spec.distance!.value} pc`);
  assert.match(specs[0]!.distance!.source, /Placed in M33 as the app draws it.*840 kpc; it places the galaxy, not a star within it/u);
  assert.match(specs[0]!.radius === 'gaia-flame' ? '' : specs[0]!.radius.source, /20 d in Breuval et al\. \(2023\), ApJ 951, 118, table 9 \(log P 1\.301\)/u);
});
