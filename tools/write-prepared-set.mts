import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hasErrorCode } from './source-values.mts';
/** Validate callers' entire output set first, then stage it before replacing files. */
export async function writePreparedSet(outputs: readonly { path: string; text: string }[]) {
  const transaction = randomUUID();
  const staged: { path: string; temporary: string; previous: string | null }[] = [];
  const published: typeof staged = [];
  try {
    for (const output of outputs) {
      const previous = await readFile(output.path, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
      if (previous === output.text) continue;
      const entry = { path: output.path, temporary: `${output.path}.${transaction}.tmp`, previous };
      staged.push(entry);
      await writeFile(entry.temporary, output.text);
    }
    for (const entry of staged) { await rename(entry.temporary, entry.path); published.push(entry); }
  } catch (error) {
    for (const entry of published.reverse()) {
      if (entry.previous === null) await rm(entry.path, { force: true });
      else { await writeFile(entry.temporary, entry.previous); await rename(entry.temporary, entry.path); }
    }
    throw error;
  } finally {
    await Promise.all(staged.map(entry => rm(entry.temporary, { force: true })));
  }
}
