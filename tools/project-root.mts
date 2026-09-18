import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repository root, found by walking up from a module's own location rather than trusting
 * `process.cwd()` or a fixed `../` offset from `import.meta.url`. Both break once the caller runs
 * under a different working directory (a workspace-filtered script) or gets bundled somewhere else
 * in the tree (Astro's prerender chunks): the root marker stays a true ancestor either way.
 */
export function projectRoot(fromUrl: string | URL): string {
  let directory = dirname(fileURLToPath(fromUrl));
  for (;;) {
    if (existsSync(resolve(directory, 'pnpm-workspace.yaml'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Could not find the project root (no pnpm-workspace.yaml above this module).');
    directory = parent;
  }
}
