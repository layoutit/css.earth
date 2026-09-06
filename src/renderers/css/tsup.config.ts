import { fileURLToPath } from 'node:url';

export default {
  entry: [fileURLToPath(new URL('./index.ts', import.meta.url))],
  outDir: fileURLToPath(new URL('./dist', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
  format: ['esm', 'cjs'],
  external: ['@cssearth/engine', '@cssearth/objects', '@layoutit/polycss'],
  dts: true,
  clean: true,
  target: 'es2022',
};
