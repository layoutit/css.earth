// On a pull request, `check-object-runtime-ownership --all` (every registered object's prepared runtime and
// physical frame receipt) is mostly re-proving what Contract lint's `--receipts` already checked from tracked
// files (output/TEST_AUDIT.md section 4: "its only real catch is now caught by --receipts in Contract lint"). Scope
// it to the objects this PR actually touched instead — unless the PR also touches something outside
// src/objects/<id>/, since shared runtime-ownership code could then affect an object the PR never touched, and
// only --all can catch that. A push to main (and the nightly workflow) always run --all: see
// .github/workflows/universe.yml, which computes this in the `changes` job (full-history checkout already paid for
// there) and passes the result as an output — no build is needed to decide the scope, only to run the check.
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { touchedObjectDirectories } from './object-scope-gate.mts';

const execFileAsync = promisify(execFile);

const OBJECT_PACKAGE_PATH = /^src\/objects\//u;

/** Pure decision: the CLI arguments `check-object-runtime-ownership.mts` should receive for this diff. */
export function selectRuntimeOwnershipArgs(paths: readonly string[]): string[] {
  if (paths.length && paths.every(path => OBJECT_PACKAGE_PATH.test(path))) {
    const ids = [...touchedObjectDirectories(paths)].sort((left, right) => left.localeCompare(right));
    if (ids.length) return ids.flatMap(id => ['--object', id]);
  }
  return ['--all'];
}

async function gitChangedPaths(ref: string, root: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['diff', '--no-renames', '--name-only', `${ref}...HEAD`],
    { cwd: root, maxBuffer: 1024 * 1024 * 64 });
  return stdout.split('\n').map(line => line.trim()).filter(Boolean);
}

/** Same decision, computing `paths` itself from a three-dot diff against `ref` (the PR's base branch). */
export async function scopeRuntimeOwnershipCheck(ref: string,
  { root = resolve(import.meta.dirname, '../..'), changedPaths = (r: string) => gitChangedPaths(r, root) }:
  { root?: string; changedPaths?: (ref: string) => Promise<readonly string[]> } = {},
): Promise<string[]> {
  return selectRuntimeOwnershipArgs(await changedPaths(ref));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , ref] = process.argv;
  if (!ref) throw new Error('Usage: scope-runtime-ownership-check.mts <base-ref>');
  const args = await scopeRuntimeOwnershipCheck(ref);
  console.error(args.includes('--all')
    ? 'Runtime ownership check scope: every registered object (shared code changed, or no object-scoped diff).'
    : `Runtime ownership check scope: ${args.length / 2} object(s) this pull request touched.`);
  // The decision alone, space-separated, on stdout: the caller (the `changes` job) captures it as a job output and
  // passes it as CLI arguments to check-object-runtime-ownership.mts in a later job — see .github/workflows/universe.yml.
  console.log(args.join(' '));
}
