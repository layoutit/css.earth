import { test as nodeTest, type TestContext, type TestOptions } from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const RESTORE = (objectId: string) => `node packages/bake/cli/restore-source-inputs.mts --object=${objectId}`;

type TestBody = (t: TestContext) => void | Promise<void>;
type Hook = (fn: () => void | Promise<void>, options?: { readonly timeout?: number }) => void;
export interface RestoredSources { readonly objectId: string; readonly missing: readonly string[]; readonly skip: string | false }

/** A test file that reads inputs while it loads names them here first, so an unrestored file skips the whole file instead of failing it. */
export function restoredSources(objectId: string, ...paths: readonly string[]): RestoredSources {
  const missing = paths.filter(path => !existsSync(resolve(root, 'src/objects', objectId, 'source', path)));
  return { objectId, missing, skip: missing.length ? `${objectId}: ${missing.join(', ')} not restored; run ${RESTORE(objectId)}` : false };
}

/** Module-level loading of restored inputs: the values when they are there, a skip reason for every test in the file when they are not. */
export async function sourceLoad<T>(load: () => Promise<T> | T): Promise<RestoredSources & { readonly values: T }> {
  try { return { objectId: '', missing: [], skip: false, values: await load() }; }
  catch (error) {
    const reason = missingSourceReason(error);
    if (reason === null) throw error;
    return { objectId: '', missing: [], skip: reason, values: {} as T };
  }
}

/** Whether a repository path is tracked and, when it is, whether this checkout holds it: a sparse checkout leaves tracked files
 * it excludes out of the working tree with the skip-worktree bit (`git ls-files -t` reports `S`). */
export type CheckoutState = 'untracked' | 'checked-out' | 'outside-sparse-checkout';
export function checkoutState(path: string, repository = root): CheckoutState {
  let listed: string;
  try { listed = execFileSync('git', ['ls-files', '-t', '-z', '--', path], { cwd: repository, encoding: 'utf8' }); }
  catch { return 'untracked'; }
  const line = listed.split('\0').find(entry => entry.slice(2) === path);
  return line === undefined ? 'untracked' : line.startsWith('S ') ? 'outside-sparse-checkout' : 'checked-out';
}

/**
 * Why a test can skip: it read an input that this checkout does not hold. A full checkout holds every tracked file, so the
 * only files that can be absent are downloads, archive members, restored prepared outputs and generated intermediates, all
 * untracked, and tracked files a sparse checkout excludes (CI's lint job leaves most body data out); a toolchain that is not
 * installed is the same kind of absence. A tracked file missing from its checkout, and everything else, stays a failure.
 */
export function missingSourceReason(error: unknown, objectId: string | null = null, stateOf: (path: string) => CheckoutState = checkoutState): string | null {
  if (!(error instanceof Error)) return null;
  const objects = resolve(root, 'src/objects') + sep, inside = root + sep;
  // sharp names an absent input in its message instead of an ENOENT code and path.
  const sharpMissing = /^Input file is missing: (.+)$/u.exec(error.message)?.[1];
  const code = sharpMissing ? 'ENOENT' : 'code' in error ? error.code : undefined;
  const path = sharpMissing ? resolve(sharpMissing) : 'path' in error && typeof error.path === 'string' ? resolve(error.path) : null;
  const state = code === 'ENOENT' && path && path.startsWith(inside) ? stateOf(path.slice(inside.length).split(sep).join('/')) : 'checked-out';
  if (path && state === 'outside-sparse-checkout') {
    const relative = path.slice(inside.length);
    return `${relative} is outside this sparse checkout; run git sparse-checkout add '/${relative.split(sep).join('/')}'`;
  }
  if (path && state === 'untracked') {
    const relative = path.slice(inside.length);
    if (path.startsWith(objects)) {
      const [id, directory] = relative.slice('src/objects/'.length).split(sep);
      if (directory === 'source' && (objectId === null || id === objectId)) return `${id}: ${relative} is not restored; run ${RESTORE(id)}`;
      return `${id}: ${relative} is not restored; run node packages/bake/cli/setup-assets.mts --object=${id}`;
    }
    return `${relative} is not restored; run ${objectId ? RESTORE(objectId) : 'pnpm setup:sources'}`;
  }
  // Coverage that only misses declared files is an unrestored download; an undeclared file is a real failure.
  if (/coverage failed\. Undeclared: none\. Missing: (?!none\.)/iu.test(error.message)
    || /source is missing|is not restored|not installed|toolchain is not installed|missing fits oracle input/iu.test(error.message))
    return `${error.message.split('\n')[0]}; run ${objectId ? RESTORE(objectId) : 'pnpm setup:sources'}`;
  return null;
}

/**
 * `test` for a body package: the same node:test call, except that a read of an unrestored source input skips the test
 * and names the restore command. A `before` hook that meets the same absence skips every test after it. A bare clone then
 * reports what it could not prove instead of failing on it.
 */
export function sourceTest(objectId: string | null = null, sources?: RestoredSources) {
  let unavailable: string | null = sources?.skip || null;
  const test = (name: string, optionsOrBody: TestOptions | TestBody, maybeBody?: TestBody) => {
    const [options, body] = typeof optionsOrBody === 'function' ? [{}, optionsOrBody] : [optionsOrBody, maybeBody!];
    return nodeTest(name, options, async t => {
      if (unavailable) return t.skip(unavailable);
      try { await body(t); }
      catch (error) {
        const reason = missingSourceReason(error, objectId);
        if (reason === null) throw error;
        t.skip(reason);
      }
    });
  };
  const hook = (owner: Hook): Hook => (fn, options) => owner(async () => {
    if (unavailable) return;
    try { await fn(); }
    catch (error) {
      const reason = missingSourceReason(error, objectId);
      if (reason === null) throw error;
      unavailable = reason;
    }
  }, options);
  return Object.assign(test, { after: nodeTest.after, afterEach: nodeTest.afterEach, before: hook(nodeTest.before), beforeEach: hook(nodeTest.beforeEach), describe: nodeTest.describe, skip: nodeTest.skip, todo: nodeTest.todo });
}
