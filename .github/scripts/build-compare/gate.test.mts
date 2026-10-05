/** Enforcement cannot be skipped by omitting a declaration or changing a label. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateDecision, cancelBuild } from './gate.mts';
const ordinary = { declarationStatus: '', applicationRenames: false, labels: [], branch: 'feature' };
test('gate passes ordinary PRs but rejects every undeclared refactor marker', () => {
  assert.deepEqual(gateDecision(ordinary), { required: false, fresh: false, run: false, passes: true });
  for (const marker of [{ applicationRenames: true }, { labels: ['refactor'] }]) {
    assert.equal(gateDecision({ ...ordinary, ...marker }).passes, false);
    assert.equal(gateDecision({ ...ordinary, ...marker, declarationStatus: 'A\t.github/site-refactor.json' }).passes, true);
  }
});
test('stale declarations do not select builds; fresh declarations and requests do', () => {
  assert.equal(gateDecision(ordinary).run, false);
  for (const selection of [{ declarationStatus: 'M\t.github/site-refactor.json' }, { labels: ['compare-build'] }, { dispatch: true }]) assert.equal(gateDecision({ ...ordinary, ...selection }).run, true);
});
test('label events never cancel running builds; new pushes do', () => {
  assert.equal(cancelBuild('synchronize'), true);
  for (const action of ['opened', 'reopened', 'labeled', 'unlabeled']) assert.equal(cancelBuild(action), false);
});
test('a branch name alone never makes a pull request a refactor', () => {
  assert.equal(gateDecision({ ...ordinary, branch: 'untangle7/l3-build-compare' }).required, false);
});
