import { fileURLToPath } from 'node:url';

export default {
  entry: {
    "prepared-destination-worker": fileURLToPath(new URL("./paging/prepared-destination-worker.ts", import.meta.url)),
    index: fileURLToPath(new URL('./index.ts', import.meta.url)),
    universe: fileURLToPath(new URL('./universe/index.ts', import.meta.url)),
    navigation: fileURLToPath(new URL('./navigation/index.ts', import.meta.url)),
    testing: fileURLToPath(new URL('./testing.ts', import.meta.url)),
  },
  outDir: fileURLToPath(new URL('./dist', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
  format: ['esm', 'cjs'],
  external: ['@cssearth/engine', '@cssearth/objects', '@layoutit/polycss'],
  dts: true,
  clean: true,
  target: 'es2022',
};
