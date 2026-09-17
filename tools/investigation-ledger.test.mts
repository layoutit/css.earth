import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_OBJECTS } from '../site/objects.mts';
import { FACILITY_SWEEP, INVESTIGATION_LEDGER_FILE, INVESTIGATION_LEDGER_SCHEMA, parseFacilityLedger, parseInvestigationLedger, readFacilityLedgers, readInvestigationLedgers } from './investigation-ledger.mts';
import { fixtureRecord } from './test-values.mts';
import { readCatalog } from './prepare-catalog.mts';

const root = fileURLToPath(new URL('../', import.meta.url));
// The source survey a body README used to carry: list items led by a bold decision such as Included, Excluded or Selected.
const SURVEY_ITEM = /^\s*[-*] \*\*(?:Included|Excluded|Unresolved|Deferred|Selected|Superseded|Not selected|Older interpretation|Literature)\b/m;
// This is deliberately limited to an explicit README section title. Bodies may still use
// source tables or source-method prose without duplicating an investigation survey.
const SOURCE_SURVEY_HEADING = /^\s*#{2,6}\s+(?:focused\s+)?source survey(?:\s+(?:and|&)\b.*)?\s*$/im;

test('every catalogued asteroid retains its source investigation decisions', async () => {
  const [objects, ledgers] = await Promise.all([readCatalog(resolve(root, 'src/objects')), readInvestigationLedgers(root)]);
  const recorded = new Set(ledgers.map(ledger => ledger.objectId));
  const asteroids = objects.filter(object => object.classification === 'asteroid');
  assert.ok(asteroids.length > 0);
  assert.deepEqual(asteroids.filter(object => !recorded.has(object.id)).map(object => object.id), [], 'New asteroid packages need a ledger linked by their README.');
});

test('every comet has a ledger, and each ledger parses with a README link instead of a repeated source survey', async () => {
  const [objects, ledgers] = await Promise.all([readCatalog(resolve(root, 'src/objects')), readInvestigationLedgers(root)]);
  assert.ok(ledgers.length > 0, 'At least one object keeps an investigation ledger.');
  const asteroidIds = new Set(objects.filter(object => object.classification === 'asteroid').map(object => object.id));
  const recordedObjects = new Set(ledgers.map(({ objectId }) => objectId));
  for (const object of SCENE_OBJECTS.filter(object => object.classification === 'comet')) {
    assert.ok(recordedObjects.has(object.id), `${object.id} keeps its investigation history beside the body.`);
  }
  for (const { objectId } of ledgers) {
    const readme = await readFile(resolve(root, 'src/objects', objectId, 'README.md'), 'utf8');
    assert.ok(readme.includes(`](${INVESTIGATION_LEDGER_FILE})`), `${objectId} README links its investigation ledger.`);
    assert.doesNotMatch(readme, SURVEY_ITEM, `${objectId} README leaves its source survey to the ledger.`);
    if (asteroidIds.has(objectId)) assert.doesNotMatch(readme, SOURCE_SURVEY_HEADING, `${objectId} README leaves its explicit source-survey section to the ledger.`);
  }
});

const commit = (character: string) => character.repeat(40);
const fixture = () => ({ schema: INVESTIGATION_LEDGER_SCHEMA, objectId: 'fixture', entries: [
  { id: 'radar-shape', subject: 'Radar shape model', status: 'included', finding: 'Supplies the displayed geometry.',
    evidence: ['https://doi.org/10.0000/example'], checked: [{ date: '2026-09-13', commit: commit('a') }] },
  { id: 'flyby-photograph', subject: 'Flyby photograph as a photographic lens', status: 'deferred', finding: 'Placement was matched by eye.',
    revisitWhen: 'A measured camera or surface control points for this mesh.',
    evidence: [`https://github.com/layoutit/css.earth/blob/${commit('b')}/src/objects/fixture/README.md#L1`],
    checked: [{ date: '2026-09-13', commit: commit('b'), pr: 183 }] },
] });

test('a ledger entry states its decision, pinned evidence and what would reopen it', () => {
  assert.equal(parseInvestigationLedger(fixture(), 'fixture').entries.length, 2);
  const refusals: [string, (ledger: unknown) => void][] = [
    ['another object', ledger => { fixtureRecord(ledger).objectId = 'other'; }],
    ['an unknown field', ledger => { fixtureRecord(ledger, 'entries', 0).note = 'extra'; }],
    ['an unknown status', ledger => { fixtureRecord(ledger, 'entries', 0).status = 'maybe'; }],
    ['a duplicate id', ledger => { fixtureRecord(ledger, 'entries', 1).id = 'radar-shape'; }],
    ['an open decision without a revisit condition', ledger => { delete fixtureRecord(ledger, 'entries', 1).revisitWhen; }],
    ['a revisit condition on an included source', ledger => { fixtureRecord(ledger, 'entries', 0).revisitWhen = 'Never.'; }],
    ['a repository link to a moving branch', ledger => { fixtureRecord(ledger, 'entries', 1).evidence = ['https://github.com/layoutit/css.earth/blob/main/src/objects/fixture/README.md']; }],
    ['a plain http link', ledger => { fixtureRecord(ledger, 'entries', 0).evidence = ['http://example.org/source']; }],
    ['no evidence', ledger => { fixtureRecord(ledger, 'entries', 0).evidence = []; }],
    ['an abbreviated commit', ledger => { fixtureRecord(ledger, 'entries', 0, 'checked', 0).commit = 'a1570599b'; }],
    ['an impossible date', ledger => { fixtureRecord(ledger, 'entries', 0, 'checked', 0).date = '2026-02-30'; }],
    ['a multi-line finding', ledger => { fixtureRecord(ledger, 'entries', 0).finding = 'First line.\nSecond line.'; }],
  ];
  for (const [label, change] of refusals) {
    const ledger = fixture();
    change(ledger);
    assert.throws(() => parseInvestigationLedger(ledger, 'fixture'), TypeError, `Refuses ${label}.`);
  }
});

test('a facility ledger answers the sweep first and names its own facility', () => {
  const entry = (id: string) => ({ id, subject: `Facility ${id}`, status: 'deferred', finding: 'Not examined.', revisitWhen: 'The facility is swept.',
    evidence: ['https://example.org/facility'], checked: [{ date: '2026-09-17', commit: commit('c') }] });
  const ledger = () => ({ schema: INVESTIGATION_LEDGER_SCHEMA, facilityId: 'fixture-telescope', entries: [...FACILITY_SWEEP.map(entry), entry('instrument-from-raw')] });
  assert.equal(parseFacilityLedger(ledger(), 'fixture-telescope').entries.length, 4);
  assert.throws(() => parseFacilityLedger(ledger(), 'another-telescope'), /expects facilityId/);
  const withoutPolicy = ledger(); withoutPolicy.entries = withoutPolicy.entries.filter(item => item.id !== 'data-policy');
  assert.throws(() => parseFacilityLedger(withoutPolicy, 'fixture-telescope'), /facility sweep first: data-policy/);
  assert.throws(() => parseFacilityLedger({ ...ledger(), objectId: 'fixture-telescope' }, 'fixture-telescope'), /unknown field objectId/);
});

test('every facility ledger parses, and a catalogued facility keeps its catalogue id', async () => {
  const [ledgers, catalogue] = await Promise.all([readFacilityLedgers(root), readFile(resolve(root, 'site/source/facilities/catalog.json'), 'utf8')]);
  const ids = new Set((JSON.parse(catalogue) as { facilities: { id: string }[] }).facilities.map(facility => facility.id));
  assert.ok(ledgers.some(ledger => ledger.facilityId === 'vlti') && ledgers.some(ledger => ledger.facilityId === 'alma'));
  // CHARA keeps a ledger without a page record: no dataset on the page credits it.
  assert.deepEqual(ledgers.map(ledger => ledger.facilityId).filter(id => !ids.has(id)), ['chara']);
});
