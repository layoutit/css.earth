// Docs-only classification: a PR (or push) that touches nothing but documentation does not need the heavy
// typecheck/prepared-test/nebula jobs — Contract lint alone (doc links and placement) is enough. Depends only on
// Node built-ins, like tools/ci/object-scope-gate.mts, so it can run as an early CI step right after checkout.
import { execFile } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ChangeMode = 'pr' | 'push';

// A push event's `before` SHA is all zeros on a branch's first push (and on some force-push edge cases): there is
// no earlier state to diff against. The CLI never trusts this mode's result to skip anything (main pushes always
// run every job regardless of this classifier's output), but the classifier itself still reports honestly.
const UNKNOWN_PUSH_BASE = /^0+$/u;

async function gitChangedPaths(mode: ChangeMode, ref: string, root: string): Promise<readonly string[] | undefined> {
  if (mode === 'push' && (!ref || UNKNOWN_PUSH_BASE.test(ref))) return undefined;
  // pr: a three-dot diff against the PR's base branch, like tools/ci/object-scope-gate.mts — what the PR actually
  // introduces relative to where it branched, not every commit the base gained meanwhile.
  // push: a two-dot diff against the previous tip of the branch — exactly what this push added.
  const args = mode === 'pr'
    ? ['diff', '--no-renames', '--name-only', `${ref}...HEAD`]
    : ['diff', '--no-renames', '--name-only', ref, 'HEAD'];
  const { stdout } = await execFileAsync('git', args, { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split('\n').map(line => line.trim()).filter(Boolean);
}

const DOC_PATTERNS: readonly RegExp[] = [
  /\.md$/iu,
  /^docs\//u,
  /^LICENSE(\.[^/]+)?$/u,
];

/** Body packages keep provenance evidence (README, NOTICE, source licenses, interpretation notes, evidence
 * write-ups) beside each object under `src/objects/<id>/`, and tests read those files as data — the scene-sources
 * README-link test and the source-catalogue tests both do. None of it is "documentation" in the docs-only sense,
 * regardless of extension, so nothing under `src/objects/` is ever classified as a doc path. This is the safe
 * choice over moving those README-reading checks into Contract lint: it changes no test's location or timing. */
function isObjectPackagePath(path: string): boolean {
  return /^src\/objects\//u.test(path);
}

export function isDocPath(path: string): boolean {
  if (isObjectPackagePath(path)) return false;
  return DOC_PATTERNS.some(pattern => pattern.test(path));
}

export interface ChangeClassification {
  readonly paths: readonly string[];
  readonly docPaths: readonly string[];
  readonly codePaths: readonly string[];
  /** True only when at least one file changed and every one of them is a doc path. An empty diff is never
   * docs-only: "nothing changed" is not a reason to trust a skip. */
  readonly docsOnly: boolean;
}

/** Pure decision: given the changed paths, is this change docs-only? */
export function classifyChangedPaths(paths: readonly string[]): ChangeClassification {
  const docPaths = paths.filter(isDocPath);
  const codePaths = paths.filter(path => !isDocPath(path));
  return { paths, docPaths, codePaths, docsOnly: paths.length > 0 && codePaths.length === 0 };
}

/** Same decision, computing `paths` itself from git. When the diff cannot be computed (an unknown push base),
 * reports every path as unresolved code — never docs-only, since that is the direction that can only make CI run
 * more, not skip something that should have run. */
export async function classifyChanges(mode: ChangeMode, ref: string,
  { root = resolve(import.meta.dirname, '../..'),
    changedPaths = (m: ChangeMode, r: string) => gitChangedPaths(m, r, root) }:
  { root?: string; changedPaths?: (mode: ChangeMode, ref: string) => Promise<readonly string[] | undefined> } = {},
): Promise<ChangeClassification> {
  const paths = await changedPaths(mode, ref);
  if (paths === undefined) return { paths: [], docPaths: [], codePaths: ['(unresolved diff, treated as code)'], docsOnly: false };
  return classifyChangedPaths(paths);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , mode, ref] = process.argv;
  if (mode !== 'pr' && mode !== 'push') throw new Error('Usage: classify-changes.mts <pr|push> <ref>');
  if (!ref) throw new Error('Usage: classify-changes.mts <pr|push> <ref>');
  const result = await classifyChanges(mode, ref);
  console.log(`Touched ${result.paths.length} file(s): ${result.codePaths.length} code, ${result.docPaths.length} docs.`);
  console.log(result.docsOnly
    ? 'Classified as docs-only: the heavy CI jobs are skipped on this pull request.'
    : `Not docs-only${result.codePaths.length ? ` — for example ${result.codePaths[0]}` : ''}.`);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `docs_only=${result.docsOnly}\n`);
    appendFileSync(outputPath, `code=${!result.docsOnly}\n`);
  }
}
