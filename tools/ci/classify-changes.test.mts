import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { classifyChanges, classifyChangedPaths, isDocPath } from './classify-changes.mts';

const execFileAsync = promisify(execFile);

test('a Markdown file anywhere outside src/objects/ is a doc path', () => {
  assert.equal(isDocPath('README.md'), true);
  assert.equal(isDocPath('CONTRIBUTING.md'), true);
  assert.equal(isDocPath('docs/provenance/CONTRACT.md'), true);
  assert.equal(isDocPath('.github/pull_request_template.md'), true);
});

test('anything under docs/ is a doc path, including non-Markdown assets', () => {
  assert.equal(isDocPath('docs/architecture/diagram.svg'), true);
  assert.equal(isDocPath('docs/provenance/screenshot.png'), true);
});

test('LICENSE and its variants at any depth are doc paths outside src/objects/', () => {
  assert.equal(isDocPath('LICENSE'), true);
  assert.equal(isDocPath('LICENSE.md'), true);
  assert.equal(isDocPath('LICENSE.txt'), true);
});

test('a body README or any other Markdown under src/objects/ is never a doc path', () => {
  // Provenance evidence beside each object — the scene-sources README-link test and the source-catalogue tests
  // read these files as data, so they must never be classified as docs-only.
  assert.equal(isDocPath('src/objects/earth/README.md'), false);
  assert.equal(isDocPath('src/objects/earth/NOTICE.md'), false);
  assert.equal(isDocPath('src/objects/earth/source/reference/registration.md'), false);
  assert.equal(isDocPath('src/objects/earth/source/LICENSE.CC-BY-SA-4.0.md'), false);
});

test('ordinary source and config paths are not doc paths', () => {
  assert.equal(isDocPath('site/objects.mts'), false);
  assert.equal(isDocPath('tools/ci/classify-changes.mts'), false);
  assert.equal(isDocPath('package.json'), false);
  assert.equal(isDocPath('.github/workflows/universe.yml'), false);
});

test('classifyChangedPaths: all-doc changes are docs-only', () => {
  const result = classifyChangedPaths(['README.md', 'docs/provenance/CONTRACT.md', 'LICENSE']);
  assert.equal(result.docsOnly, true);
  assert.deepEqual([...result.codePaths], []);
});

test('classifyChangedPaths: one code file among many docs is not docs-only', () => {
  // Mutation check: a single non-doc path must flip the whole verdict, not just get counted alongside it.
  const result = classifyChangedPaths(['README.md', 'docs/guide.md', 'site/objects.mts']);
  assert.equal(result.docsOnly, false);
  assert.deepEqual([...result.codePaths], ['site/objects.mts']);
});

test('classifyChangedPaths: a body README mixed with a generic doc is not docs-only', () => {
  const result = classifyChangedPaths(['README.md', 'src/objects/earth/README.md']);
  assert.equal(result.docsOnly, false);
  assert.deepEqual([...result.codePaths], ['src/objects/earth/README.md']);
});

test('classifyChangedPaths: an empty diff is never docs-only', () => {
  const result = classifyChangedPaths([]);
  assert.equal(result.docsOnly, false);
});

test('classifyChanges: computes paths from the injected function and forwards mode/ref', async () => {
  const seen: Array<{ mode: string; ref: string }> = [];
  const result = await classifyChanges('pr', 'origin/main', {
    changedPaths: async (mode, ref) => { seen.push({ mode, ref }); return ['README.md']; },
  });
  assert.deepEqual(seen, [{ mode: 'pr', ref: 'origin/main' }]);
  assert.equal(result.docsOnly, true);
});

test('classifyChanges: an unresolved diff (unknown push base) is reported as code, never docs-only', async () => {
  const result = await classifyChanges('push', '0'.repeat(40), { changedPaths: async () => undefined });
  assert.equal(result.docsOnly, false);
  assert.equal(result.codePaths.length, 1);
});

async function fixtureGitRepo(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'classify-changes-'));
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Fixture'], { cwd: root });
  await mkdir(resolve(root, 'docs'), { recursive: true });
  await writeFile(resolve(root, 'README.md'), '# fixture\n');
  await writeFile(resolve(root, 'docs/guide.md'), '# guide\n');
  await writeFile(resolve(root, 'package.json'), '{}\n');
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  await execFileAsync('git', ['commit', '-q', '-m', 'base'], { cwd: root });
  await execFileAsync('git', ['checkout', '-q', '-b', 'feature'], { cwd: root });
  return root;
}

test('classifyChanges("pr", ...) reads a real three-dot diff against the base branch', async t => {
  const root = await fixtureGitRepo();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(resolve(root, 'docs/guide.md'), '# guide, updated\n');
  await execFileAsync('git', ['commit', '-q', '-am', 'docs: update the guide'], { cwd: root });
  const result = await classifyChanges('pr', 'main', { root });
  assert.deepEqual([...result.paths], ['docs/guide.md']);
  assert.equal(result.docsOnly, true);
});

test('classifyChanges("push", ...) reads a real two-dot diff against the previous tip', async t => {
  const root = await fixtureGitRepo();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { stdout: beforeSha } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
  await writeFile(resolve(root, 'package.json'), '{"changed":true}\n');
  await execFileAsync('git', ['commit', '-q', '-am', 'feat: change package.json'], { cwd: root });
  const result = await classifyChanges('push', beforeSha.trim(), { root });
  assert.deepEqual([...result.paths], ['package.json']);
  assert.equal(result.docsOnly, false);
});

test('classifyChanges("push", ...) with an all-zero before SHA never diffs and is never docs-only', async t => {
  const root = await fixtureGitRepo();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await classifyChanges('push', '0'.repeat(40), { root });
  assert.equal(result.docsOnly, false);
});
