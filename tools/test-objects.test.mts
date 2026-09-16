import assert from 'node:assert/strict';
import test from 'node:test';
import { classify, failingDiagnostics, runObjectTests } from './test-objects.mts';

const tap = (name: string, diagnostics: string) => `TAP version 13\n# Subtest: ${name}\nnot ok 1 - ${name}\n  ---\n  duration_ms: 1\n  location: '/x.test.mts:3:1'\n  failureType: 'testCodeFailure'\n  error: |-\n${diagnostics}\n  code: 'ERR_ASSERTION'\n  ...\n1..1\n`;
const enoent = tap('reads a shape', "    ENOENT: no such file or directory, open '/repo/src/objects/ida/source/shape/ida.obj'");
const coverage = tap('closes its sources', '    Agenor source manifest coverage failed. Undeclared: none. Missing: reference/neowise-selected.csv.');
const assertion = tap('keeps a count', '    Expected values to be strictly equal:\n  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n    actual: 0\n    expected: 1');

test('failing diagnostics are cut per failing test from a TAP stream', () => {
  assert.equal(failingDiagnostics(enoent).length, 1);
  assert.equal(failingDiagnostics(enoent + coverage.replace('ok 1', 'ok 2')).length, 2);
  assert.deepEqual(failingDiagnostics('TAP version 13\nok 1 - fine\n1..1\n'), []);
});

test('a file passes on exit 0, skips only when every failure names a missing local input, and fails otherwise', () => {
  assert.deepEqual(classify(0, '', true), { status: 'passed', detail: '' });
  assert.deepEqual(classify(1, enoent, true), { status: 'skipped', detail: 'missing local input /repo/src/objects/ida/source/shape/ida.obj' });
  assert.deepEqual(classify(1, coverage, true), { status: 'skipped', detail: 'missing local input reference/neowise-selected.csv' });
  assert.equal(classify(1, enoent, false).status, 'failed');
  assert.equal(classify(1, enoent + assertion.replace('ok 1', 'ok 2'), true).status, 'failed');
  assert.deepEqual(classify(1, assertion, true), { status: 'failed', detail: 'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:' });
  assert.deepEqual(classify(2, 'Error: crashed before any test\n', true), { status: 'failed', detail: 'exit 2' });
});

test('the runner reports per file, sorted, and counts each status', async () => {
  const files = ['/repo/tests/objects/unit/b/source.test.mts', '/repo/tests/objects/unit/a/prepared.test.mts', '/repo/tests/objects/unit/c/features.test.mts'];
  const outputs: Record<string, { exitCode: number; output: string }> = {
    [files[0]]: { exitCode: 1, output: enoent }, [files[1]]: { exitCode: 0, output: '' }, [files[2]]: { exitCode: 1, output: assertion },
  };
  const report = await runObjectTests({ root: '/repo', files, skipMissingInputs: true, concurrency: 2, run: async file => outputs[file] });
  assert.deepEqual(report.results.map(result => [result.file, result.status]), [
    ['tests/objects/unit/a/prepared.test.mts', 'passed'], ['tests/objects/unit/b/source.test.mts', 'skipped'], ['tests/objects/unit/c/features.test.mts', 'failed'],
  ]);
  assert.deepEqual([report.passed, report.failed, report.skipped], [1, 1, 1]);
  await assert.rejects(runObjectTests({ root: '/repo', files, concurrency: 0, run: async file => outputs[file] }), /positive integer/);
});
