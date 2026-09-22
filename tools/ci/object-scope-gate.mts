// The object-scope gate: an ordinary PR should touch a small, reviewable set of bodies. A PR that spans many
// `src/objects/<id>/` directories at once is usually a shared-pipeline change (a tool, a schema, a shared
// template) rather than body-specific work, and deserves the explicit `pipeline-change` label instead of sliding
// through the same review depth as a one-body PR. Depends only on Node built-ins: it needs no installed
// dependency to run as an early CI step, right after checkout.
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const DEFAULT_OBJECT_DIRECTORY_LIMIT = 12;
export const PIPELINE_CHANGE_LABEL = 'pipeline-change';

async function gitChangedPaths(ref: string, root: string): Promise<string[]> {
  // --no-renames: with rename detection on, `git diff --name-only` reports only a renamed file's new path, so
  // moving every file out of a directory (or from many directories into one) can report zero or one changed
  // directory instead of every one actually touched. Two paths (old and new) is the correct, uninflated count for
  // this gate: it only ever compares a path's leading `src/objects/<id>/` segment, so a same-object rename still
  // counts as one directory either way, and only a cross-object move counts twice — the two directories it truly
  // touches.
  const { stdout } = await execFileAsync('git', ['diff', '--no-renames', '--name-only', `${ref}...HEAD`], { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split('\n').map(line => line.trim()).filter(Boolean);
}

/**
 * The distinct `src/objects/<id>/` directories a diff touches. A path whose captured first segment does not match
 * the safe object-id pattern used everywhere else in this repository (`[a-z][a-z0-9-]*`) throws rather than being
 * silently dropped: every real object id matches that pattern, so one that does not is an anomaly worth surfacing,
 * not a path this gate should quietly ignore (which would undercount, letting a wide change escape the gate).
 */
export function touchedObjectDirectories(paths: readonly string[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const path of paths) {
    const match = /^src\/objects\/([^/]+)\//.exec(path);
    if (!match) continue;
    const id = match[1]!;
    if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new Error(`Unexpected object id in changed path, refusing to scope silently: ${path}`);
    ids.add(id);
  }
  return ids;
}

/** The minimal shape this gate needs from `github.event.pull_request.labels` (an array of `{ name, ... }`); no
 * extra GitHub API call or token scope is needed beyond what the triggering `pull_request` event already carries. */
export interface PullRequestLabel { readonly name?: string; }

export interface ObjectScopeGateResult {
  readonly touched: readonly string[];
  readonly count: number;
  readonly limit: number;
  readonly exempted: boolean;
  readonly ok: boolean;
}

/** Pure decision: given the touched paths and the PR's labels, is this PR within scope? */
export function evaluateObjectScopeGate(paths: readonly string[], labels: readonly PullRequestLabel[],
  { limit = DEFAULT_OBJECT_DIRECTORY_LIMIT, labelName = PIPELINE_CHANGE_LABEL }: { limit?: number; labelName?: string } = {}): ObjectScopeGateResult {
  const touched = [...touchedObjectDirectories(paths)].sort((left, right) => left.localeCompare(right));
  const exempted = labels.some(label => label.name === labelName);
  return { touched, count: touched.length, limit, exempted, ok: exempted || touched.length <= limit };
}

/** Same decision, computing `paths` itself from a three-dot diff against `ref` (the PR's base branch). */
export async function objectScopeGate(ref: string, labels: readonly PullRequestLabel[],
  { root = resolve(import.meta.dirname, '../..'), limit, labelName,
    changedPaths = (gitRef: string) => gitChangedPaths(gitRef, root) }:
  { root?: string; limit?: number; labelName?: string; changedPaths?: (ref: string) => Promise<string[]> } = {}): Promise<ObjectScopeGateResult> {
  const paths = await changedPaths(ref);
  return evaluateObjectScopeGate(paths, labels, { limit, labelName });
}

function isPullRequestLabel(value: unknown): value is PullRequestLabel {
  if (!value || typeof value !== 'object') return false;
  const name = (value as Record<string, unknown>).name;
  return name === undefined || typeof name === 'string';
}

/** Parses whatever `toJson(github.event.pull_request.labels)` handed the CLI: an array of label objects on a real
 * pull_request event, or an empty/absent argument on push (never trusted further than "does it have a name"). */
export function parseLabelsArgument(labelsJson: string | undefined): PullRequestLabel[] {
  if (!labelsJson) return [];
  const parsed: unknown = JSON.parse(labelsJson);
  if (!Array.isArray(parsed)) throw new TypeError('Expected the labels argument to be a JSON array.');
  return parsed.filter(isPullRequestLabel);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , ref, labelsJson] = process.argv;
  if (!ref) throw new Error('Usage: object-scope-gate.mts <base-ref> [labels-json]');
  const labels = parseLabelsArgument(labelsJson);
  const result = await objectScopeGate(ref, labels);
  console.log(`Touched ${result.count} object director${result.count === 1 ? 'y' : 'ies'} (limit ${result.limit}): ${result.touched.join(', ') || 'none'}.`);
  if (!result.ok) {
    console.error(`This PR touches more than ${result.limit} src/objects/<id>/ directories. Add the '${PIPELINE_CHANGE_LABEL}' ` +
      'label if this is an intentional cross-object/pipeline change, or split it into smaller, body-scoped PRs.');
    process.exitCode = 1;
  } else if (result.exempted && result.count > result.limit) {
    console.log(`Exempted by the '${PIPELINE_CHANGE_LABEL}' label.`);
  }
}
