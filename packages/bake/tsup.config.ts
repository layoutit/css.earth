import { defineConfig } from 'tsup'

export default defineConfig({
  // `volume` is browser-safe (the nebula lab's viewer imports it); `volume/node` and the other topics are Node-only.
  entry: { volume: 'src/volume/index.ts', 'volume/node': 'src/volume/node/index.ts', photometry: 'src/photometry/index.ts',
    raster: 'src/raster/index.ts' },
  // ESM only, like the preparation tools and the lab that import it.
  format: ['esm'],
  // Only the Node entries need Node's types; `tsconfig.json` keeps them out of the browser-safe sources.
  dts: { compilerOptions: { types: ['node'] } },
  clean: true,
  // The raster lane re-exports a renderer constant from its source subpath (`@cssearth/renderer/rendering/*.ts`). Those
  // subpaths are TypeScript whose sibling imports name `.js`, which Node cannot load, so they are bundled; the renderer's
  // built entries would be too, but no topic imports one.
  noExternal: [/^@cssearth\/renderer\//],
  // tools/ci/check-stale-builds.mts reads the inputs to know when this bundle is stale.
  metafile: true,
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
