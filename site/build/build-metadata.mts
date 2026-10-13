import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VERSION_TOKEN, REVISION_TOKEN } from '../contracts/build-metadata.mts';

export function cssEarthVersion(root: string): string {
  try {
    const count = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim());
    return `${Math.floor(count / 10000)}.${count % 10000}`;
  } catch { return '0.0'; }
}

/** Cache the template, then stamp the deployment's metadata into every restored or freshly rendered response.
 * Both normal HTML and navigation fragments retain their existing version and immutable source links. */
export async function finalizeBuildMetadata(dist: string, metadata: { version: string; revision: string }): Promise<number> {
  if (!/^\d+\.\d+$/u.test(metadata.version) || !/^[a-f0-9]{40}$/u.test(metadata.revision)) {
    throw new TypeError('Invalid build metadata.');
  }
  let changed = 0;
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await walk(path); continue; }
      if (!entry.isFile() || !/\.(?:html|json)$/u.test(entry.name)) continue;
      const before = await readFile(path, 'utf8');
      const after = before.replaceAll(VERSION_TOKEN, metadata.version).replaceAll(REVISION_TOKEN, metadata.revision);
      if (after !== before) { await writeFile(path, after); changed++; }
    }
  }
  await walk(dist);
  if (!changed) throw new Error('Incremental metadata finalization found no rendered metadata.');
  return changed;
}
