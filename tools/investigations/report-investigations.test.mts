import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { INVESTIGATION_LEDGER_SCHEMA, type InvestigationLedger } from './investigation-ledger.mts';
import { investigationOptions, investigationReport, formatInvestigationReport } from './report-investigations.mts';

const ledger = (objectId: string): InvestigationLedger => ({ schema: INVESTIGATION_LEDGER_SCHEMA, objectId, entries: [
  { id: 'mesh', subject: 'Selected mesh', status: 'included', finding: 'Source geometry is in use; optical terrain remains unknown.', evidence: ['https://example.org/mesh'], checked: [{ date: '2026-09-13', commit: 'a'.repeat(40) }] },
  { id: 'photography', subject: 'Camera registration', status: 'unresolved', finding: 'Withheld terrain features fail registration.', revisitWhen: 'Released registered camera controls.', evidence: ['https://example.org/camera'], checked: [{ date: '2026-09-13', commit: 'b'.repeat(40) }] },
] });
const objects = [{ id: 'with-ledger', classification: 'asteroid' }, { id: 'missing-ledger', classification: 'asteroid' }, { id: 'moon', classification: 'moon' }];

test('classification coverage counts missing ledgers and does not inflate body progress with included sources', () => {
  const report = investigationReport(objects, [ledger('with-ledger'), ledger('moon')], investigationOptions(['--classification=asteroid']));
  assert.deepEqual(report.coverage, { cataloguedObjects: 2, objectsWithLedger: 1, missingLedgers: ['missing-ledger'] });
  assert.deepEqual(report.counts, { included: 1, excluded: 0, unresolved: 1, deferred: 0 });
  assert.equal(report.entries.length, 1);
  const text = formatInvestigationReport(report);
  assert.match(text, /not completed or qualified bodies/);
  assert.match(text, /Withheld terrain features fail registration/);
  assert.match(text, /Released registered camera controls/);
  assert.doesNotMatch(text, /- moon:/);
});

test('finding searches and status filters preserve scope-wide counts, and invalid options fail', () => {
  const options = investigationOptions(['--classification=asteroid', '--status=included,unresolved', '--search=optical', '--json']);
  const report = investigationReport(objects, [ledger('with-ledger')], options);
  assert.deepEqual(report.entries.map(entry => entry.id), ['mesh']);
  assert.equal(report.counts.unresolved, 1);
  assert.equal(options.json, true);
  assert.doesNotMatch(formatInvestigationReport(report, true), /finding:/);
  assert.throws(() => investigationOptions(['--status=complete']), /Choose statuses/);
  assert.throws(() => investigationOptions(['--clasification=asteroid']), /Unknown option/);
  assert.throws(() => investigationReport(objects, [], investigationOptions(['--classification=unknown'])), /Unknown object classification/);
});

test('the facilities report cannot be filtered by object classification', () => {
  assert.equal(investigationOptions(['--facilities']).facilities, true);
  assert.throws(() => investigationOptions(['--facilities', '--classification=asteroid']), /no object classification/);
});
