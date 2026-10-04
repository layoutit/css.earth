import { defineConfig } from 'tsup'

export default defineConfig({
  // `node`, `node/contract` and `node/source-test` are Node-only entries.
  // `index`, `sources` and `provenance` stay browser-safe.
  entry: { 'archived-camera': 'src/prepared-data/archived-camera.ts', index: 'src/index.ts', sources: 'src/sources/index.ts', provenance: 'src/provenance/index.ts', node: 'src/node/index.ts', 'node/contract': 'src/node/contract/index.ts', 'node/source-test': 'src/node/source-test.ts' },
  format: ['esm', 'cjs'],
  // Only the node entry needs Node's types; `tsconfig.json` keeps them out of the browser-safe sources.
  dts: process.env.CSSEARTH_SKIP_DECLARATIONS !== '1' && { compilerOptions: { types: ['node'] } },
  clean: true,
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
