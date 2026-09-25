import { defineConfig } from 'tsup'

export default defineConfig({
  // The library beside the `telescope` command (which build.mts bundles first into dist/telescope.mjs, so no clean here).
  // `index` is host-neutral; `node/index` is the Node-only entry (`@cssearth/telescope/node`), written to dist/node/.
  entry: { index: 'src/index.ts', 'node/index': 'src/node/index.ts' },
  tsconfig: 'tsconfig.lib.json',
  format: ['esm'],
  splitting: false,
  dts: { compilerOptions: { types: ['node'] } },
  clean: false,
  target: 'es2022',
  removeNodeProtocol: false,
})
