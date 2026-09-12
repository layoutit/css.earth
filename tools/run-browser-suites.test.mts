import assert from 'node:assert/strict';
import test from 'node:test';
import { compareWithExpectation, readSuiteExpectations } from './run-browser-suites.mts';

const passed = { suite: 'a-browser.mts', status: 'passed', seconds: 1 } as const;
const failed = { suite: 'a-browser.mts', status: 'failed', seconds: 1 } as const;

test('a routine run differs only when a result contradicts its record', () => {
  assert.equal(compareWithExpectation(passed, undefined).differs, false);
  assert.equal(compareWithExpectation(failed, undefined).differs, true);
  assert.equal(compareWithExpectation(failed, { expect: 'fail', reason: 'measured' }).differs, false);
  assert.equal(compareWithExpectation(passed, { expect: 'fail', reason: 'measured' }).differs, true);
});

test('an intermittent suite matches either outcome and keeps its reason visible', () => {
  const record = { expect: 'intermittent', reason: '2 of 4 runs timed out' } as const;
  for (const result of [passed, failed]) {
    const comparison = compareWithExpectation(result, record);
    assert.equal(comparison.differs, false);
    assert.match(comparison.note ?? '', /2 of 4 runs timed out/);
  }
});

test('the checked-in record is valid and gives every non-passing suite a reason', async () => {
  const expectations = await readSuiteExpectations();
  for (const [suite, entry] of Object.entries(expectations)) {
    if (entry.expect !== 'pass') assert.ok(entry.reason?.trim(), `${suite} needs a reason`);
  }
});
