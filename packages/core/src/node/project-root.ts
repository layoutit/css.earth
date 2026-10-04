import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverRoot } from './root-discovery.ts';

/**
 * The real repository root, found by walking up from a module's own location rather than trusting
 * `process.cwd()` or a fixed `../` offset from `import.meta.url`. Both break once the caller runs
 * under a different working directory (a workspace-filtered script) or gets bundled somewhere else
 * in the tree (Astro's prerender chunks): the root marker stays a true ancestor either way.
 */
export function projectRoot(fromUrl: string | URL): string {
  return discoverRoot({ strategy: 'ancestor-marker', startDirectory: realpathSync(dirname(fileURLToPath(fromUrl))),
    marker: 'pnpm-workspace.yaml', missing: { behavior: 'throw',
      error: () => new Error('Could not find the project root (no pnpm-workspace.yaml above this module).') } });
}
