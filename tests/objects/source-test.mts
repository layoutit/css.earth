import { test as nodeTest, type TestContext } from 'node:test';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const RESTORE = (objectId: string) => `node tools/assets/restore-source-inputs.mts --object=${objectId}`;

type TestBody = (t: TestContext) => void | Promise<void>;
type TestOptions = NonNullable<Parameters<typeof nodeTest>[1]> & object;

/**
 * Why a body test can skip: it read a source input that a bare clone does not hold. Tracked files always exist, so the
 * only files that can be absent are downloads, archive members and generated intermediates under
 * `src/objects/<id>/source/` (or the ignored `.local/` tree). Everything else stays a failure.
 */
export function missingSourceReason(error: unknown, objectId: string): string | null {
  if (!(error instanceof Error)) return null;
  const sourceRoot = resolve(root, 'src/objects', objectId, 'source') + sep, local = resolve(root, '.local') + sep;
  const code = 'code' in error ? error.code : undefined, path = 'path' in error && typeof error.path === 'string' ? resolve(error.path) : null;
  if (code === 'ENOENT' && path && (path.startsWith(sourceRoot) || path.startsWith(local))) return `${objectId}: ${path.slice(root.length + 1)} is not restored; run ${RESTORE(objectId)}`;
  if (/manifest coverage failed|source is missing|is not restored|not installed/u.test(error.message)) return `${objectId}: ${error.message.split('\n')[0]}; run ${RESTORE(objectId)}`;
  return null;
}

/**
 * `test` for a body package: the same node:test call, except that a read of an unrestored source input skips the test
 * and names the restore command. A bare clone then reports what it could not prove instead of failing on it.
 */
export function sourceTest(objectId: string) {
  return function test(name: string, optionsOrBody: TestOptions | TestBody, maybeBody?: TestBody) {
    const [options, body] = typeof optionsOrBody === 'function' ? [{}, optionsOrBody] : [optionsOrBody, maybeBody!];
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
