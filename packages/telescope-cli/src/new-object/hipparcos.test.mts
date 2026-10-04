/** The McDonald, Zijlstra & Watson (2017) draft route (hipparcos.mts), offline on VizieR answers as served 2026-10-02. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Archive } from './archives.mts';
import { draftFromMcDonald, parseMcDonaldRow, parseXhipVelocity, requireOneStar, starQuotes } from './hipparcos.mts';

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
