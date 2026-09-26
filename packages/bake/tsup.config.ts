import { defineConfig } from 'tsup'

export default defineConfig({
  // `volume` is browser-safe (the nebula lab's viewer imports it); `volume/node` and the other topics are Node-only.
  entry: { volume: 'src/volume/index.ts', 'volume/node': 'src/volume/node/index.ts', photometry: 'src/photometry/index.ts',
    raster: 'src/raster/index.ts', scene: 'src/scene/index.ts',
    presentation: 'src/presentation/index.ts',
    'volume-leaves': 'src/volume-leaves/index.ts',
    'stars': 'src/stars/index.ts',
    'shell': 'src/shell/index.ts',
    'sky': 'src/sky/index.ts' },
  // ESM only, like the preparation tools and the lab that import it.
  format: ['esm'],
  // Only the Node entries need Node's types and the DOM library (offline CSSOM reads evaluate in a browser page, and the
  // renderer types they name use it); `tsconfig.json` keeps both out of the browser-safe sources.
  dts: { compilerOptions: { types: ['node'], lib: ['ES2023', 'DOM', 'DOM.Iterable'] } },
  clean: true,
  // Topics read renderer constants, types and validators from its source subpaths (`@cssearth/renderer/rendering/*.ts`).
  // Those subpaths are TypeScript whose sibling imports name `.js`, which Node cannot load, so they are bundled; the
  // renderer's built entries would be too, but no topic imports one.
  noExternal: [/^@cssearth\/renderer\//],
  // tools/ci/check-stale-builds.mts reads the inputs to know when this bundle is stale.
  metafile: true,
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
