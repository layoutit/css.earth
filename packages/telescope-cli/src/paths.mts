/** CLI-owned inputs retain their repository identities but resolve from this package when installed. */
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { requireWorkspace, USER_ROOT, WORKSPACE } from '@cssearth/telescope-core/node';
export const CLI_PACKAGE_ROOT = dirname(createRequire(import.meta.url).resolve('@cssearth/telescope/package.json'));
export const TARGET_CATALOGUE_SNAPSHOT = resolve(CLI_PACKAGE_ROOT, 'data/target-catalogue.json');
/** Step 3 copies read-only site archive catalogues and ledgers here with their original relative paths. */
export const SITE_DATA_ROOT = resolve(CLI_PACKAGE_ROOT, 'data');
const PREFIX = 'packages/telescope-cli/';
export function packagePath(path: string): string {
  const name = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  const result = resolve(CLI_PACKAGE_ROOT, name), part = relative(CLI_PACKAGE_ROOT, result);
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
  const destination = resolve(requireWorkspace(), PREFIX);
  const selectedPart = relative(destination, path);
  if (isAbsolute(path) && !isAbsolute(selectedPart) && selectedPart !== '..' && !selectedPart.startsWith(`..${sep}`)) return path;
  const part = isAbsolute(path) ? relative(CLI_PACKAGE_ROOT, path) : path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`)) throw new TypeError('Workspace authoring path leaves the telescope package.');
  return resolve(requireWorkspace(), PREFIX, part);
}

function isProgramIdentity(path: string): boolean {
  const part = isAbsolute(path) ? relative(CLI_PACKAGE_ROOT, path) : path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  return /^src[/\\]archives[/\\][^/\\]+[/\\]programs(?:[/\\]|$)/u.test(part);
}

/** One program store for readers and authors. A selected workspace never falls back to shipped programs. */
export function programStorePath(path: string, access: 'read' | 'write' = 'read'): string {
  const workspace = access === 'write' ? requireWorkspace() : WORKSPACE;
  const destination = workspace === undefined ? CLI_PACKAGE_ROOT : resolve(workspace, PREFIX);
  const selectedPart = relative(destination, path);
  const part = isAbsolute(path)
    ? workspace !== undefined && !isAbsolute(selectedPart) && selectedPart !== '..' && !selectedPart.startsWith(`..${sep}`)
      ? selectedPart : relative(CLI_PACKAGE_ROOT, path)
    : path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  if (isAbsolute(part) || part === '..' || part.startsWith(`..${sep}`) || !isProgramIdentity(part))
    throw new TypeError('Program store path must stay inside an archive programs folder.');
  return resolve(destination, part);
}
