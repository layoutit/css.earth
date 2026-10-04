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

interface AuthorRunOptions<Result> extends AuthoredOutputOptions {
  root: string;
  /** Body-specific source reads and computation remain in the author config. */
  compute: () => Promise<{ outputs: readonly (readonly [string, Buffer])[]; result: Result }>;
}

/** Run one authored stage without changing its bytes, return value, or read-error policy. */
export async function runAuthor<Result>({ root, compute, ...policy }: AuthorRunOptions<Result>): Promise<Result> {
  const { outputs, result } = await compute();
  await writeOrCheckAuthoredOutputs(root, outputs, policy);
  return result;
}
