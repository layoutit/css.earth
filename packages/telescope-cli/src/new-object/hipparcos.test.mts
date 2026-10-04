/** The McDonald, Zijlstra & Watson (2017) draft route (hipparcos.mts), offline on VizieR and SIMBAD answers as served 2026-10-02 and
 * 2026-10-03. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Archive } from './archives.mts';
import { draftFromMcDonald, draftsFromHipparcos, parseMcDonaldRow, parseSimbadStar, parseXhipVelocity, requireOneStar, starQuotes } from './hipparcos.mts';

const answer = (header: string, row: string) => `#\n# VizieR answer\n${header}\n${header.replace(/[^\t]+/gu, 'unit')}\n${header.replace(/[^\t]+/gu, '---')}\n${row}\n`;
const MCDONALD = 'HIP\tD\tdplx\tAV\tTeff\te_Teff\tL\te_L/L\tRad\tQ';
// Table 2 rows of HIP 13847 (θ1 Eridani, Acamar), HIP 20889 (ε Tauri, Ain) and HIP 26311 (ε Orionis, Alnilam).
const ACAMAR = answer(MCDONALD, ' 13847\t  49.431\t 0.027\t  0.106\t 7526\t  898\t   112.163\t 0.219\t    6.238\t 0.126');

test('a table 2 row inside the paper\'s well-fit subset is drafted at its distance, with its radius and an unmeasured mass', () => {
  const row = parseMcDonaldRow(ACAMAR, '13847');
  assert.equal(row.radius, 6.238);
  const spec = draftFromMcDonald(row, ['HIP 13847', 'HD 18622', '* tet Eri'], { gaia: false, velocity: { velocity: 11.9, error: 0.7, quality: 'A' }, taken: () => false,
    name: { name: 'Acamar', step: 'iau', identifier: '* tet Eri' } });
  assert.equal(spec.id, 'acamar');
  assert.equal(spec.parent, 'milky-way', 'a star Hipparcos places is inside the Milky Way');
  assert.equal(spec.featured, true);
  assert.equal(spec.mass, 'unmeasured');
  assert.match(spec.limb?.none ?? '', /^no mass is measured and no spectroscopic surface gravity is published/u, 'with no published gravity no limb law is chosen');
  assert.equal(spec.gravity, undefined);
  assert.equal(spec.distance.value, 49.431);
  assert.match(spec.radius.source, /table 2, HIP 13847: radius 6\.238 solar radii/u);
  assert.equal(spec.position?.catalogue, 'V/137D/XHIP');
  assert.equal(spec.radialVelocity?.value, 11.9);
  assert.equal(spec.text.card, 'A star 49 parsecs away, 6.2 times the Sun\'s width, measured from its light.');
  // A name another body holds gives way to the HD number.
  assert.equal(draftFromMcDonald(row, ['HIP 13847', 'HD 18622'], { gaia: true, taken: id => id === 'acamar', name: { name: 'Acamar', step: 'iau', identifier: '* tet Eri' } }).id, 'hd-18622');
});

test('a named star is quoted from its own article, found by its designation; a namesake\'s article gives nothing', async () => {
  const pages: Record<string, { title: string; extract: string; description: string }> = {
    'BD+14_4559': { title: 'BD+14 4559', description: 'Star in the constellation Pegasus', extract: 'BD+14 4559 is a star with an exoplanetary companion in the northern constellation of Pegasus. It is named Solaris.' },
    Solaris: { title: 'Solaris', description: 'Novel by Stanisław Lem', extract: 'Solaris is a 1961 science fiction novel about the planet Solaris. It follows a crew of scientists.' },
    Alpha_Corvi: { title: 'Alpha Corvi', description: 'Star in the constellation Corvus', extract: 'Alpha Corvi is a star in the southern constellation of Corvus. It has the proper name Alchiba, pronounced ; Alpha Corvi is its Bayer designation. It is 49 light-years away.' },
  };
  const page = (url: string) => pages[decodeURIComponent(url.split('/').at(-1)!)];
  const archive: Archive = { exists: async url => !!page(url), bytes: async () => Buffer.alloc(0),
    text: async url => JSON.stringify({ type: 'standard', revision: 1, content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${url.split('/').at(-1)}` } }, ...page(url) }) };
  // The WGSN designation SIMBAD lists titles the article; the novel named Solaris names no designation of the star.
  assert.equal((await starQuotes(archive, ['HIP 104780', 'BD+14  4559', 'NAME Solaris'], 'Solaris', ['BD+14 4559']))?.title, 'BD+14 4559');
  assert.equal(await starQuotes(archive, ['HIP 104780', 'NAME Solaris'], 'Solaris'), undefined);
  // The lead's first sentence is the quote; the one whose pronunciation the summary dropped is passed over.
  const alchiba = await starQuotes(archive, ['* alf Crv', 'HD 105452', 'NAME Alchiba'], 'Alchiba');
  assert.equal(alchiba?.card, 'Alpha Corvi is a star in the southern constellation of Corvus.');
  assert.equal(alchiba?.introduction, 'It is 49 light-years away.');
});

test('a row outside the well-fit subset is refused with the paper\'s reason', () => {
  assert.throws(() => parseMcDonaldRow(answer(MCDONALD, ' 20889\t  44.964\t 0.011\t  6.200\t 4918\t  125\t    79.149\t 0.052\t   12.272\t 0.053'), '20889'), /extinction is AV 6\.2 mag/u);
  assert.throws(() => parseMcDonaldRow(answer(MCDONALD, ' 26311\t 606.061\t 0.273\t  1.821\t15339\t15339\t175300.000\t 1.000\t   59.368\t 0.131'), '26311'), /parallax uncertainty is 27 per cent/u);
  // A fit worse than the paper's Q 0.5: an invented row, the only one here.
  assert.throws(() => parseMcDonaldRow(answer(MCDONALD, '1\t10\t0.01\t0.1\t5000\t125\t1\t0.1\t1\t0.7'), '1'), /fit quality Q is 0\.7/u);
  // HIP 30324 (β Canis Majoris, Mirzam): a hot star the fit does not confine, as the table itself says.
  assert.throws(() => parseMcDonaldRow(answer(MCDONALD, ' 30324\t 151.057\t 0.033\t  1.607\t24953\t24953\t 27856.500\t 1.000\t    8.943\t 0.036'), '30324'), /uncertain by a factor of two \(fractional uncertainty 1, temperature 24953 \+\/- 24953 K\)/u);
  // Castor (HIP 36850) is six stars under one Hipparcos number; Algol (HIP 14576) an eclipsing triple SIMBAD files as SB*.
  assert.throws(() => requireOneStar('36850', '**'), /SIMBAD classes it a double or multiple star \(\*\*\)/u);
  assert.throws(() => requireOneStar('14576', 'SB*'), /a spectroscopic binary/u);
  assert.doesNotThrow(() => requireOneStar('21421', 'LP*'));
  assert.throws(() => parseXhipVelocity(answer('HIP\tRV\te_RV\tq_RV', '1\t\t\t'), '1'), /no radial velocity/u);
});

// HIP 57632 (β Leonis, Denebola): SIMBAD holds two published gravities at its position. HIP 44066 (α Cancri, Acubens): none.
const DENEBOLA = answer(MCDONALD, ' 57632\t  11.000\t 0.006\t  0.225\t 8730\t  612\t    13.535\t 0.133\t    1.610\t 0.054');
const ACUBENS = answer(MCDONALD, ' 44066\t  57.737\t 0.056\t  0.281\t 7999\t  243\t    49.134\t 0.079\t    3.655\t 0.047');
const NO_GRAVITIES = 'main_id\tlog_g\tbibcode\ttitle\n';
const GRAVITIES = `${NO_GRAVITIES}"* bet Leo"\t4.26\t"2003A&A...398.1121E"\t"Automated spectroscopic abundances of A and F-type stars using echelle spectrographs II. Abundances of 140 A-F stars from  ELODIE and CORALIE."\n` +
  '"* bet Leo"\t4.22\t"2003AJ....126.2048G"\t"Contributions to the nearby stars (NStars) project: spectroscopy of stars earlier than M0 within 40 parsecs: the northern  sample. I."\n';
// Claret & Bloemen (2011), J/A+A/529/A75 table-af: the Johnson V nodes around 8,730 K and log g 4.22 to 4.26.
const ATLAS = ['logg\tTeff\tZ\txi\ta\tb\tFilt\tMet\tMod', '[cm/s2]\tK\t[Sun]\tkm/s\t \t \t \t \t', '-----\t------\t----\t----\t-------\t-------\t--\t-\t-',
  ' 4.00\t  8500\t 0.0\t 2.0\t 0.3166\t 0.3073\tV \tL\tA', ' 4.50\t  8500\t 0.0\t 2.0\t 0.2919\t 0.3301\tV \tL\tA', ' 4.00\t  8750\t 0.0\t 2.0\t 0.2947\t 0.3130\tV \tL\tA',
  ' 4.50\t  8750\t 0.0\t 2.0\t 0.2975\t 0.3118\tV \tL\tA', ' 4.00\t  9000\t 0.0\t 2.0\t 0.2752\t 0.3179\tV \tL\tA', ' 4.50\t  9000\t 0.0\t 2.0\t 0.2817\t 0.3125\tV \tL\tA'].join('\n');
const STARS: Readonly<Record<string, { table2: string; simbad: string; identifiers: readonly string[]; gravities: string }>> = {
  57632: { table2: DENEBOLA, simbad: 'otype,ra,dec\n"dS*",177.26490975591017,14.572058064829658\n', identifiers: ['HIP 57632', '* bet Leo', 'HD 102647', 'HR  4534', 'NAME Denebola'], gravities: GRAVITIES },
  44066: { table2: ACUBENS, simbad: 'otype,ra,dec\n"PM*",134.62168421127,11.8576804028\n', identifiers: ['HIP 44066', 'Gaia DR3 604789257076233728', '* alf Cnc', 'HD  76756', 'NAME Acubens'], gravities: NO_GRAVITIES },
};

test('a draft cites the gravity published at SIMBAD\'s position of the star; only with none published is no limb law chosen', async () => {
  const asked: string[] = [];
  const archive: Archive = { exists: async () => false, bytes: async () => Buffer.alloc(0),
    async text(url, form) {
      const query = form?.QUERY ?? '', source = form?.['-source'] ?? '', hip = /HIP (\d+)/u.exec(query)?.[1] ?? form?.HIP?.slice(1) ?? '';
      if (url.includes('wikipedia')) throw new Error('offline: no article');
      if (query.includes('mesFe_h')) { asked.push(query); return Object.values(STARS).find(star => query.includes(star.simbad.split('\n')[1]!.split(',')[1]!))!.gravities; }
      if (query.includes('b.otype')) return STARS[hip]!.simbad;
      if (query) return `id\n${STARS[hip]!.identifiers.map(id => `"${id}"`).join('\n')}\n`;
      return source === 'J/MNRAS/471/770/table2' ? STARS[hip]!.table2 : source === 'V/137D/XHIP' ? answer('HIP\tRV\te_RV\tq_RV', ' 57632\t  -0.20\t  0.50\tA') : source === 'J/A+A/529/A75/table-af' ? ATLAS : '#\n';
    } };
  const { stars, report } = await draftsFromHipparcos(['57632', '44066'], archive), [denebola, acubens] = stars as ReturnType<typeof draftFromMcDonald>[];
  // The cone is SIMBAD's own J2000 position of the Hipparcos number, so a star's proper motion since cannot move it out.
  assert.match(asked[0]!, /CIRCLE\('ICRS', 177\.26490975591017, 14\.572058064829658, /u);
  // The more recent paper's value, cited by its bibcode; both papers analysed the star's own spectra.
  assert.deepEqual(denebola!.gravity, { value: 4.26, url: 'https://ui.adsabs.harvard.edu/abs/2003A%26A...398.1121E',
    source: 'SIMBAD\'s compilation of spectroscopic measurements (mesFe_h): log g 4.26 from 2003A&A...398.1121E; the 2 published values span log g 4.22 to 4.26, across which the limb law changes by at most 0.0% of the centre brightness' });
  assert.equal(denebola!.limb, undefined, 'a star with a cited gravity declines no law: the generator reads one at it');
  assert.equal(denebola!.mass, 'unmeasured');
  assert.equal(acubens!.gravity, undefined);
  assert.equal(acubens!.limb?.none, 'no mass is measured and no spectroscopic surface gravity is published with this radius: McDonald, Zijlstra & Watson (2017), MNRAS 471, 770 assume the gravity of their fit (table column 15)');
  assert.match(report[0]!, /at the paper's distance; log g 4\.26 from 2003A&A\.\.\.398\.1121E; /u);
  assert.match(report[1]!, /at the paper's distance; no spectroscopic gravity is published, so no limb law; /u);
  // Both drafts are specs the generator accepts.
  const { parseStarSpec } = await import('./spec.mts');
  for (const star of stars) assert.doesNotThrow(() => parseStarSpec(star));
  assert.throws(() => parseSimbadStar('otype,ra,dec\n', '1'), /HIP 1: SIMBAD gives no J2000 position for it/u);
});
