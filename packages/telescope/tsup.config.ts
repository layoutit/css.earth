import { defineConfig } from 'tsup'

export default defineConfig({
  // The library beside the `telescope` command (which build.mts bundles first into dist/telescope.mjs, so no clean here).
  // `index` is host-neutral; `node/index` is the Node-only entry (`@cssearth/telescope/node`). It is written to
  // dist/node/ without splitting so its code sits as deep under the package as src/node/ does: src/node/paths.ts finds
  // the package, its pinned toolchain files and the workspace from `import.meta.dirname` in both places.
  entry: { index: 'src/index.ts', 'node/index': 'src/node/index.ts' },
  tsconfig: 'tsconfig.lib.json',
  format: ['esm'],
  splitting: false,
  dts: { compilerOptions: { types: ['node'] } },
  clean: false,
  target: 'es2022',
  removeNodeProtocol: false,
})
