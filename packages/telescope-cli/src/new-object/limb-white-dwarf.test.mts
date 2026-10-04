/** A white dwarf's limb law is read from the grid of its cited atmosphere class and from no other (limb.mts). */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Archive } from './archives/archives.mts';
import { chooseLimb } from './limb.mts';
import { parseStarSpec } from './spec.mts';

// Claret et al. (2020), J/A+A/634/A93 tableab, the DA V-band nodes around Sirius B as VizieR serves them, 2026-10-03.
const rows = ['logg\tTeff\tZ\ta\tb\tMod\tFilter', '[cm/s+2]\tK\t[-]\t \t \t \t', '-----\t--------\t--------\t-------\t-------\t-------\t---',
  ' 8.50\t 25000.0\t  0.0000\t 0.0891\t 0.2676\tDA     \tV', ' 8.50\t 30000.0\t  0.0000\t 0.0666\t 0.2463\tDA     \tV',
  ' 8.75\t 25000.0\t  0.0000\t 0.0880\t 0.2692\tDA     \tV', ' 8.75\t 30000.0\t  0.0000\t 0.0656\t 0.2468\tDA     \tV'].join('\n');
const serving = (answer: (form: Readonly<Record<string, string>>) => string): Archive => ({ async text(_url, form) { return answer(form ?? {}); }, async bytes() { return Buffer.from(''); }, async exists() { return false; } });

test('Sirius B, a hydrogen-atmosphere white dwarf, reads its law between the DA nodes around it', async () => {
  const requests: Record<string, string>[] = [];
  const limb = await chooseLimb('sirius-b', 25369, 8.63, serving(form => { requests.push({ ...form }); return form['-source'] === 'J/A+A/634/A93/tableab' && form.Mod === '=DA' ? rows : '#\n'; }), undefined, undefined, 'DA');
  assert.equal(limb.grid, 'white-dwarf');
  // Between 25,000 and 30,000 K the law barely moves: u1 0.089 to 0.066.
  assert.ok(limb.coefficients && Math.abs(limb.coefficients.u1 - 0.0869) < 0.002 && Math.abs(limb.coefficients.u2 - 0.2668) < 0.002, JSON.stringify(limb.coefficients));
  assert.match(limb.sentence, /Claret et al\. \(2020\), A&A 634, A93 compute from pure-hydrogen \(DA\) white-dwarf model atmospheres for the Johnson V band at 25,369 K and log g 8\.63/u);
  assert.ok(requests.every(form => form['-source'] === 'J/A+A/634/A93/tableab'), 'no other grid is asked');
});

test('a helium-atmosphere white dwarf under the helium grid gets no law, and no hydrogen one in its place', async () => {
  // Procyon B's temperature and gravity: the DB grid starts at 10,000 K.
  const limb = await chooseLimb('helium-dwarf', 7740, 8.03, serving(() => '#\n'), undefined, undefined, 'DB');
  assert.equal(limb.limbDarkening, undefined);
  assert.match(limb.sentence, /^No limb darkening is drawn: at 7,740 K and log g 8\.03 the pure-helium \(DB\) white-dwarf grid of Claret et al\. \(2020\), A&A 634, A93 does not reach it/u);
});

test('the spec takes a cited atmosphere class and refuses one no grid tabulates', () => {
  const cited = { value: 1, source: 'a paper', url: 'https://doi.org/10.3847/1538-4357/aa6af8' };
  const star = { id: 'a-dwarf', name: 'A Dwarf', description: 'A white dwarf.', target: 'A Dwarf', paper: { url: cited.url, credit: 'A paper' }, radius: { ...cited, value: 0.008 }, mass: cited, temperature: { ...cited, value: 25369 } };
  assert.equal(parseStarSpec({ ...star, whiteDwarf: { atmosphere: 'DA', source: 'a paper', url: cited.url } }).whiteDwarf?.atmosphere, 'DA');
  assert.throws(() => parseStarSpec({ ...star, whiteDwarf: { atmosphere: 'DQZ', source: 'a paper', url: cited.url } }), /whiteDwarf\.atmosphere is DA, DB, DBA, not DQZ: no other white-dwarf atmosphere has a limb-darkening grid here/u);
});
