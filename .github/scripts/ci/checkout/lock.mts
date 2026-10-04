/** Serialize local CI and typecheck: CI rebuilds dist, which a compiler must never read mid-write.
 * Nested typecheck commands inherit the live owner's token. An interrupted owner leaves a lock:
 * remove output/checkout-check.lock only after confirming that owner has stopped. */
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const ENV = 'CSSEARTH_CHECK_LOCK';
export async function withCheckoutLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const directory = resolve(root, 'output'), path = resolve(directory, 'checkout-check.lock');
  const inherited = process.env[ENV];
  if (inherited && await readFile(path, 'utf8').catch(() => '') === inherited) return action();
  await mkdir(directory, { recursive: true });
  const token = `${process.pid}:${randomUUID()}`;
  const file = await open(path, 'wx').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
      throw new Error('Local CI/typecheck already owns output/checkout-check.lock. Wait for it to finish; CI rebuilds dist. Remove an abandoned lock only after confirming its owner has stopped.');
    throw error;
  });
  try {
    await file.writeFile(token);
    process.env[ENV] = token;
    return await action();
  } finally {
    if (inherited === undefined) delete process.env[ENV]; else process.env[ENV] = inherited;
    await file.close();
    await rm(path, { force: true });
  }
}
