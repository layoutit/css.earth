import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default {
  // Each entry keeps its bundle name under dist/; the object content preparer is site-owned preparation (site/build/content).
  entry: {
    ...Object.fromEntries(['prepare-authored', 'prepare-world-navigation', 'prepare-spatial-context', 'operations', 'operations-acquisition', 'refresh-features', 'refresh-photographs']
      .map(name => [name, resolve(root, 'tools/objects', `${name}.ts`)])),
    'content/prepare': resolve(root, 'site/build/content/prepare.ts'),
  },
  tsconfig: resolve(root, 'tools/objects/tsconfig.json'),
  format: ['esm'], target: 'node22', outDir: resolve(root, 'tools/objects/dist'), clean: true,
  splitting: false, sourcemap: false, dts: false,
  // packages/bake/cli/check-stale-builds.mts reads the inputs to know when this bundle is stale.
  metafile: true,
  // `@cssearth/renderer` is bundled, as it was when it was relative modules: its source subpaths are TypeScript whose sibling
  // imports name `.js`, which Node cannot load unbundled.
  external: ['@cssearth/astronomy', '@cssearth/bake', '@cssearth/catalog', '@cssearth/core', '@cssearth/engine', '@cssearth/fits', '@cssearth/objects', '@cssearth/spice', '@cssearth/telescope', '@cssearth/telescope-cli', 'sharp', '@layoutit/polycss', 'meshoptimizer', 'yaml'],
};
