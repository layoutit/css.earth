/** Inspect local managed installs; removal shares the installer's exclusive lock. */
import { lstat, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { hasErrorCode, requireRecord, requireString } from '@cssearth/core';
import { USER_ROOT, withInstallLock } from '@cssearth/telescope-core/node';

export interface ManagedEnvironment { readonly name: string; readonly toolchain: string; readonly bytes: number; readonly folder: string; readonly removable: boolean }
const inside = (root: string, path: string): boolean => {
  const part = relative(root, path);
  return !!part && !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`);
};
/** lstat never follows a link into someone else's environment or double-counts hardlinked files. */
async function diskBytes(path: string, seen = new Set<string>()): Promise<number> {
  const info = await lstat(path), key = `${info.dev}:${info.ino}`;
  if (seen.has(key)) return 0;
  seen.add(key);
  if (!info.isDirectory()) return info.blocks * 512;
  const sizes = await Promise.all((await readdir(path)).map(name => diskBytes(resolve(path, name), seen)));
  return info.blocks * 512 + sizes.reduce((sum, n) => sum + n, 0);
}
export async function listManagedEnvironments(userRoot = USER_ROOT): Promise<ManagedEnvironment[]> {
  const managed = resolve(userRoot, 'toolchains'), results: ManagedEnvironment[] = [];
  const visit = async (folder: string, removable: boolean): Promise<void> => {
    const info = await lstat(folder).catch(error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (!info?.isDirectory()) return;
    const marker = await readFile(resolve(folder, 'installed.json'), 'utf8').catch(error => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (marker !== null) {
      const record = requireRecord(JSON.parse(marker), 'installed marker'), toolchain = requireString(record.id, 'toolchain id');
      requireString(record.descriptor, 'installed descriptor');
      if (record.lock !== null && typeof record.lock !== 'string') throw new TypeError('Invalid installed lock.');
      results.push({ name: relative(removable ? managed : resolve(userRoot, 'output/toolchains'), folder).split(sep).join('/'), toolchain,
        bytes: await diskBytes(folder), folder, removable });
      return;
    }
    for (const name of (await readdir(folder)).sort()) if (!name.includes('.installing')) await visit(resolve(folder, name), removable);
  };
  // Older managed installers retain their existing location, but removal is restricted to toolchains/.
  await visit(managed, true);
  await visit(resolve(userRoot, 'output/toolchains'), false);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
async function assertSafeFolder(userRoot: string, folder: string): Promise<void> {
  const user = await realpath(userRoot), managed = resolve(userRoot, 'toolchains');
  if ((await lstat(managed)).isSymbolicLink() || !inside(user, await realpath(managed)) || !inside(await realpath(managed), await realpath(folder)))
    throw new Error(`Refusing to remove a toolchain outside ${managed}.`);
  let current = managed;
  for (const part of relative(managed, folder).split(sep)) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing to remove linked toolchain ${current}.`);
  }
}
export async function removeManagedEnvironment(name: string, userRoot = USER_ROOT): Promise<ManagedEnvironment & { readonly removed: true }> {
  if (!name || isAbsolute(name) || !name.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(part)))
    throw new TypeError('Give a managed toolchain name from telescope toolchain list.');
  const managed = resolve(userRoot, 'toolchains'), candidate = resolve(managed, name);
  if (!inside(managed, candidate)) throw new Error(`Refusing to remove a toolchain outside ${managed}.`);
  const installed = await listManagedEnvironments(userRoot), exact = installed.filter(item => item.name === name), matches = exact.length ? exact : installed.filter(item => item.toolchain === name);
  if (matches.length !== 1) throw new Error(matches.length ? `Several installs match ${name}; use one exact name from telescope toolchain list.` : `No installed managed toolchain named ${name}.`);
  const environment = matches[0]!;
  if (!environment.removable) throw new Error(`Refusing to remove ${environment.folder}; only environments inside ${managed} can be removed.`);
  await assertSafeFolder(userRoot, environment.folder);
  return withInstallLock(environment.folder, () => withInstallLock(resolve(environment.folder, 'env'), async () => {
    await assertSafeFolder(userRoot, environment.folder);
    // Refuse every other prefix's lock, including native installers with an archive-specific prefix.
    const names = await readdir(environment.folder, { recursive: true });
    if (names.some(path => path.endsWith('.installing') && path !== 'env.installing')) throw new Error(`Managed toolchain ${name} is locked; wait for its owner to finish.`);
    await rm(environment.folder, { recursive: true });
    return { ...environment, removed: true };
  }, { wait: false }), { wait: false });
}
