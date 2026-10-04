import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface AuthoredOutputOptions {
  check: boolean;
  /** The shell author historically treats every read failure as a differing output, not only ENOENT. */
  readError: 'propagate-read-error' | 'mismatch-on-read-error';
  mkdir: 'none' | 'root-before-write-or-check';
  mismatchMessage?: (path: string) => string;
}

/** Write authored bytes, or check them without changing the files. Caller policies retain historical filesystem behavior. */
export async function writeOrCheckAuthoredOutputs(root: string, outputs: readonly (readonly [string, Buffer])[],
  { check, readError, mkdir: directoryPolicy, mismatchMessage = path => `${path} differs from its authored recomputation.` }: AuthoredOutputOptions,
) {
  if (directoryPolicy === 'root-before-write-or-check') await mkdir(root, { recursive: true });
  for (const [path, bytes] of outputs) {
    const target = resolve(root, path);
    if (check) {
      const existing = readError === 'mismatch-on-read-error' ? await readFile(target).catch(() => null) : await readFile(target);
      if (!existing || !existing.equals(bytes)) throw new Error(mismatchMessage(path));
    } else await writeFile(target, bytes);
  }
}
