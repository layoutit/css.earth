import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { FACILITY_SWEEP, INVESTIGATION_LEDGER_FILE, INVESTIGATION_LEDGER_SCHEMA, INVESTIGATION_STATUSES, evidenceLink, parseFacilityLedger, parseInvestigationLedger, readFacilityLedgers, readInvestigationLedgers } from './investigation-ledger.mts';
import { readInvestigationSurveys } from './investigation-survey.mts';
import { watchedSource } from './report-investigations.mts';
import { fixtureRecord } from '../contract/test-values.mts';
import { readCatalog } from '../prepare/prepare-catalog.mts';

const root = fileURLToPath(new URL('../../', import.meta.url));
/** A finding this many bodies reach the same way is shared reasoning, and belongs in one record under data/investigations. */
const SHARED_FINDING_BODIES = 3;
/** Open decisions that still name no source outside this repository. It is a backlog: it may only go down, except when a
 * decision is about this repository's own code, where there is no archive, deposit or paper to watch. */
const UNSOURCED_DECISIONS = 641;
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
  // A facility no dataset on the page credits keeps a ledger without a catalogue record.
  assert.deepEqual(ledgers.map(ledger => ledger.facilityId).filter(id => !ids.has(id)).sort(),
    ['askap', 'chara', 'gemini', 'iram-noema', 'jcmt', 'keck', 'lofar', 'sma', 'subaru']);
  // Every catalogued ground facility is swept.
  const ground = new Set((JSON.parse(catalogue) as { facilities: { id: string; setting: { value: string } }[] }).facilities
    .filter(facility => facility.setting.value === 'ground').map(facility => facility.id));
  const recorded = new Set(ledgers.map(ledger => ledger.facilityId));
  assert.deepEqual([...ground].filter(id => !recorded.has(id)), []);
});

test('a finding many bodies share lives in one shared record, and every record is shared', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const [ledgers, surveys] = await Promise.all([readInvestigationLedgers(root), readInvestigationSurveys(root, evidenceLink)]);
  const copies = new Map<string, Set<string>>(), quoted = new Map<string, Set<string>>();
  for (const ledger of ledgers) for (const entry of ledger.entries) {
    if (entry.survey) quoted.set(entry.survey, new Set([...(quoted.get(entry.survey) ?? []), ledger.objectId]));
    else copies.set(entry.finding, new Set([...(copies.get(entry.finding) ?? []), ledger.objectId]));
  }
  // Repeating the same reasoning per body buried the body-specific findings among the copies.
  const repeated = [...copies].filter(([, objects]) => objects.size >= SHARED_FINDING_BODIES)
    .map(([finding, objects]) => `${objects.size} bodies: ${finding.slice(0, 60)}`);
  assert.deepEqual(repeated, [], 'a finding repeated across bodies belongs in data/investigations');
  const orphans = [...surveys.keys()].filter(id => (quoted.get(id)?.size ?? 0) < SHARED_FINDING_BODIES);
  assert.deepEqual(orphans, [], 'every shared record is quoted by the bodies that share it');
});

test('an open decision names where the reopening evidence would appear, and the backlog only shrinks', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const ledgers = await readInvestigationLedgers(root);
  const open = ledgers.flatMap(ledger => ledger.entries.filter(entry => entry.status !== 'included'));
  // A decision reopens when new evidence appears at the source it examined, so an entry without one says nowhere to look.
  const unsourced = open.filter(entry => watchedSource(entry.evidence) === null);
  assert.ok(unsourced.length <= UNSOURCED_DECISIONS,
    `${unsourced.length} decisions name no external source; the recorded backlog is ${UNSOURCED_DECISIONS}. Give the new one its archive, deposit or paper.`);
  assert.equal(unsourced.length, UNSOURCED_DECISIONS,
    `${UNSOURCED_DECISIONS - unsourced.length} decisions gained a source; lower UNSOURCED_DECISIONS to ${unsourced.length}.`);
});
