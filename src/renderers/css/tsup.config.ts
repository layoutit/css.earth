import { fileURLToPath } from 'node:url';

export default {
  entry: {
    index: fileURLToPath(new URL('./index.ts', import.meta.url)),
    universe: fileURLToPath(new URL('./universe/index.ts', import.meta.url)),
    navigation: fileURLToPath(new URL('./navigation/index.ts', import.meta.url)),
    testing: fileURLToPath(new URL('./testing.ts', import.meta.url)),
    'point-field-selection-worker': fileURLToPath(new URL('./stars/point-field-selection-worker.ts', import.meta.url)),
    'world-context-planner-worker': fileURLToPath(new URL('./universe/world-context-planner-worker.ts', import.meta.url)),
    'prepared-object-worker': fileURLToPath(new URL('./prepared-object-worker.ts', import.meta.url)),
  },
  outDir: fileURLToPath(new URL('./dist', import.meta.url)),
  tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
  format: ['esm', 'cjs'],
  external: ['@cssearth/engine', '@cssearth/objects', '@layoutit/polycss'],
  dts: true,
  clean: true,
  target: 'es2022',
};
