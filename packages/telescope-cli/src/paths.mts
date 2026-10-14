/** CLI-owned inputs retain their repository identities but resolve from this package when installed. */
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { acquisitionDirectory, requireWorkspace, USER_ROOT, WORKSPACE } from '@cssearth/telescope-core/node';
export const CLI_PACKAGE_ROOT = dirname(createRequire(import.meta.url).resolve('@cssearth/telescope/package.json'));
export const TARGET_CATALOGUE_SNAPSHOT = resolve(CLI_PACKAGE_ROOT, 'data/target-catalogue.json');
/** Step 3 copies read-only site archive catalogues and ledgers here with their original relative paths. */
export const SITE_DATA_ROOT = resolve(CLI_PACKAGE_ROOT, 'data');
const CLI_DATA_ROOT = existsSync(resolve(CLI_PACKAGE_ROOT, 'src/cli.mts')) ? CLI_PACKAGE_ROOT : resolve(CLI_PACKAGE_ROOT, 'data/cli');
const PREFIX = 'packages/telescope-cli/';
export function packagePath(path: string): string {
  const name = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  const result = resolve(CLI_DATA_ROOT, name), part = relative(CLI_DATA_ROOT, result);
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`)) throw new TypeError('Package data path leaves the telescope package.');
  return result;
}
/** A logical input identity, including legacy program/receipt paths. Site records stay in an explicit checkout. */
export function inputPath(root: string, path: string): string {
  if (isProgramIdentity(path)) return programStorePath(path);
  if (isAbsolute(path)) return path;
  if (path.startsWith(PREFIX)) return packagePath(path);
  if (path.startsWith('src/sources/')) return resolve(root === USER_ROOT ? SITE_DATA_ROOT : root, path);
  return resolve(root, path);
}
/** Developer entry scripts use the same optional workspace admission as the public command. */
export const checkoutProjectRoot = (_url?: string): string => requireWorkspace();

/** Convert a package-owned authoring identity to the selected workspace destination. */
export function workspacePath(path: string): string {
  if (isProgramIdentity(path)) return programStorePath(path, 'write');
  const destination = resolve(requireWorkspace(undefined, 'This command writes checkout records.'), PREFIX);
  const selectedPart = relative(destination, path);
  if (isAbsolute(path) && !isAbsolute(selectedPart) && selectedPart !== '..' && !selectedPart.startsWith(`..${sep}`)) return path;
  const part = isAbsolute(path) ? relative(CLI_DATA_ROOT, path) : path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`)) throw new TypeError('Workspace authoring path leaves the telescope package.');
  return resolve(requireWorkspace(), PREFIX, part);
}

/** Resolve existing ancestors too: an authoring destination need not exist yet. */
function realPath(path: string): string {
  try { return realpathSync(path); }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return resolve(realPath(parent), relative(parent, path));
  }
}
function programIdentity(path: string): string {
  if (!isAbsolute(path)) return path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  const actual = realPath(path);
  for (const root of [WORKSPACE ? resolve(WORKSPACE, PREFIX) : CLI_DATA_ROOT, CLI_DATA_ROOT]) {
    const part = relative(realPath(root), actual);
    if (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`)) return part;
  }
  return relative(realPath(CLI_DATA_ROOT), actual);
}
function isProgramIdentity(path: string): boolean {
  return /^src[/\\]archives[/\\][^/\\]+[/\\]programs(?:[/\\]|$)/u.test(programIdentity(path));
}

/** One program store for readers and authors. A selected workspace never falls back to shipped programs. */
export function programStorePath(path: string, access: 'read' | 'write' = 'read'): string {
  const run = acquisitionDirectory();
  if (run) {
    const runPrograms = resolve(run, 'programs'), local = isAbsolute(path) ? relative(realPath(runPrograms), realPath(path)) : path;
    if (isAbsolute(path) && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local)) return path;
    const logical = programIdentity(path);
    const match = /^src[/\\]archives[/\\]([^/\\]+)[/\\]programs(?:[/\\](.*))?$/u.exec(logical);
    if (match) {
      const scoped = resolve(runPrograms, match[1]!, match[2] ?? '');
      const part = relative(runPrograms, scoped);
      if (part === '..' || part.startsWith(`..${sep}`) || isAbsolute(part)) throw new TypeError('Program store path leaves the run.');
      if (access === 'write' || existsSync(scoped)) return scoped;
    }
  }
  const workspace = access === 'write' ? requireWorkspace(undefined, 'This command writes archive program records.') : WORKSPACE;
  const destination = workspace === undefined ? CLI_DATA_ROOT : resolve(workspace, PREFIX);
  const part = programIdentity(path);
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`) || !isProgramIdentity(part))
    throw new TypeError('Program store path must stay inside an archive programs folder.');
  return resolve(destination, part);
}
