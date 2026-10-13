import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

/** Source bundles need astronomy's generated modules even when its dist came from a cache.
 * Always run the declared generator: missing-file checks would leave stale body records in the bundle.
 * Astronomy writes only changed outputs; this prepares code inputs, not the shipped pack data. */
export async function preparePackageBuildInputs(root: string): Promise<void> {
  await promisify(execFile)('pnpm', ['run', 'prepare:data'], {
    cwd: resolve(root, 'packages/astronomy'), timeout: 60_000,
  });
}
