import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { DISPATCHER_MARKER, HOOKS_DIRECTORY, MAX_LENGTH, cleanMessage, installHook, messageProblem, rangeProblems, type RangeCommit } from './commit-message.mts';
const test = sourceTest();

const execFileAsync = promisify(execFile);
const commit = (message: string, overrides: Partial<RangeCommit> = {}): RangeCommit =>
  ({ sha: 'a'.repeat(40), parents: 1, message, ...overrides });

test('one Conventional Commits line passes, with or without a scope or a breaking marker', () => {
  for (const message of ['refactor(core): move isRecord into core\n', 'fix!: drop the old reader\n', 'docs: update CLAUDE.md\n',
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
  for (const message of ['moved isRecord into core', 'Refactor(core): move', 'feat(Core): move', 'feat:move', 'feat: ',
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

/** A clone holding this checkout's tracked hook and checker, with a committer identity and one commit. */
async function hookClone() {
  const root = await mkdtemp(resolve(tmpdir(), 'commit-message-'));
  const git = (...args: string[]) => execFileAsync('git', args, { cwd: root });
  await git('init', '-q');
  await git('config', 'user.name', 'test');
  await git('config', 'user.email', 'test@example.com');
  for (const path of ['.githooks/commit-msg', '.github/scripts/ci/commit-message.mts']) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await copyFile(resolve(import.meta.dirname, '../../..', path), resolve(root, path));
  }
  await git('add', '.');
  await git('commit', '-q', '--no-verify', '-m', 'chore: start');
  const accepted = (message: string) => git('commit', '-q', '--allow-empty', '-m', message).then(() => true, () => false);
  const legacyHooks = resolve(root, '.git/hooks');
  return { root, git, accepted, legacyHooks };
}

/** What an installer from before core.hooksPath (main at the move) writes into .git/hooks: a dispatcher that looks
 * for the checker only at the old path, so it accepts everything once the checker has moved. */
const LEGACY_COPY = '#!/bin/sh\n# cssearth-commit-message-hook\n[ -f "$(git rev-parse --show-toplevel)/tools/ci/commit-message.mts" ] || exit 0\n';

test('the installed hook refuses a bad message whichever installer ran last', async () => {
  const { root, git, accepted, legacyHooks } = await hookClone();
  try {
    await mkdir(legacyHooks, { recursive: true });
    await writeFile(resolve(legacyHooks, 'commit-msg'), LEGACY_COPY, { mode: 0o755 });
    assert.equal(await accepted('Bad message'), true, 'the old copy in .git/hooks accepts anything after the move');
    // Legacy first, then this installer.
    assert.match(await installHook(root), /Installed/u);
    assert.equal((await git('config', '--get', 'core.hooksPath')).stdout.trim(), resolve(root, '.git', HOOKS_DIRECTORY));
    assert.equal(await readFile(resolve(legacyHooks, 'commit-msg'), 'utf8').catch(() => 'removed'), 'removed');
    assert.equal(await accepted('Bad message'), false);
    assert.equal(await accepted('chore: one line\n\nwith a body'), false);
    assert.equal(await accepted('chore: a good message'), true);
    // This installer first, then a legacy one writing its copy again: Git no longer reads .git/hooks.
    await writeFile(resolve(legacyHooks, 'commit-msg'), LEGACY_COPY, { mode: 0o755 });
    assert.equal(await accepted('Bad message'), false);
    assert.match(await installHook(root), /Installed/u, 'reinstalling is idempotent');
    assert.equal(await accepted('Bad message'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the installer keeps a hook of your own and any core.hooksPath already set', async () => {
  const { root, git, legacyHooks } = await hookClone();
  try {
    await mkdir(legacyHooks, { recursive: true });
    await writeFile(resolve(legacyHooks, 'pre-commit'), '#!/bin/sh\necho mine\n', { mode: 0o755 });
    assert.match(await installHook(root), /hooks of your own \(pre-commit\); left unchanged/u);
    assert.equal(await git('config', '--get', 'core.hooksPath').then(() => 'set', () => 'unset'), 'unset');
    await rm(resolve(legacyHooks, 'pre-commit'));
    await git('config', 'core.hooksPath', '.githooks');
    assert.match(await installHook(root), /core\.hooksPath is "\.githooks"; left unchanged/u);
    assert.equal((await git('config', '--get', 'core.hooksPath')).stdout.trim(), '.githooks');
    await git('config', 'core.hooksPath', '');
    assert.match(await installHook(root), /core\.hooksPath is ""; left unchanged/u, 'an explicitly empty value is a setting, not an absence');
    assert.equal((await git('config', '--get', 'core.hooksPath')).stdout, '\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the installer overwrites only its own dispatcher, and the dispatcher fails loudly', async () => {
  const { root, git, accepted } = await hookClone();
  try {
    const target = resolve(root, '.git', HOOKS_DIRECTORY, 'commit-msg');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, '#!/bin/sh\n# cssearth-commit-message-hook but not the dispatcher\n', { mode: 0o755 });
    assert.match(await installHook(root), /not this installer's dispatcher; left unchanged/u);
    assert.equal(await readFile(target, 'utf8'), '#!/bin/sh\n# cssearth-commit-message-hook but not the dispatcher\n');
    await rm(target);
    assert.match(await installHook(root), /Installed/u);
    assert.match(await readFile(target, 'utf8'), new RegExp(DISPATCHER_MARKER, 'u'));
    await git('rm', '-q', '--cached', '.githooks/commit-msg');
    await rm(resolve(root, '.githooks/commit-msg'));
    const missing = await git('commit', '-q', '--allow-empty', '-m', 'chore: fine').then(() => '', (error: { stderr: string }) => error.stderr);
    assert.match(missing, /\.githooks\/commit-msg is missing; restore it/u);
    assert.equal(await accepted('chore: fine'), false);
    const outside = await mkdtemp(resolve(tmpdir(), 'commit-message-outside-'));
    try {
      const run = await execFileAsync('sh', [target, 'message'], { cwd: outside, env: { ...process.env, GIT_CEILING_DIRECTORIES: outside } })
        .then(() => ({ code: 0, stderr: '' }), (error: { code: number; stderr: string }) => error);
      assert.equal(run.code, 1);
      assert.match(run.stderr, /cannot find this worktree's top level/u);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
