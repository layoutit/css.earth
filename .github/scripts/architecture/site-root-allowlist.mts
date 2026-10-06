/** The files `site/` may hold directly: the Astro config, type declarations and tsconfigs that tooling finds by that location.
 * Every other file lives in the folder that owns it (docs/site-architecture.md). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SITE_ROOT_ALLOWLIST_FILE = '.github/scripts/architecture/site-root-allowlist.json';

function allowlist(root: string): string[] {
  const value: unknown = JSON.parse(readFileSync(resolve(root, SITE_ROOT_ALLOWLIST_FILE), 'utf8'));
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string' && /^site\/[^/]+$/u.test(item))) {
    throw new TypeError(`${SITE_ROOT_ALLOWLIST_FILE} must list files directly in site/.`);
  }
  return value;
}

/** One finding per loose file in site/ the allowlist does not name, and per listed file that is gone. */
export function checkSiteRootAllowlist(root: string, files: readonly string[]): string[] {
  const allowed = allowlist(root);
  const loose = files.filter(file => /^site\/[^/]+$/u.test(file));
  return [
    ...loose.filter(file => !allowed.includes(file)).map(file => `${file}: site/ holds only ${SITE_ROOT_ALLOWLIST_FILE}; move the file into the folder that owns it`),
    ...allowed.filter(file => !loose.includes(file)).map(file => `${file}: listed in ${SITE_ROOT_ALLOWLIST_FILE} but absent; remove the entry`),
  ];
}
