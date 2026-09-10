import assert from 'node:assert/strict';
import test from 'node:test';
import { explorationDate, parseAgencies, parseCapture, parseExplorationCatalog, validateCapture } from './exploration-catalog.mts';
const agencies = parseAgencies({ NASA: { name: 'NASA', sourceUrl: 'https://www.nasa.gov/' } });
const cited = <T,>(value: T) => ({ value, referenceIds: ['source'] });
function fixture() {
  return { schema: 'cssearth-spacecraft-catalog@2', references: [{ id: 'source', title: 'Mission source', url: 'https://www.nasa.gov/', checkedOn: '2026-09-10' }],
    spacecraft: [{ id: 'juno', name: cited('Juno spacecraft'), description: cited('A spacecraft.'), aliases: [], kind: cited('orbiter'), launch: cited('2011') }],
    missions: [{ id: 'juno', name: cited('Juno mission'), description: cited('An individual mission.'), agencyIds: cited(['NASA']), started: cited('2011'), participants: [{ spacecraftId: 'juno', role: 'orbiter', referenceIds: ['source'] }] }],
  };
}

test('catalogue records are immutable and separate entity domains may use the same ID', () => {
  const catalog = parseExplorationCatalog(fixture(), agencies);
  assert.equal(catalog.spacecraft[0].id, catalog.missions[0].id);
  assert.ok(Object.isFrozen(catalog.missions[0].participants[0]));
  assert.ok(Object.isFrozen(catalog.spacecraft[0].name.referenceIds));
  assert.equal(catalog.spacecraft[0].launch?.value, '2011');
  assert.equal(catalog.missions[0].status, undefined);
  assert.equal(agencies.NASA.src, undefined, 'an agency identity does not require a logo');
});

test('duplicates, unknown references, invalid agencies and ambiguous participation are rejected', () => {
  const f = fixture();
  assert.throws(() => parseExplorationCatalog({ ...f, spacecraft: [...f.spacecraft, f.spacecraft[0]] }, agencies), /Duplicate spacecraft ID/);
  assert.throws(() => parseExplorationCatalog({ ...f, references: [] }, agencies), /Missing catalogue reference/);
  assert.throws(() => parseExplorationCatalog({ ...f, schema: 'cssearth-spacecraft-catalog@1' }, agencies), /schema/);
  assert.throws(() => parseExplorationCatalog({ ...f, extra: true }, agencies), /Unexpected/);
  const mission = f.missions[0];
  for (const changed of [
    { ...mission, agencyIds: cited(['ESA']) },
    { ...mission, participants: [...mission.participants, mission.participants[0]] },
    { ...mission, participants: [{ ...mission.participants[0], spacecraftId: 'unknown' }] },
    { ...mission, status: cited({ value: 'unknown-active-state', asOf: '2026-09-10' }) },
    { ...mission, status: cited({ value: 'active' }) },
    { ...mission, started: cited('2012'), ended: cited('2011') },
    { ...mission, ended: cited('2015'), status: cited({ value: 'active', asOf: '2016-01-01' }) },
  ]) assert.throws(() => parseExplorationCatalog({ ...f, missions: [changed] }, agencies));
});

test('dates preserve source precision and reject only provable interval contradictions', () => {
  for (const date of ['2024', '2024-02', '2024-02-29']) assert.equal(explorationDate(date), date);
  for (const date of ['2023-02-29', '2024-00', '2024-13', '2024-04-31', '2024-1-1', '0000', 'yesterday']) assert.throws(() => explorationDate(date));
  const f = fixture();
  assert.doesNotThrow(() => parseExplorationCatalog({ ...f, missions: [{ ...f.missions[0], started: cited('2011-12'), ended: cited('2011') }] }, agencies));
  assert.throws(() => parseExplorationCatalog({ ...f, references: [{ ...f.references[0], url: 'javascript:alert(1)' }] }, agencies));
});

test('capture validation separates membership from observation and rejects legacy browser inference', () => {
  const catalog = parseExplorationCatalog(fixture(), agencies);
  const spacecraft = parseCapture({ attributions: [{ kind: 'spacecraft', spacecraftId: 'juno', evidence: 'A specific pinned image label.' }] });
  validateCapture(spacecraft, catalog);
  assert.equal(spacecraft.attributions[0].kind, 'spacecraft');
  assert.equal('missionId' in spacecraft.attributions[0], false);
  validateCapture(parseCapture({ attributions: [{ kind: 'mission', missionId: 'juno', evidence: 'A mission-level source credit.' }] }), catalog);
  validateCapture(parseCapture({ attributions: [{ kind: 'unresolved', label: 'A vehicle group', reason: 'Individual vehicles not identified.', evidence: 'Preserved source credit.' }] }), catalog);
  for (const input of [
    { spacecraftIds: ['juno'], evidence: 'Legacy credit' },
    { attributions: [] },
    { attributions: [{ kind: 'spacecraft', spacecraftId: 'juno', evidence: ' ' }] },
    { attributions: [{ kind: 'unresolved', label: 'Group', evidence: 'Credit' }] },
    { attributions: [...spacecraft.attributions, ...spacecraft.attributions] },
  ]) assert.throws(() => parseCapture(input));
  assert.throws(() => validateCapture(parseCapture({ attributions: [{ kind: 'mission', missionId: 'missing', evidence: 'Credit' }] }), catalog), /Unknown capture mission/);
});
