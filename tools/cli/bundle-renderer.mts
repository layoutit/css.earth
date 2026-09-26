import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Plugin } from 'esbuild';

/** For Node bundles built with esbuild's `packages: 'external'`: bundle `@cssearth/renderer` as its modules were bundled when
 * they were relative files under `src/renderers/css/`. Its source subpaths are TypeScript whose sibling imports name `.js`,
 * which Node cannot load unbundled; its built entries are ES modules and bundle as they are. */
export const bundleRendererPackage: Plugin = {
  name: 'bundle-renderer-package',
  setup(builder) {
    builder.onResolve({ filter: /^@cssearth\/renderer(?:\/|$)/ }, args =>
      ({ path: createRequire(resolve(args.resolveDir, 'bundle-renderer.cjs')).resolve(args.path) }));
  },
};
