import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default {
  entry: ['restore-environment-images.ts', 'prepare-galaxy-catalog.ts', 'prepare-image-layers.ts', 'prepare-authored.ts', 'prepare-lighting-bank.ts', 'prepare-world-navigation.ts', 'prepare-spatial-context.ts', 'prepare-volume.ts', 'prepare-stars.ts', 'prepare-shell.ts', 'content/prepare.ts', 'operations.ts', 'source-files.ts', 'operations-acquisition.ts', 'surface-features/attach.ts', 'surface-features/notes.ts', 'refresh-features.ts', 'refresh-sphere-photographs.mts', 'refresh-photographs.ts'].map(path => resolve(root, 'tools/objects', path)),
  tsconfig: resolve(root, 'tools/objects/tsconfig.json'),
  format: ['esm'], target: 'node22', outDir: resolve(root, 'tools/objects/dist'), clean: true,
  splitting: false, sourcemap: false, dts: false,
  // tools/ci/check-stale-builds.mts reads the inputs to know when this bundle is stale.
  metafile: true,
  external: ['@cssearth/astronomy', '@cssearth/catalog', '@cssearth/core', '@cssearth/engine', '@cssearth/fits', '@cssearth/objects', '@cssearth/telescope', 'sharp', '@layoutit/polycss', 'meshoptimizer', 'yaml'],
};
