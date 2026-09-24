/** Host-side hashing of package-owned implementation inventories, independent of installation layout. */
import { sha256 } from '@cssearth/core/node';
import { createRequire } from 'node:module';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export interface PackageImplementationPin { path: string; sha256: string }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item))
    throw new TypeError('Invalid package implementation inventory.');
  return value;
}
function localPath(directory: string, path: string): string {
  if (isAbsolute(path) || /[\\\u0000]/.test(path) || path.split('/').some(part => !part || part === '..' || part === '.'))
    throw new TypeError('Package implementation entry escapes its owner.');
  return resolve(directory, path);
}
export async function packageImplementationPins(root: string, names: readonly string[]): Promise<PackageImplementationPin[]> {
  const require = createRequire(resolve(root, 'package.json'));
  const pins: PackageImplementationPin[] = [];
  for (const name of [...new Set(names)].sort()) {
    if (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(name)) throw new TypeError('Invalid implementation package name.');
    const manifestPath = require.resolve(`${name}/package.json`);
    const bytes = await readFile(manifestPath), manifest: unknown = JSON.parse(bytes.toString());
    if (!record(manifest) || manifest.name !== name || !record(manifest.nebulaImplementation))
      throw new TypeError(`Missing implementation inventory: ${name}`);
    const config = manifest.nebulaImplementation, directories = strings(config.directories);
    const extensions = strings(config.extensions), excludedSuffixes = strings(config.excludedSuffixes);
    const directory = await realpath(dirname(manifestPath));
    const files = new Set<string>();
    for (const folder of directories) {
      const entries = await readdir(localPath(directory, folder), { recursive: true, withFileTypes: true });
      let found = false;
      for (const entry of entries) {
        if (!entry.isFile() || !extensions.some(ext => entry.name.endsWith(ext)) || excludedSuffixes.some(ext => entry.name.endsWith(ext))) continue;
        const absolute = await realpath(resolve(entry.parentPath, entry.name));
        const path = relative(directory, absolute);
        if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) throw new TypeError('Implementation file escapes package.');
        files.add(path.split(sep).join('/')); found = true;
      }
      if (!found) throw new TypeError(`Empty implementation inventory: ${name}/${folder}`);
    }
    pins.push({ path: `${name}/package.json`, sha256: sha256(bytes) });
    for (const path of [...files].sort()) pins.push({ path: `${name}/${path}`, sha256: sha256(await readFile(localPath(directory, path))) });
  }
  return pins;
}
