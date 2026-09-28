import { defineConfig } from 'tsup'

export default defineConfig({
  // `node` and `node/contract` are the Node-only entries (`@cssearth/objects/node`, `@cssearth/objects/node/contract`);
  // `index`, `sources` and `provenance` stay browser-safe.
  entry: { index: 'src/index.ts', sources: 'src/sources/index.ts', provenance: 'src/provenance/index.ts', node: 'src/node/index.ts', 'node/contract': 'src/node/contract/index.ts' },
  format: ['esm', 'cjs'],
  // Only the node entry needs Node's types; `tsconfig.json` keeps them out of the browser-safe sources.
  dts: process.env.CSSEARTH_SKIP_DECLARATIONS !== '1' && { compilerOptions: { types: ['node'] } },
  clean: true,
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
