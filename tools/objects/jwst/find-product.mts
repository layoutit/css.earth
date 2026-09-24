import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function findOne(directory: string, pattern: RegExp): Promise<string> {
  const found: string[] = [];
  const walk = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(full); else if (pattern.test(entry.name)) found.push(full);
    }
  };
  await walk(directory);
  if (found.length !== 1) throw new Error(`${found.length} files match ${pattern} under ${directory}.`);
  return found[0]!;
}
