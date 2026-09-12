import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** The body whose capture stands in for one that has not been captured yet.
 * The site's root alias already resolves to Earth. */
export const DEFAULT_SOCIAL_IMAGE_ID = 'earth';

/** Committed social captures, read once at build time. `pnpm prepare:social`
 * adds more; every object advertises one of these, never a missing file. */
export function availableSocialImages(root = process.cwd()): ReadonlySet<string> {
  const directory = resolve(root, 'public/social');
  const names = readdirSync(directory)
    .filter(name => name.endsWith('.jpg'))
    .map(name => name.slice(0, -'.jpg'.length));
  if (!names.includes(DEFAULT_SOCIAL_IMAGE_ID)) {
    throw new Error(`public/social must contain the ${DEFAULT_SOCIAL_IMAGE_ID} capture every uncaptured object falls back to.`);
  }
  return new Set(names);
}
