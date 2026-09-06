import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default {
  entry: ['prepare-authored.ts', 'celestial/prepare.ts', 'operations.ts'].map(path => resolve(root, 'tools/objects', path)),
  format: ['esm'], target: 'node22', outDir: resolve(root, 'tools/objects/dist'), clean: true,
  splitting: false, sourcemap: false, dts: false,
  external: ['@cssearth/astronomy', '@cssearth/engine', '@cssearth/objects', 'sharp', '@layoutit/polycss'],
};
