import { test as nodeTest, type TestContext, type TestOptions } from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const RESTORE = (objectId: string) => `node tools/assets/restore-source-inputs.mts --object=${objectId}`;

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

const tracked = (path: string): boolean => {
  try { execFileSync('git', ['ls-files', '--error-unmatch', '--', path], { cwd: root, stdio: 'ignore' }); return true; }
  catch { return false; }
};

/**
 * Why a test can skip: it read an input that a bare clone does not hold. Tracked files always exist, so the only files that
 * can be absent are downloads, archive members, restored prepared outputs and generated intermediates, all untracked; a
 * toolchain that is not installed is the same kind of absence. Everything else stays a failure.
 */
export function missingSourceReason(error: unknown, objectId: string | null = null): string | null {
  if (!(error instanceof Error)) return null;
  const objects = resolve(root, 'src/objects') + sep, inside = root + sep;
  const code = 'code' in error ? error.code : undefined, path = 'path' in error && typeof error.path === 'string' ? resolve(error.path) : null;
  if (code === 'ENOENT' && path && path.startsWith(inside) && !tracked(path.slice(inside.length))) {
    const relative = path.slice(inside.length);
    if (path.startsWith(objects)) {
      const [id, directory] = relative.slice('src/objects/'.length).split(sep);
      if (directory === 'source' && (objectId === null || id === objectId)) return `${id}: ${relative} is not restored; run ${RESTORE(id)}`;
      return `${id}: ${relative} is not restored; run node tools/assets/setup.mts --object=${id}`;
    }
    return `${relative} is not restored; run ${objectId ? RESTORE(objectId) : 'pnpm setup:sources'}`;
  }
  if (/manifest coverage failed|source coverage failed|source is missing|is not restored|not installed|toolchain is not installed|missing fits oracle input/iu.test(error.message))
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
