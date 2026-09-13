import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVESTIGATION_LEDGER_FILE, INVESTIGATION_LEDGER_SCHEMA, parseInvestigationLedger, readInvestigationLedgers } from './investigation-ledger.mts';
import { fixtureRecord } from './test-values.mts';

const root = fileURLToPath(new URL('../', import.meta.url));
// The source survey a body README used to carry: list items led by a bold decision such as Included, Excluded or Selected.
const SURVEY_ITEM = /^\s*[-*] \*\*(?:Included|Excluded|Unresolved|Deferred|Selected|Superseded|Not selected|Older interpretation|Literature)\b/m;

test('every investigation ledger parses, and its body README links it instead of repeating a source survey', async () => {
  const ledgers = await readInvestigationLedgers(root);
  assert.ok(ledgers.length > 0, 'At least one object keeps an investigation ledger.');
  for (const { objectId } of ledgers) {
    const readme = await readFile(resolve(root, 'src/objects', objectId, 'README.md'), 'utf8');
    assert.ok(readme.includes(`](${INVESTIGATION_LEDGER_FILE})`), `${objectId} README links its investigation ledger.`);
    assert.doesNotMatch(readme, SURVEY_ITEM, `${objectId} README leaves its source survey to the ledger.`);
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
