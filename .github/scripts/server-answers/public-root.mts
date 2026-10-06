/** A checkout's Astro public directory, relative to its root. The comparison runs one set of tools on both sides, and
 * plan 8 moved the directory from `public/` to `site/public/`, so each side is read in its own layout. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function publicRoot(root: string): 'site/public' | 'public' {
  return existsSync(resolve(root, 'site/public')) ? 'site/public' : 'public';
}
