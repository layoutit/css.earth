// Commit messages: every authored commit is one Conventional Commits line with no body, trailers or attribution.
// Messages Git itself writes are accepted as Git wrote them (merges, `git revert`, `--fixup`/`--squash`). The same
// rules run in the local commit-msg hook (fast feedback) and in CI over a pull request's commits
// (the enforcement, since a hook can be skipped). Depends only on Node built-ins: CI runs it right after a sparse
// checkout, before any install.
//
//   node .github/scripts/ci/commit-message.mts <message-file>      check one message (the commit-msg hook)
//   node .github/scripts/ci/commit-message.mts --range <a>..<b>    check every commit in a range (CI)
//   node .github/scripts/ci/commit-message.mts --install           install the commit-msg hook into this clone (pnpm install)
import { execFile } from 'node:child_process';
import { chmod, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] as const;
export const MAX_LENGTH = 150;
const CONVENTIONAL = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: \\S(.*\\S)?$`, 'u');
const ATTRIBUTION = /co-authored-by|generated (with|by)|🤖/iu;
const HOOK_SOURCE = '.githooks/commit-msg';
const HOOK_MARKER = 'cssearth-commit-message-hook';

/** The message as Git stores it: comment lines and trailing blank lines removed (the default `strip` cleanup). */
export function cleanMessage(raw: string): string[] {
  const lines = raw.replace(/\r\n?/gu, '\n').split('\n').filter(line => !line.startsWith('#'));
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
  while (lines.length && !lines[0]!.trim()) lines.shift();
  return lines;
}

/** Messages Git writes itself: a merge, `git revert`, and the `--fixup`/`--squash` autosquash markers. */
export function isGitGenerated(firstLine: string): boolean {
  return firstLine.startsWith('Merge ') || firstLine.startsWith('Revert "') ||
    /^(fixup|squash|amend)! /u.test(firstLine);
}

/** Why an authored message is rejected, or undefined when it is acceptable. */
export function messageProblem(raw: string): string | undefined {
  const lines = cleanMessage(raw), first = lines[0] ?? '';
  if (!first.trim()) return 'The message is empty.';
  if (isGitGenerated(first)) return undefined;
  if (lines.some(line => ATTRIBUTION.test(line))) return 'Remove attribution (Co-Authored-By, "Generated with …").';
  if (lines.length > 1) return 'Use a single line: no body and no trailers.';
  if (!CONVENTIONAL.test(first)) {
    return `Use Conventional Commits: <type>(<scope>)?!?: <summary>, with a lowercase type from ${TYPES.join(', ')}, and a scope of a-z, 0-9, ".", "_", "/" or "-" (no commas or spaces). Got: ${first}`;
  }
  if (first.length > MAX_LENGTH) return `Keep the line to ${MAX_LENGTH} characters; it has ${first.length}.`;
  return undefined;
}

export interface RangeCommit { readonly sha: string; readonly parents: number; readonly message: string }

export function rangeProblems(commits: readonly RangeCommit[]): string[] {
  return commits.flatMap(commit => {
    // A merge's message is Git's own, whatever its text.
    const problem = commit.parents > 1 ? undefined : messageProblem(commit.message);
    return problem ? [`${commit.sha.slice(0, 10)} ${cleanMessage(commit.message)[0] ?? ''}\n  ${problem}`] : [];
  });
}

const FIELD = '\u001f', RECORD = '\u001e';

async function commitsIn(range: string, root: string): Promise<RangeCommit[]> {
  const { stdout } = await execFileAsync('git', ['log', '--no-color',
    `--format=%H${FIELD}%P${FIELD}%B${RECORD}`, range],
  { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split(RECORD).map(record => record.replace(/^\n/u, '')).filter(Boolean).map(record => {
    const [sha = '', parents = '', message = ''] = record.split(FIELD);
    return { sha, parents: parents.split(' ').filter(Boolean).length, message };
  });
}

/** The hooks directory `--install` owns, inside the clone's common Git directory, so every worktree shares it. */
export const HOOKS_DIRECTORY = 'cssearth-hooks';

/** Runs the calling worktree's own tracked hook. It names no checker path, so it stays correct on every branch
 * layout, and it lives outside `.git/hooks`, which an older branch's installer overwrites. */
/** Marks a file this installer wrote into its hooks directory; nothing else there is ever overwritten. */
export const DISPATCHER_MARKER = 'cssearth-commit-msg-dispatcher';
export const DISPATCHER = `#!/bin/sh
# ${HOOK_MARKER} ${DISPATCHER_MARKER}: run this worktree's tracked ${HOOK_SOURCE}. Written by \`pnpm install\`.
root=$(git rev-parse --show-toplevel) || { echo "commit-msg: cannot find this worktree's top level; run git commit from inside the worktree." >&2; exit 1; }
[ -f "$root/${HOOK_SOURCE}" ] || { echo "commit-msg: $root/${HOOK_SOURCE} is missing; restore it (git checkout -- ${HOOK_SOURCE}), or skip once with git commit --no-verify." >&2; exit 1; }
exec sh "$root/${HOOK_SOURCE}" "$@"
`;

const git = async (root: string, ...args: string[]) => (await execFileAsync('git', args, { cwd: root })).stdout.trim();

/** Point this clone's core.hooksPath at a dispatcher that runs each worktree's own tracked hook. Git then never reads
 * `.git/hooks`, so a copy an older branch's installer writes there cannot replace the check; that installer also
 * returns early once core.hooksPath is set. Leaves any core.hooksPath already configured (including the pre-push
 * opt-in `.githooks`) and never disables a hook of the contributor's own in `.git/hooks`. */
export async function installHook(root: string): Promise<string> {
  let common: string, configured: string | undefined;
  try {
    common = resolve(root, await git(root, 'rev-parse', '--git-common-dir'));
    // `git config --get` fails when the key is unset; an explicitly empty value is a setting too, and is kept.
    configured = await git(root, 'config', '--get', 'core.hooksPath').catch(() => undefined);
  } catch {
    return 'Not a Git checkout; no hook installed.';
  }
  // Not `git rev-parse --git-path hooks`: that answers core.hooksPath once it is set.
  const legacy = resolve(common, 'hooks'), directory = resolve(common, HOOKS_DIRECTORY), target = resolve(directory, 'commit-msg');
  if (configured !== undefined && (!configured || resolve(root, configured) !== directory)) return `core.hooksPath is ${JSON.stringify(configured)}; left unchanged (${HOOK_SOURCE} applies when that path is .githooks).`;
  if (configured === undefined) {
    const own: string[] = [];
    for (const name of await readdir(legacy).catch(() => [] as string[])) {
      if (name.endsWith('.sample')) continue;
      const text = await readFile(resolve(legacy, name), 'utf8').catch(() => '');
      if (!(name === 'commit-msg' && text.includes(HOOK_MARKER))) own.push(name);
    }
    if (own.length) return `${legacy} has hooks of your own (${own.join(', ')}); left unchanged. Set core.hooksPath to run ${HOOK_SOURCE}.`;
  }
  const current = await readFile(target, 'utf8').catch(() => undefined);
  if (current !== undefined && !current.includes(DISPATCHER_MARKER)) return `${target} is not this installer's dispatcher; left unchanged.`;
  await mkdir(directory, { recursive: true });
  await writeFile(target, DISPATCHER);
  await chmod(target, 0o755);
  await git(root, 'config', 'core.hooksPath', directory);
  // The copy an earlier install left in .git/hooks is no longer read; remove it so nothing looks installed twice.
  const copy = resolve(legacy, 'commit-msg');
  if ((await readFile(copy, 'utf8').catch(() => '')).includes(HOOK_MARKER)) await rm(copy, { force: true });
  return `Installed the commit-msg hook: core.hooksPath is ${directory}.`;
}

async function main(args: readonly string[]): Promise<number> {
  const root = resolve(import.meta.dirname, '../../..');
  if (args[0] === '--install' && args.length === 1) {
    console.log(`commit-message: ${await installHook(root)}`);
    return 0;
  }
  if (args[0] === '--range' && args.length === 2 && args[1]) {
    const problems = rangeProblems(await commitsIn(args[1], root));
    if (!problems.length) return 0;
    console.error(`Commit messages must be one Conventional Commits line with no attribution:\n${problems.join('\n')}\n` +
      'Reword them (git rebase -i, then "reword"), and see CONTRIBUTING.md#commits.');
    return 1;
  }
  if (args.length === 1 && args[0] && !args[0].startsWith('--')) {
    const problem = messageProblem(await readFile(args[0], 'utf8'));
    if (!problem) return 0;
    console.error(`commit-msg: ${problem}\nSee CONTRIBUTING.md#commits. Skip once with git commit --no-verify; CI still checks.`);
    return 1;
  }
  console.error('Usage: commit-message.mts <message-file> | --range <a>..<b> | --install');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
