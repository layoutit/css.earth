import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressesIn, citation, periodStands, recordedMass, recordLabel, sameAddress, sourceIndex, starFacts, withFields } from './star-facts.mts';

const TODAY = '2026-10-11';
const PAPER = { id: 'doi-10-1-paper', identifiers: [{ type: 'DOI', value: '10.1/paper' }, { type: 'bibliography-key', value: '2020ApJ...898L..11G' }], links: [{ url: 'https://doi.org/10.1/paper' }],
  evidence: [{ url: 'https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G', checkedOn: '2026-09-29' }], statements: [{ kind: 'credit', text: 'Gill et al. (2020), ApJL 898 L11' }] };
const GAIA = { id: 'gaia-dr3-star', title: 'Gaia DR3 row', identifiers: [], links: [{ url: 'https://gea.esac.esa.int/archive/' }], evidence: [{ url: 'https://gea.esac.esa.int/tap', checkedOn: '2026-09-28' }], statements: [] };
// A record written by hand: its evidence is a file of the tree, with no day, and its bibcode is filed under another name.
const HAND = { id: 'doi-10-2-hand', identifiers: [{ type: 'bibcode', value: '2021PSJ.....2....1A' }], evidence: [{ path: 'src/objects/star/text.json' }], statements: [{ kind: 'credit', text: 'Cite Agol et al. (2021), PSJ 2, 1.' }] };
const index = sourceIndex([PAPER, GAIA, HAND, null, { id: 7 }], TODAY);

test('a sentence leads to the record that holds one of its addresses, however the address is spelled', () => {
  assert.equal(sameAddress('http://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract'), 'https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G');
  assert.equal(sameAddress('https://ui.adsabs.harvard.edu/abs/2011A%26A...535A..55D/abstract'), 'https://ui.adsabs.harvard.edu/abs/2011A&A...535A..55D');
  assert.deepEqual(addressesIn('age 3.9 Gyr, from Gill et al. 2020 (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract).'), ['https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract']);
  assert.deepEqual(citation('star', 'age 3.9 Gyr, from Gill et al. 2020 (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract)', index),
    { catalogueId: 'doi-10-1-paper', url: 'https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract', label: 'Gill et al. (2020), ApJL 898 L11', checked: '2026-09-29' });
  // A hand-written record is cited by its credit line without "Cite", on the day the pass found it.
  assert.deepEqual(citation('star', 'from Agol et al. 2021 (https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract)', index),
    { catalogueId: 'doi-10-2-hand', url: 'https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract', label: 'Agol et al. (2021), PSJ 2, 1', checked: TODAY });
});

test('a value of Gaia DR3 is cited to the star\'s own Gaia record, and a value with no record to nothing', () => {
  assert.deepEqual(citation('star', 'Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26), astrophysical_parameters of Gaia DR3 1: lum_flame 2 solar luminosities', index),
    { catalogueId: 'gaia-dr3-star', url: 'https://gea.esac.esa.int/archive/', label: 'Gaia DR3 FLAME', checked: '2026-09-28' });
  assert.equal(citation('other', 'Gaia DR3 FLAME: lum_flame 2', index), undefined, 'another star has no Gaia record here');
  assert.equal(citation('star', 'SIMBAD, HD 1: spectral type K0 (1993yCat.3135....0C)', index), undefined);
  assert.equal(citation('star', 'from a paper (https://ui.adsabs.harvard.edu/abs/1999X/abstract)', index), undefined);
});

test('the mass is the one the body record takes its GM from, with its sentence', () => {
  const notes = 'Radius 0.832 solar radii from Gill et al. 2020 (https://x.test/r): 578,822 km. Mass 0.862 +/- 0.028 solar masses from Gill et al. 2020 (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract); GM is that mass times the JPL solar GM. Temperature 5050 K.';
  const mass = recordedMass({ physical: { gravitationalParameterKm3PerS2: 0.862 * 132712440041.93938 }, physicalNotes: notes })!;
  assert.equal(mass.massSolar, 0.862);
  assert.ok(mass.massSource.startsWith('Mass 0.862 +/- 0.028 solar masses from Gill et al. 2020 (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract). The mass this star\'s body record takes its GM from'));
  assert.equal(recordedMass({ physical: { gravitationalParameterKm3PerS2: 1e11 }, physicalNotes: 'GM from their stellar mass, 0.09 solar masses.' }), undefined, 'a mass worded another way is left');
  assert.equal(recordedMass({ physical: {}, physicalNotes: notes }), undefined);
  assert.deepEqual(Object.keys(withFields({ radiusKm: 1, massSolar: 2, shape: {} }, { massSolar: 9, massSource: 's' })), ['radiusKm', 'massSolar', 'massSource', 'shape']);
  assert.equal(withFields({ massSolar: 2, shape: {} }, { massSolar: 9 }).massSolar, 2, 'a field the record holds is kept');
});

const RECORD = { massSolar: 0.862, massSource: 'Mass 0.862 solar masses from Gill et al. 2020 (https://doi.org/10.1/paper).', effectiveTemperatureK: 5050.4, effectiveTemperatureSource: 'Temperature from Gill et al. 2020 (https://doi.org/10.1/paper)',
  luminosityLogSolar: -3.257, luminositySource: 'Gaia DR3 FLAME: lum_flame', spectralType: 'M8.0 V', spectralTypeSource: 'SIMBAD, star: spectral type M8.0 V', ageGyr: 0.31786, ageSource: 'Gaia DR3 FLAME: age_flame',
  rotationPeriodDays: 1.4, rotationPeriodSource: 'rotation period 1.4 d, from Gill et al. 2020 (https://doi.org/10.1/paper)' };

test('each value becomes a fact in plain units, cited to its own sentence; one with no record is counted and left out', () => {
  const { facts, uncited, contradicted } = starFacts('star', RECORD, new Set(['radius', 'distance']), index);
  assert.deepEqual(facts.map(fact => [fact.id, fact.label, fact.value]), [['mass', 'Mass', '0.862 solar masses'], ['temperature', 'Surface temperature', '5,050 K'], ['luminosity', 'Luminosity', '0.00055 times the Sun\'s'],
    ['age', 'Age', '320 million years'], ['rotation', 'Day', '34 hours']]);
  assert.deepEqual(facts[0]!.source, { catalogueId: 'doi-10-1-paper', url: 'https://doi.org/10.1/paper', label: 'Gill et al. (2020), ApJL 898 L11', checked: '2026-09-29', path: 'source/measurements.json', locator: 'massSolar; massSource' });
  assert.deepEqual(uncited.map(entry => entry.field), ['spectralType']); assert.equal(contradicted, false);
  assert.equal(starFacts('star', { ...RECORD, ageGyr: 7.6, rotationPeriodDays: 14.36, luminosityLogSolar: 2.648 }, new Set(), index).facts.map(fact => fact.value).join('; '), '0.862 solar masses; 5,050 K; 440 times the Sun\'s; 7.6 billion years; 14.4 days');
});

test('a record is named by its citation, never by an acknowledgement, and values are written as a reader reads them', () => {
  assert.equal(recordLabel('Cite Garraffo et al. (2017), ApJL 843, L33.', 'A long title'), 'Garraffo et al. (2017), ApJL 843, L33');
  assert.equal(recordLabel('This work has made use of data from the European Space Agency (ESA) mission Gaia', 'Gaia Data Release 3'), 'Gaia Data Release 3');
  assert.equal(recordLabel(undefined, 'Sanghi et al. (2026): Worlds Next Door. IV.'), 'Sanghi et al. (2026)');
  assert.equal(recordLabel(undefined, 'Reference 1918AnHar..91....1C, as the NASA Exoplanet Archive cites it.'), 'Reference 1918AnHar..91....1C, as the NASA Exoplanet Archive cites it.');
  const words = (field: string, value: number | string) => starFacts('star', { [field]: value, [`${field === 'rotationPeriodDays' ? 'rotationPeriod' : field}Source`]: 'Gaia DR3' }, new Set(), index).facts[0]?.value;
  assert.equal(words('spectralType', 'M4.0&plusmn;1.0 V'), 'M4.0±1.0 V'); assert.equal(words('spectralType', 'M1.0&plusmn0.5 V'), 'M1.0±0.5 V');
  assert.equal(words('rotationPeriodDays', 4200), '4,200 days'); assert.equal(words('rotationPeriodDays', 99.96), '100.0 days');
});

test('a fact the page already lists is never written again, under any id that says the same', () => {
  assert.deepEqual(starFacts('star', RECORD, new Set(['mass', 'surface-temperature', 'rotation-period', 'age', 'luminosity']), index).facts, []);
});

test('a day the catalogued periods contradict is held back', () => {
  const catalogued = (days: number[]) => ({ ...RECORD, rotationPeriodsCatalogued: days.map(value => ({ days: value, source: `table ${value}` })) });
  assert.equal(periodStands(RECORD), true, 'no catalogued period: it stands');
  assert.equal(periodStands(catalogued([1.5, 1.3, 1.45])), true); assert.equal(periodStands(catalogued([3.3, 3.3, 3.304])), false);
  assert.equal(periodStands(catalogued([1.4, 2.8])), true, 'two that disagree adopt none, so nothing contradicts it');
  const held = starFacts('star', catalogued([3.3, 3.3, 3.304]), new Set(), index);
  assert.equal(held.contradicted, true); assert.equal(held.facts.some(fact => fact.id === 'rotation'), false);
});
