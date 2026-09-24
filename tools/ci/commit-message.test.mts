import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { sourceTest } from '../../tests/objects/source-test.mts';
import { MAX_LENGTH, cleanMessage, installHook, messageProblem, rangeProblems, type RangeCommit } from './commit-message.mts';
const test = sourceTest();

const execFileAsync = promisify(execFile);
const commit = (message: string, overrides: Partial<RangeCommit> = {}): RangeCommit =>
  ({ sha: 'a'.repeat(40), parents: 1, message, ...overrides });

test('one Conventional Commits line passes, with or without a scope or a breaking marker', () => {
  for (const message of ['refactor(core): move sha256 into core\n', 'fix!: drop the old reader\n', 'docs: update CLAUDE.md\n',
    'ci(commit-message): check every pull request commit', 'chore(deps/pnpm): bump the lockfile\n\n\n']) {
    assert.equal(messageProblem(message), undefined, message);
  }
});

test("Git's comment block and trailing blank lines are ignored, as git's default cleanup does", () => {
  assert.deepEqual(cleanMessage('feat: add x\n\n# Please enter the commit message\n# On branch main\n'), ['feat: add x']);
  assert.equal(messageProblem('feat: add x\r\n\r\n# comment\r\n'), undefined);
});

test('a body, a trailer or any attribution is rejected', () => {
  assert.match(messageProblem('feat: add x\n\nWhy it matters.\n') ?? '', /single line/u);
  assert.match(messageProblem('feat: add x\n\nCo-Authored-By: A Helper <helper@example.org>\n') ?? '', /attribution/u);
  assert.match(messageProblem('feat: add x\n\nCo-authored-by: Another Helper <another@example.org>\n') ?? '', /attribution/u);
  assert.match(messageProblem('feat: 🤖 Generated with a tool\n') ?? '', /attribution/u);
});

test('a title outside Conventional Commits is rejected', () => {
  for (const message of ['moved sha256 into core', 'Refactor(core): move', 'feat(Core): move', 'feat:move', 'feat: ',
    'wip: things', 'feat: trailing space ', '']) {
    assert.notEqual(messageProblem(message), undefined, JSON.stringify(message));
  }
  assert.match(messageProblem(`feat: ${'x'.repeat(MAX_LENGTH)}`) ?? '', /characters/u);
});

test('messages Git writes itself are accepted as Git wrote them', () => {
  assert.equal(messageProblem("Merge branch 'main' into feature\n"), undefined);
  assert.equal(messageProblem('Revert "feat: add x"\n\nThis reverts commit 0123456789abcdef.\n'), undefined);
  assert.equal(messageProblem('fixup! feat: add x\n'), undefined);
  assert.equal(messageProblem('squash! feat: add x\n\nmore\n'), undefined);
});

test('a range reports each offending commit and skips the format check only for merges', () => {
  const problems = rangeProblems([commit('feat: fine'), commit('bad title', { sha: 'b'.repeat(40) }),
    commit('Any merge text\n\nwith a body', { parents: 2 })]);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /^bbbbbbbbbb bad title\n {2}Use Conventional Commits/u);
});

test('the hook installs into a clone, keeps a foreign hook, and defers to core.hooksPath', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'commit-message-'));
  try {
    const git = (...args: string[]) => execFileAsync('git', args, { cwd: root });
    await git('init', '-q');
    await execFileAsync('mkdir', ['-p', resolve(root, '.githooks')]);
    await writeFile(resolve(root, '.githooks/commit-msg'), '#!/bin/sh\n# cssearth-commit-message-hook\n');
    assert.match(await installHook(root), /Installed/u);
    assert.match(await readFile(resolve(root, '.git/hooks/commit-msg'), 'utf8'), /cssearth-commit-message-hook/u);
    assert.match(await installHook(root), /Installed/u, 'reinstalling our own hook is allowed');
    await writeFile(resolve(root, '.git/hooks/commit-msg'), '#!/bin/sh\necho mine\n');
    assert.match(await installHook(root), /left unchanged/u);
    assert.equal(await readFile(resolve(root, '.git/hooks/commit-msg'), 'utf8'), '#!/bin/sh\necho mine\n');
    await git('config', 'core.hooksPath', '.githooks');
    assert.match(await installHook(root), /core\.hooksPath is \.githooks/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
