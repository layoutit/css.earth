import { defineConfig } from 'tsup';
import { fileURLToPath } from 'node:url';
import { packageBundlePlugins } from './src/package-bundle.mts';

/** The public sphere owner bundles the same workspace sources as the standalone CLI. */
export default defineConfig({
  entry: { 'sphere-lane': 'src/sphere/sphere-lane.mts', 'viewer-lane': 'src/delivery/viewer-lane.mts' },
  format: ['esm', 'cjs'],
  external: ['sharp', 'linkedom'],
  esbuildOptions(options) { options.packages = 'external'; },
  shims: true,
  splitting: false,
  noExternal: [/^@cssearth\//],
  esbuildPlugins: packageBundlePlugins(fileURLToPath(new URL('../..', import.meta.url))),
  dts: process.env.CSSEARTH_SKIP_DECLARATIONS !== '1' && { resolve: [/^@cssearth\//], compilerOptions: { types: ['node'], typeRoots: ['./node_modules/@types'], baseUrl: '../..', paths: {
    '@cssearth/objects': ['packages/objects/src/index.ts'],
    '@cssearth/bake/objects/scene': ['packages/bake/src/objects/scene/solar-geometry.ts'],
    '@cssearth/astronomy': ['packages/astronomy/src/index.ts'],
    '@cssearth/engine': ['packages/engine/src/index.ts'],
    '@cssearth/core': ['packages/core/src/index.ts'],
  } } },
  clean: false,
  target: 'node22',
  removeNodeProtocol: false,
});
