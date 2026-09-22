import { test as nodeTest, type TestContext, type TestOptions } from 'node:test';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const RESTORE = (objectId: string) => `node tools/assets/restore-source-inputs.mts --object=${objectId}`;

type TestBody = (t: TestContext) => void | Promise<void>;
export interface RestoredSources { readonly objectId: string; readonly missing: readonly string[]; readonly skip: string | false }

/** A test file that reads inputs while it loads names them here first, so an unrestored file skips the whole file instead of failing it. */
export function restoredSources(objectId: string, ...paths: readonly string[]): RestoredSources {
  const missing = paths.filter(path => !existsSync(resolve(root, 'src/objects', objectId, 'source', path)));
  return { objectId, missing, skip: missing.length ? `${objectId}: ${missing.join(', ')} not restored; run ${RESTORE(objectId)}` : false };
}

/**
 * Why a body test can skip: it read a source input that a bare clone does not hold. Tracked files always exist, so the
 * only files that can be absent are downloads, archive members and generated intermediates under
 * `src/objects/<id>/source/` (or the ignored `.local/` tree). Everything else stays a failure.
 */
export function missingSourceReason(error: unknown, objectId: string | null = null): string | null {
  if (!(error instanceof Error)) return null;
  const objects = resolve(root, 'src/objects') + sep, local = resolve(root, '.local') + sep;
  const code = 'code' in error ? error.code : undefined, path = 'path' in error && typeof error.path === 'string' ? resolve(error.path) : null;
  if (code === 'ENOENT' && path && path.startsWith(objects)) {
    const [id, directory] = path.slice(objects.length).split(sep);
    if (directory === 'source' && (objectId === null || id === objectId)) return `${id}: ${path.slice(root.length + 1)} is not restored; run ${RESTORE(id)}`;
  }
  if (code === 'ENOENT' && path && path.startsWith(local)) return `${path.slice(root.length + 1)} is not restored; run ${objectId ? RESTORE(objectId) : 'pnpm setup:sources'}`;
  if (/manifest coverage failed|source is missing|is not restored|not installed/u.test(error.message)) return `${error.message.split('\n')[0]}; run ${objectId ? RESTORE(objectId) : 'pnpm setup:sources'}`;
  return null;
}

/**
 * `test` for a body package: the same node:test call, except that a read of an unrestored source input skips the test
 * and names the restore command. A bare clone then reports what it could not prove instead of failing on it.
 */
export function sourceTest(objectId: string | null = null, sources?: RestoredSources) {
  return function test(name: string, optionsOrBody: TestOptions | TestBody, maybeBody?: TestBody) {
    const [options, body] = typeof optionsOrBody === 'function' ? [{}, optionsOrBody] : [optionsOrBody, maybeBody!];
    if (sources?.skip) return nodeTest(name, { ...options, skip: sources.skip }, body);
    return nodeTest(name, options, async t => {
      try { await body(t); }
      catch (error) {
        const reason = missingSourceReason(error, objectId);
        if (reason === null) throw error;
        t.skip(reason);
      }
    });
  };
}
