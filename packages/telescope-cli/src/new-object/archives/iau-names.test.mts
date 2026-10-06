/** The IAU star-name bank (iau-names.mts), the name chooser's IAU step (display-name.mts) and the IAU draft's renaming (iau.mts), offline. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preferredName } from '../names/display-name.mts';
import { named } from './iau.mts';
import { iauLookup, parseIauNames, readIauNames, rowsFromPage } from './iau-names.mts';
import { renamed } from '../revise/rename.mts';

const HEADER = 'name\tdesignation\thip\tbayer\tsimbad\tconstellation\tadopted\tra\tdec';
const BANK = [HEADER,
  'Izar\tHR 5506\t72105\tε Boo\tIzar\tBoo\t2016-08-21\t221.2467\t27.0742',
  'Pulcherrima\tHR 5505\t72105\tε Boo B\tPulcherrima\tBoo\t2026-04-15\t221.2467\t27.0742',
  'Malmok\tWASP-39\t\t\tMalmok\tVir\t2019-12-17\t217.3267\t-3.4445',
  'Acamar\t* tet Eri\t13847\tθ1 Eri\tAcamar\tEri\t2016-07-20\t44.5653\t-40.3047'].join('\n');

test('a star takes its IAU name by its WGSN designation, or by a Hipparcos number no other named star shares', () => {
  const lookup = iauLookup(parseIauNames(BANK));
  assert.equal(lookup(['HD 129989', 'HR  5506', 'HIP 72105'])?.name, 'Izar');
  assert.equal(lookup(['HR 5505'])?.name, 'Pulcherrima');
  // ε Boötis A and B share HIP 72105, so the number alone names neither.
  assert.equal(lookup(['HIP 72105']), undefined);
  assert.equal(lookup(['HIP 13847', 'HD 18622'])?.name, 'Acamar');
  assert.equal(preferredName(['WASP-39', 'NAME Malmok', 'TYC 4976-1061-1'], lookup)?.step, 'iau');
  assert.equal(preferredName(['HD 39801', 'NAME Betelgeuse', '* alf Ori'], lookup)?.name, 'Betelgeuse');
  assert.throws(() => parseIauNames(BANK.replace(HEADER, 'name\tdesignation')), /header/u);
});

test('the committed bank reads through its manifest, one name per designation', async () => {
  const { rows, lookup } = await readIauNames();
  assert.ok(rows.length >= 640, `${rows.length} rows`);
  assert.equal(lookup(['WASP-39'])?.name, 'Malmok');
  assert.equal(lookup(['HR 2491'])?.name, 'Sirius');
});

test('the WGSN page table gives the bank its rows, sorted by name, entities decoded', () => {
  const page = `<table><tr><th>proper names</th><th>Designation</th><th>HIP</th><th>Bayer ID</th><th>Simbad spelling</th><th>Constellation</th><th>Date of Adoption</th><th>RA</th><th>DEC</th></tr>
    <tr><td>Rigil Kentaurus</td><td>HR 5459</td><td>71683</td><td>&alpha; Cen A</td><td>Rigil Kentaurus</td><td>Cen</td><td>2016/11/06</td><td>219.9</td><td>-60.8</td></tr>
    <tr><td>Acamar</td><td>* tet Eri</td><td>13847</td><td>&#952;1 Eri</td><td>Acamar</td><td>Eri</td><td>2016/07/20</td><td>44.5</td><td>-40.3</td></tr></table>`;
  const rows = rowsFromPage(page);
  assert.deepEqual(rows.map(row => row.name), ['Acamar', 'Rigil Kentaurus']);
  assert.equal(rows[0]!.bayer, 'θ1 Eri');
  assert.equal(rows[1]!.adopted, '2016-11-06');
});

test('a name of the star\'s own leaves its planets\' designations as they are; a designation carries over to them', () => {
  const star = { name: 'GJ 367', system: 'GJ 367 system', description: 'Star with 1 transiting planet.', text: { card: 'GJ 367 b crosses GJ 367 as seen from Earth.', introduction: 'It is GJ 367 b\'s star.' } };
  const own = structuredClone(star);
  renamed(own, 'GJ 367', 'Añañuca', true);
  assert.equal(own.text.card, 'GJ 367 b crosses Añañuca as seen from Earth.');
  assert.equal(own.system, 'Añañuca system');
  const designation = structuredClone(star);
  renamed(designation, 'GJ 367', 'Gliese 367');
  assert.equal(designation.text.card, 'Gliese 367 b crosses Gliese 367 as seen from Earth.');
});

test('an IAU draft takes the name, keeps the planet names, and lists the designations a reader meets as aliases', () => {
  const lookup = iauLookup(parseIauNames(BANK)), row = lookup(['HIP 13847'])!;
  const spec = named({ id: 'hip-13847', name: 'HIP 13847', system: 'HIP 13847 system', aliases: ['HD 18622'], planets: [{ name: 'HIP 13847 b', description: 'Planet of HIP 13847.' }] },
    row, 'acamar', ['HIP 13847', 'HD 18622', '* tet Eri', '* tet01 Eri', 'NAME Acamar']);
  assert.equal(spec.id, 'acamar');
  assert.equal(spec.name, 'Acamar');
  assert.equal('featured' in spec, false, 'a name alone does not make a star a map target');
  assert.equal(spec.planets[0].name, 'HIP 13847 b');
  assert.equal(spec.planets[0].description, 'Planet of Acamar.');
  assert.deepEqual(spec.aliases, ['HD 18622', 'HIP 13847', 'Theta Eridani']);
});
