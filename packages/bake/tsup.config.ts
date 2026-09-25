import { defineConfig } from 'tsup'

export default defineConfig({
  // `volume` is browser-safe (the nebula lab's viewer imports it); `volume/node` is the Node-only volume bake.
  entry: { volume: 'src/volume/index.ts', 'volume/node': 'src/volume/node/index.ts' },
  // ESM only, like the preparation tools and the lab that import it.
  format: ['esm'],
  // Only the node entry needs Node's types; `tsconfig.json` keeps them out of the browser-safe sources.
  dts: { compilerOptions: { types: ['node'] } },
  clean: true,
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
