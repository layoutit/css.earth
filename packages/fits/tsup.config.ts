import { defineConfig } from 'tsup'

export default defineConfig({
  // `node` is the Node-only entry (`@cssearth/fits/node`); `index` parses bytes and stays browser-safe.
  entry: { index: 'src/index.ts', node: 'src/node/index.ts' },
  format: ['esm', 'cjs'],
  // Only the node entry needs Node's types; `tsconfig.json` keeps them out of the browser-safe sources.
  dts: { compilerOptions: { types: ['node'] } },
  clean: true,
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
