import { copyFile, lstat, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { hasErrorCode } from '../sources/source-values.mts';
export type PreparedOutput = { path: string } & ({ text: string | Uint8Array } | { source: string } | { remove: true });
/** Stage the entire set before replacing files. Callers validate content and own
 * concurrency. Backups live on disk, so large images are not all retained in RAM.
 * This rolls back caught write failures; it is not a crash-recovery protocol. */
export async function writePreparedSet(outputs: readonly PreparedOutput[]) {
  if (new Set(outputs.map(output => resolve(output.path))).size !== outputs.length) throw new TypeError('Duplicate prepared output.');
  const transaction = randomUUID();
  const staged: { path: string; temporary: string; backup: string | null; remove: boolean }[] = [];
  const published: typeof staged = [];
  let retainBackups = false;
  try {
    for (const output of outputs) {
      const info = await lstat(output.path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
      if (info && !info.isFile()) throw new TypeError(`Prepared target is not a regular file: ${output.path}.`);
      if ('source' in output && !(await lstat(output.source)).isFile()) throw new TypeError(`Staged source is not a regular file: ${output.source}.`);
      const previous = await readFile(output.path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
      const bytes = 'remove' in output ? null : 'source' in output ? await readFile(output.source)
        : typeof output.text === 'string' ? Buffer.from(output.text) : output.text;
      // A file source is an explicit publication, like the former copyFile
      // path. Keep that write visible to the existing preparation trace.
      if (bytes === null ? previous === null : 'text' in output && previous?.equals(bytes)) continue;
      const entry = { path: output.path, temporary: `${output.path}.${transaction}.tmp`,
        backup: previous === null ? null : `${output.path}.${transaction}.backup`, remove: bytes === null };
      staged.push(entry);
      await mkdir(dirname(output.path), { recursive: true });
      if (entry.backup) await copyFile(entry.path, entry.backup, constants.COPYFILE_FICLONE | constants.COPYFILE_EXCL);
      if (bytes !== null) await writeFile(entry.temporary, bytes, { flag: 'wx' });
    }
    for (const entry of staged) {
      if (entry.remove) await rm(entry.path);
      else await rename(entry.temporary, entry.path);
      published.push(entry);
    }
  } catch (error) {
    const failures: unknown[] = [];
    for (const entry of published.reverse()) {
      try {
        if (entry.backup === null) await rm(entry.path, { force: true });
        else await rename(entry.backup, entry.path);
      } catch (failure) { failures.push(failure); }
    }
    if (failures.length) {
      retainBackups = true;
      throw new AggregateError([error, ...failures], 'Prepared rollback failed; previous bytes remain in .backup files beside the targets.');
    }
    throw error;
  } finally {
    await Promise.all(staged.map(entry => rm(entry.temporary, { force: true })));
    if (!retainBackups) await Promise.all(staged.flatMap(entry => entry.backup ? [rm(entry.backup, { force: true })] : []));
  }
}
