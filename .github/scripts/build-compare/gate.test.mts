/** Enforcement cannot be skipped by omitting a declaration or changing a label. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateDecision, cancelBuild } from './gate.mts';
const ordinary = { declarationStatus: '', siteRenames: false, labels: [], branch: 'feature' };
test('gate passes ordinary PRs but rejects every undeclared refactor marker', () => {
  assert.deepEqual(gateDecision(ordinary), { required: false, fresh: false, run: false, passes: true });
  for (const marker of [{ siteRenames: true }, { labels: ['refactor'] }]) {
    assert.equal(gateDecision({ ...ordinary, ...marker }).passes, false);
    assert.equal(gateDecision({ ...ordinary, ...marker, declarationStatus: 'A\t.github/site-refactor.json' }).passes, true);
  }
});
test('application inputs, tool-change and dispatch alone select builds', () => {
  assert.equal(gateDecision(ordinary).run, false);
  for (const selection of [{ applicationChanged: true }, { siteRenames: true }, { labels: ['tool-change'] }, { dispatch: true }]) assert.equal(gateDecision({ ...ordinary, ...selection }).run, true);
});
test('label events never cancel running builds; new pushes do', () => {
  assert.equal(cancelBuild('synchronize'), true);
  for (const action of ['opened', 'reopened', 'labeled', 'unlabeled']) assert.equal(cancelBuild(action), false);
});
test('a branch name alone never makes a pull request a refactor', () => {
  assert.equal(gateDecision({ ...ordinary, branch: 'untangle7/l3-build-compare' }).required, false);
});

import { applicationPaths, applicationSource, hasSiteRenames, siteSource } from './source-paths.mts';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const selectionContract = (select: typeof gateDecision) => {
  for (const path of ['site/a.mts', 'src/objects/body/object.json', 'packages/engine/src/a.ts', 'site/astro.config.mts']) assert.equal(select({ ...ordinary, applicationChanged: applicationSource(path) }).run, true, path);
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

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
async function renameCase(from: string, to: string): Promise<boolean> {
  const root = await mkdtemp(join(tmpdir(), 'gate-renames-'));
  try {
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: 'pipe' });
    git('init', '--quiet');
    mkdirSync(join(root, from, '..'), { recursive: true });
    await writeFile(join(root, from), 'export const value = 1;\n'.repeat(20));
    git('add', '-A'); git('commit', '--quiet', '-m', 'base');
    const base = git('rev-parse', 'HEAD').toString().trim();
    mkdirSync(join(root, to, '..'), { recursive: true });
    git('mv', from, to); git('commit', '--quiet', '-m', 'move');
    return hasSiteRenames(root, base, 'HEAD');
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('only renames or moves under site/ need a declaration', async () => {
  assert.equal(await renameCase('site/a.mts', 'site/world/a.mts'), true, 'a move inside site');
  assert.equal(await renameCase('site/a.mts', 'packages/engine/src/a.mts'), true, 'a move out of site');
  assert.equal(await renameCase('docs/a.mts', 'site/a.mts'), true, 'a move into site');
  assert.equal(await renameCase('src/objects/a/object.json', 'src/objects/b/object.json'), false, 'object data moves are not plan 7');
  assert.equal(await renameCase('packages/engine/src/a.ts', 'packages/engine/src/b/a.ts'), false, 'package moves are not plan 7');
  assert.equal(await renameCase('site/a.test.mts', 'site/world/a.test.mts'), false, 'tests are not application sources');
  assert.equal(siteSource('site/a.mts'), true);
  assert.equal(siteSource('src/objects/a.json'), false);
  assert.equal(siteSource('astro.config.mts'), false);
});
test('widening the rename rule back to every application source makes the site-only contract red', async () => {
  const sourcePaths = await readFile(new URL('./source-paths.mts', import.meta.url), 'utf8');
  assert.ok(sourcePaths.includes("siteSource(old) || siteSource(next)"));
  const mutant = sourcePaths.replace('siteSource(old) || siteSource(next)', 'applicationSource(old) || applicationSource(next)');
  assert.notEqual(mutant, sourcePaths);
  const root = await mkdtemp(join(tmpdir(), 'gate-mutant-'));
  try {
    await writeFile(join(root, 'source-paths.mts'), mutant);
    const loaded = await import(pathToFileURL(join(root, 'source-paths.mts')).href) as typeof import('./source-paths.mts');
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: 'pipe' });
    git('init', '--quiet'); mkdirSync(join(root, 'src/objects/a'), { recursive: true });
    await writeFile(join(root, 'src/objects/a/object.json'), '{"value":1}\n'.repeat(20));
    git('add', 'src'); git('commit', '--quiet', '-m', 'base');
    const base = git('rev-parse', 'HEAD').toString().trim();
    mkdirSync(join(root, 'src/objects/b'), { recursive: true });
    git('mv', 'src/objects/a/object.json', 'src/objects/b/object.json'); git('commit', '--quiet', '-m', 'move');
    assert.equal(loaded.hasSiteRenames(root, base, 'HEAD'), true, 'the mutant declares object data moves as plan 7 refactors');
    assert.equal(await renameCase('src/objects/a/object.json', 'src/objects/b/object.json'), false, 'the real rule does not');
  } finally { await rm(root, { recursive: true, force: true }); }
});
