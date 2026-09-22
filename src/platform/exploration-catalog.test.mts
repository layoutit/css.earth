import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { explorationDate, parseAgencies, parseCapture, parseExplorationCatalog as parse, validateCapture } from './exploration-catalog.mts';
const agencies = parseAgencies({ NASA: { name: 'NASA', sourceUrl: 'https://www.nasa.gov/' } });
import { parseSourceCatalog, sourceResolver } from './source-catalog.mts';
const sources = sourceResolver(parseSourceCatalog({schema:'cssearth-source-catalog@1',records:[{
  id:'source',title:'Mission source',kind:'reference-page',identityLevel:'work',identifiers:[],relations:[],statements:[],
  links:[{role:'landing',url:'https://www.nasa.gov/',label:'NASA'}],evidence:[{path:'tests/source.json',locator:'/source'}],
}]}));
const parseExplorationCatalog = (raw: unknown, agencies: Parameters<typeof parse>[1]) => parse(raw,agencies,sources);
const cited = <T,>(value: T) => ({ value, citations: [{catalogueId:'source',checkedOn:'2026-09-10'}] });
function fixture() {
  return { schema: 'cssearth-facility-catalog@4',
    facilities: [{ id: 'juno', name: cited('Juno spacecraft'), description: cited('A spacecraft.'), aliases: [], kind: cited('orbiter'), setting: cited('space'), launch: cited('2011') }],
    missions: [{ id: 'juno', name: cited('Juno mission'), description: cited('An individual mission.'), agencyIds: cited(['NASA']), started: cited('2011'), participants: [{ facilityId: 'juno', role: 'orbiter', citations: cited('').citations }] }],
  };
}

test('catalogue records are immutable and separate entity domains may use the same ID', () => {
  const catalog = parseExplorationCatalog(fixture(), agencies);
  assert.equal(catalog.facilities[0].id, catalog.missions[0].id);
  assert.ok(Object.isFrozen(catalog.missions[0].participants[0]));
  assert.ok(Object.isFrozen(catalog.facilities[0].name.citations));
  assert.equal(catalog.facilities[0].launch?.value, '2011');
  assert.equal(catalog.missions[0].status, undefined);
  assert.equal(agencies.NASA.src, undefined, 'an agency identity does not require a logo');
});

test('duplicates, unknown references, invalid agencies and ambiguous participation are rejected', () => {
  const f = fixture();
  assert.throws(() => parseExplorationCatalog({ ...f, facilities: [...f.facilities, f.facilities[0]] }, agencies), /Duplicate facility ID/);
  assert.throws(() => parse(f, agencies, {}), /Unknown citation source/);
  assert.throws(() => parseExplorationCatalog({ ...f, schema: 'cssearth-facility-catalog@1' }, agencies), /schema/);
  assert.throws(() => parseExplorationCatalog({ ...f, extra: true }, agencies), /Unexpected/);
  const mission = f.missions[0];
  for (const changed of [
    { ...mission, agencyIds: cited(['ESA']) },
    { ...mission, participants: [...mission.participants, mission.participants[0]] },
    { ...mission, participants: [{ ...mission.participants[0], facilityId: 'unknown' }] },
    { ...mission, status: cited({ value: 'unknown-active-state', asOf: '2026-09-10' }) },
    { ...mission, status: cited({ value: 'active' }) },
    { ...mission, started: cited('2012'), ended: cited('2011') },
    { ...mission, ended: cited('2015'), status: cited({ value: 'active', asOf: '2016-01-01' }) },
  ]) assert.throws(() => parseExplorationCatalog({ ...f, missions: [changed] }, agencies));
});

test('a mission short name is cited and shorter than its full name', () => {
  const f = fixture();
  const mission = { ...f.missions[0], name: cited('Juno Jupiter Orbiter'), shortName: cited('Juno') };
  const parsed = parseExplorationCatalog({ ...f, missions: [mission] }, agencies).missions[0];
  assert.equal(parsed.shortName?.value, 'Juno');
  assert.equal(parsed.name.value, 'Juno Jupiter Orbiter');
  assert.ok(Object.isFrozen(parsed.shortName?.citations));
  assert.equal(parseExplorationCatalog(f, agencies).missions[0].shortName, undefined, 'a short name is optional');
  for (const shortName of [cited(''), cited('Juno Jupiter Orbiter'), 'Juno'])
    assert.throws(() => parseExplorationCatalog({ ...f, missions: [{ ...mission, shortName }] }, agencies));
});

test('dates preserve source precision and reject only provable interval contradictions', () => {
  for (const date of ['2024', '2024-02', '2024-02-29']) assert.equal(explorationDate(date), date);
  for (const date of ['2023-02-29', '2024-00', '2024-13', '2024-04-31', '2024-1-1', '0000', 'yesterday']) assert.throws(() => explorationDate(date));
  const f = fixture();
  assert.doesNotThrow(() => parseExplorationCatalog({ ...f, missions: [{ ...f.missions[0], started: cited('2011-12'), ended: cited('2011') }] }, agencies));
  assert.throws(() => parseExplorationCatalog({ ...f, facilities: [{...f.facilities[0],name:{value:'Juno',citations:[{catalogueId:'source',checkedOn:'2023-02-29'}]}}] }, agencies));
});

test('capture validation separates membership from observation and rejects legacy browser inference', () => {
  const catalog = parseExplorationCatalog(fixture(), agencies);
  const facility = parseCapture({ attributions: [{ kind: 'facility', facilityId: 'juno', evidence: 'A specific pinned image label.' }] });
  validateCapture(facility, catalog);
  assert.equal(facility.attributions[0].kind, 'facility');
  assert.equal('missionId' in facility.attributions[0], false);
  validateCapture(parseCapture({ attributions: [{ kind: 'mission', missionId: 'juno', evidence: 'A mission-level source credit.' }] }), catalog);
  validateCapture(parseCapture({ attributions: [{ kind: 'unresolved', label: 'A vehicle group', reason: 'Individual vehicles not identified.', evidence: 'Preserved source credit.' }] }), catalog);
  for (const input of [
    { facilityIds: ['juno'], evidence: 'Legacy credit' },
    { attributions: [] },
    { attributions: [{ kind: 'facility', facilityId: 'juno', evidence: ' ' }] },
    { attributions: [{ kind: 'unresolved', label: 'Group', evidence: 'Credit' }] },
    { attributions: [...facility.attributions, ...facility.attributions] },
  ]) assert.throws(() => parseCapture(input));
  assert.throws(() => validateCapture(parseCapture({ attributions: [{ kind: 'mission', missionId: 'missing', evidence: 'Credit' }] }), catalog), /Unknown capture mission/);
});

test('a ground facility is sited and retired instead of launched', () => {
  const f = fixture();
  const arecibo = { id: 'arecibo-305m', name: cited('Arecibo 305-m antenna'), description: cited('A fixed spherical reflector.'),
    aliases: [], kind: cited('radar-telescope'), setting: cited('ground'), commissioned: cited('1963'), retired: cited('2020'),
    band: cited('Radar'), site: cited({ latitude: 18.344219, longitude: 293.247306, altitude: 453.34 }) };
  const catalog = parseExplorationCatalog({ ...f, facilities: [...f.facilities, arecibo] }, agencies);
  const record = catalog.facilities[1];
  assert.equal(record.setting.value, 'ground');
  assert.equal(record.launch, undefined);
  assert.equal(record.site?.value.altitude, 453.34);
  assert.equal(record.band?.value, 'Radar');
  assert.ok(Object.isFrozen(record.site?.value));
  assert.throws(() => parseExplorationCatalog({ ...f, facilities: [{ ...arecibo, launch: cited('1963') }] }, agencies), /cannot be launched/);
  assert.throws(() => parseExplorationCatalog({ ...f, facilities: [{ ...f.facilities[0], site: cited({ latitude: 0, longitude: 0 }) }] }, agencies), /cannot be sited/);
  assert.throws(() => parseExplorationCatalog({ ...f, facilities: [{ ...arecibo, retired: cited('1962') }] }, agencies), /retired before/);
  assert.throws(() => parseExplorationCatalog({ ...f, facilities: [{ ...arecibo, site: cited({ latitude: 91, longitude: 0 }) }] }, agencies), /site coordinate/);
});


test('capture observations preserve unknown metadata and reject unsupported dates', () => {
  const attributions = [{ kind: 'facility', facilityId: 'juno', evidence: 'Preserved image label.' }];
  const observation = { id: 'image-1', target: 'Jupiter', observedAt: null, instrument: null, bands: 'Visible', evidence: 'Pinned image label.' };
  assert.deepEqual(parseCapture({ attributions, observation }).observation, observation);
  for (const invalid of [{ ...observation, evidence: '' }, { ...observation, target: '' }, { ...observation, observedAt: '2023-02-29' }, { ...observation, bands: undefined }])
    assert.throws(() => parseCapture({ attributions, observation: invalid }));
});
