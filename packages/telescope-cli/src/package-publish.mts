import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Source processes may read the previous pack during prepack. Replace each file only when complete. */
export async function publishDirectory(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true }), names = new Set(entries.map(entry => entry.name));
  for (const entry of entries) {
    const from = resolve(source, entry.name), to = resolve(destination, entry.name);
    if (entry.isDirectory()) await publishDirectory(from, to);
    else await rename(from, to);
  }
  for (const entry of await readdir(destination)) if (!names.has(entry)) await rm(resolve(destination, entry), { recursive: true, force: true });
}
