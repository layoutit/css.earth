import assert from 'node:assert/strict';
import test from 'node:test';
import { classify, failingDiagnostics, runObjectTests } from './test-objects.mts';

const tap = (name: string, diagnostics: string) => `TAP version 13\n# Subtest: ${name}\nnot ok 1 - ${name}\n  ---\n  duration_ms: 1\n  location: '/x.test.mts:3:1'\n  failureType: 'testCodeFailure'\n  error: |-\n${diagnostics}\n  code: 'ERR_ASSERTION'\n  ...\n1..1\n`;
const enoent = tap('reads a shape', "    ENOENT: no such file or directory, open '/repo/src/objects/ida/source/shape/ida.obj'");
const coverage = tap('agenor: closes its sources', '    Agenor source manifest coverage failed. Undeclared: none. Missing: reference/neowise-selected.csv.');
const assertion = tap('keeps a count', '    Expected values to be strictly equal:\n  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n    actual: 0\n    expected: 1');
const loadFailure = "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/repo/src/objects/io/prepared/runtime.json' imported from /repo/tests/objects/unit/io/features.test.mts\n" +
  "TAP version 13\n# Subtest: /repo/tests/objects/unit/io/features.test.mts\nnot ok 1 - /repo/tests/objects/unit/io/features.test.mts\n  ---\n  exitCode: 1\n  signal: ~\n  error: 'test failed'\n  ...\n1..1\n";
const absent = () => false, present = () => true;
const unitFile = '/repo/tests/objects/unit/ida/source.test.mts', sharedFile = '/repo/tests/objects/unit/asteroid-calibration.test.mts';

test('failing diagnostics are cut per failing test from a TAP stream', () => {
  assert.equal(failingDiagnostics(enoent).length, 1);
  assert.equal(failingDiagnostics(enoent + coverage.replace('ok 1', 'ok 2')).length, 2);
  assert.deepEqual(failingDiagnostics('TAP version 13\nok 1 - fine\n1..1\n'), []);
});

test('a file passes on exit 0, skips only when every failure names an absent local input, and fails otherwise', () => {
  assert.deepEqual(classify(0, '', true), { status: 'passed', detail: '' });
  assert.deepEqual(classify(1, enoent, true, unitFile, '/repo', absent), { status: 'skipped', detail: 'missing local input /repo/src/objects/ida/source/shape/ida.obj' });
  // The named path exists, so the failure is not a missing input.
  assert.equal(classify(1, enoent, true, unitFile, '/repo', present).status, 'failed');
  assert.equal(classify(1, enoent, false, unitFile, '/repo', absent).status, 'failed');
  assert.equal(classify(1, enoent + assertion.replace('ok 1', 'ok 2'), true, unitFile, '/repo', absent).status, 'failed');
  assert.deepEqual(classify(1, assertion, true, unitFile, '/repo', absent), { status: 'failed', detail: 'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:' });
  assert.deepEqual(classify(2, 'Error: crashed before any test\n', true, unitFile, '/repo', absent), { status: 'failed', detail: 'exit 2' });
});

test('source coverage resolves the missing path against the object named by the directory or the test prefix', () => {
  const checked: string[] = [];
  const exists = (path: string) => { checked.push(path); return false; };
  assert.equal(classify(1, coverage, true, sharedFile, '/repo', exists).detail, 'missing local input src/objects/agenor/source/reference/neowise-selected.csv');
  assert.equal(classify(1, coverage, true, '/repo/tests/objects/unit/ajax/source.test.mts', '/repo', exists).detail, 'missing local input src/objects/ajax/source/reference/neowise-selected.csv');
  assert.deepEqual(checked, ['/repo/src/objects/agenor/source/reference/neowise-selected.csv', '/repo/src/objects/ajax/source/reference/neowise-selected.csv']);
});

test('a file that fails to load is judged by its stderr error, not by the TAP placeholder', () => {
  assert.deepEqual(classify(1, loadFailure, true, '/repo/tests/objects/unit/io/features.test.mts', '/repo', absent), { status: 'skipped', detail: 'missing local input /repo/src/objects/io/prepared/runtime.json' });
  assert.equal(classify(1, loadFailure, true, '/repo/tests/objects/unit/io/features.test.mts', '/repo', present).status, 'failed');
  assert.match(classify(1, loadFailure, false, '/repo/tests/objects/unit/io/features.test.mts', '/repo', absent).detail, /Cannot find module/);
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
