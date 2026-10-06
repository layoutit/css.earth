/** Bounded independent recordings: a finite memory allowance, no first-failure abandonment. */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
export const recordingConcurrency = 3;
export const recordingHeapMb = 512;
export async function parallel<T>(items: readonly T[], bound: number, run: (item: T, index: number) => Promise<void>): Promise<PromiseSettledResult<void>[]> {
  if (!Number.isSafeInteger(bound) || bound < 1) throw new Error('Invalid parallel bound');
  const results: PromiseSettledResult<void>[] = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(bound, items.length) }, async () => {
    for (;;) {
      const index = cursor++; if (index >= items.length) return;
      try { await run(items[index]!, index); results[index] = { status: 'fulfilled', value: undefined }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}
/** Preview binds port 0 (OS-assigned); IPC-only targets bind no listening socket. */
export async function recordingIsolation(root: string, target: string): Promise<{ directory: string; env: NodeJS.ProcessEnv; close(): Promise<void> }> {
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, `${target}-`));
  return { directory, env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory, CSSEARTH_HOST_HEAP_MB: '768', NODE_OPTIONS: `--max-old-space-size=${recordingHeapMb}` }, close: () => rm(directory, { recursive: true, force: true }) };
}
