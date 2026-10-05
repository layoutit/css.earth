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
test('application inputs, tool-change and dispatch alone select builds', () => {
  assert.equal(gateDecision(ordinary).run, false);
  for (const selection of [{ applicationChanged: true }, { applicationRenames: true }, { labels: ['tool-change'] }, { dispatch: true }]) assert.equal(gateDecision({ ...ordinary, ...selection }).run, true);
});
test('label events never cancel running builds; new pushes do', () => {
  assert.equal(cancelBuild('synchronize'), true);
  for (const action of ['opened', 'reopened', 'labeled', 'unlabeled']) assert.equal(cancelBuild(action), false);
});
test('a branch name alone never makes a pull request a refactor', () => {
  assert.equal(gateDecision({ ...ordinary, branch: 'untangle7/l3-build-compare' }).required, false);
});

import { applicationPaths, applicationSource } from './source-paths.mts';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const selectionContract = (select: typeof gateDecision) => {
  for (const path of ['site/a.mts', 'src/objects/body/object.json', 'packages/engine/src/a.ts', 'astro.config.mts']) assert.equal(select({ ...ordinary, applicationChanged: applicationSource(path) }).run, true, path);
  for (const path of ['site/a.test.mts', 'src/a.spec.ts', 'packages/engine/src/a.test.ts', 'docs/a.md', '.github/scripts/a.mts', 'untangle/a.md']) assert.equal(select({ ...ordinary, applicationChanged: applicationSource(path), declarationStatus: 'M\t.github/site-refactor.json', labels: ['refactor', 'compare-build'] }).run, false, path);
  assert.equal(select({ ...ordinary, labels: ['tool-change'] }).run, true);
  assert.equal(select({ ...ordinary, dispatch: true }).run, true);
  for (const status of ['R100\0site/a.mts\0docs/a.mts\0', 'R100\0docs/a.mts\0site/a.mts\0']) assert.equal(select({ ...ordinary, applicationChanged: applicationPaths(status).length > 0 }).run, true);
  assert.deepEqual(applicationPaths('R100\0site/a.test.mts\0site/b.test.mts\0'), []);
};
test('path selection covers tests, docs/tools, declarations, labels and both rename paths', () => selectionContract(gateDecision));
test('dropping the application-input rule makes the same selection contract red', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lane-selection-mutant-'));
  try {
    await copyFile(new URL('./source-paths.mts', import.meta.url), join(root, 'source-paths.mts'));
    const source = await readFile(new URL('./gate.mts', import.meta.url), 'utf8');
    assert.ok(source.includes('Boolean(input.applicationChanged) || '));
    const path = join(root, 'gate.mts'); await writeFile(path, source.replace('Boolean(input.applicationChanged) || ', ''));
    const mutant = await import(pathToFileURL(path).href);
    assert.throws(() => selectionContract(mutant.gateDecision), assert.AssertionError);
  } finally { await rm(root, { recursive: true, force: true }); }
});
