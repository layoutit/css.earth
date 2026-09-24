// Commit messages: every commit is written by a person, as one Conventional Commits line with no body, trailers or
// attribution. Only messages Git itself writes are exempt from the format (merges, `git revert`, `--fixup`/`--squash`);
// no author or committer may be a bot or an AI tool, exempt or not. The same rules run in the local commit-msg hook (fast feedback) and in CI over a pull request's commits
// (the enforcement, since a hook can be skipped). Depends only on Node built-ins: CI runs it right after a sparse
// checkout, before any install.
//
//   node tools/ci/commit-message.mts <message-file>      check one message (the commit-msg hook)
//   node tools/ci/commit-message.mts --range <a>..<b>    check every commit in a range (CI)
//   node tools/ci/commit-message.mts --install           install the commit-msg hook into this clone (pnpm install)
import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] as const;
export const MAX_LENGTH = 150;
const CONVENTIONAL = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: \\S(.*\\S)?$`, 'u');
const ATTRIBUTION = /co-authored-by|generated (with|by)|🤖/iu;
/** Identities that are not a person coding: GitHub `[bot]` accounts and AI coding tools. */
const MACHINE_IDENTITY = /\[bot\]|anthropic|claude|codex|openai|copilot|chatgpt|gemini|devin/iu;
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
    return `Use Conventional Commits: <type>(<scope>)?!?: <summary>, with a lowercase type from ${TYPES.join(', ')}.`;
  }
  if (first.length > MAX_LENGTH) return `Keep the line to ${MAX_LENGTH} characters; it has ${first.length}.`;
  return undefined;
}

export interface RangeCommit { readonly sha: string; readonly parents: number; readonly author: string;
  readonly committer: string; readonly message: string }

/** Why a commit's author or committer is not a person coding, or undefined when both are. */
export function identityProblem(commit: RangeCommit): string | undefined {
  const machine = [commit.author, commit.committer].find(identity => MACHINE_IDENTITY.test(identity));
  return machine ? `Commit as yourself, not as a bot or AI tool (${machine}).` : undefined;
}

export function rangeProblems(commits: readonly RangeCommit[]): string[] {
  return commits.flatMap(commit => {
    // A merge's message is Git's; its identities still have to be a person.
    const problem = identityProblem(commit) ?? (commit.parents > 1 ? undefined : messageProblem(commit.message));
    return problem ? [`${commit.sha.slice(0, 10)} ${cleanMessage(commit.message)[0] ?? ''}\n  ${problem}`] : [];
  });
}

const FIELD = '\u001f', RECORD = '\u001e';

async function commitsIn(range: string, root: string): Promise<RangeCommit[]> {
  const { stdout } = await execFileAsync('git', ['log', '--no-color',
    `--format=%H${FIELD}%P${FIELD}%an <%ae>${FIELD}%cn <%ce>${FIELD}%B${RECORD}`, range],
  { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split(RECORD).map(record => record.replace(/^\n/u, '')).filter(Boolean).map(record => {
    const [sha = '', parents = '', author = '', committer = '', message = ''] = record.split(FIELD);
    return { sha, parents: parents.split(' ').filter(Boolean).length, author, committer, message };
  });
}

/** Install the tracked hook as this clone's commit-msg hook, unless the clone already runs `.githooks/` or has a
 * different commit-msg hook of its own (never overwritten). A worktree shares its main clone's hooks. */
export async function installHook(root: string): Promise<string> {
  let hooksPath: string;
  try {
    const configured = await execFileAsync('git', ['config', '--get', 'core.hooksPath'], { cwd: root }).catch(() => ({ stdout: '' }));
    if (configured.stdout.trim()) return `core.hooksPath is ${configured.stdout.trim()}; ${HOOK_SOURCE} applies when that path is .githooks.`;
    hooksPath = resolve(root, (await execFileAsync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root })).stdout.trim());
  } catch {
    return 'Not a Git checkout; no hook installed.';
  }
  const target = resolve(hooksPath, 'commit-msg');
  const existing = await readFile(target, 'utf8').catch(() => undefined);
  if (existing !== undefined && !existing.includes(HOOK_MARKER)) return `${target} already exists and was left unchanged.`;
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, HOOK_SOURCE), target);
  await chmod(target, 0o755);
  return `Installed the commit-msg hook at ${target}.`;
}

async function main(args: readonly string[]): Promise<number> {
  const root = resolve(import.meta.dirname, '../..');
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
    const identity = async (name: string) => (await execFileAsync('git', ['var', name], { cwd: root })).stdout.replace(/>.*$/su, '>');
    const message = await readFile(args[0], 'utf8');
    const problem = identityProblem({ sha: '', parents: 1, author: await identity('GIT_AUTHOR_IDENT'),
      committer: await identity('GIT_COMMITTER_IDENT'), message }) ?? messageProblem(message);
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
