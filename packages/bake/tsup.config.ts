import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

const root = dirname(fileURLToPath(import.meta.url))

// `volume` is browser-safe (the nebula lab's viewer imports it); `volume/node` and the other topics are Node-only.
const entry: Record<string, string> = { volume: 'src/volume/index.ts', 'volume/node': 'src/volume/node/index.ts', photometry: 'src/photometry/index.ts',
    raster: 'src/raster/index.ts', scene: 'src/scene/index.ts',
    presentation: 'src/presentation/index.ts',
    'volume-leaves': 'src/volume-leaves/index.ts',
    'stars': 'src/stars/index.ts',
    'shell': 'src/shell/index.ts',
    'sky': 'src/sky/index.ts',
    'density': 'src/density/index.ts',
    'image-layers': 'src/image-layers/index.ts',
    'environment': 'src/environment/index.ts',
    'objects/color': 'src/objects/color/index.ts',
    'objects/cameras': 'src/objects/cameras/index.ts',
    'objects/geometry': 'src/objects/geometry/index.ts',
    'galaxy-catalog': 'src/galaxy-catalog/index.ts',
    'cluster-catalog': 'src/cluster-catalog/index.ts',
    'world-context': 'src/world-context/index.ts',
    'objects/raster': 'src/objects/raster/index.ts',
    'objects/scene': 'src/objects/scene/index.ts',
    'nebula': 'src/nebula/index.ts',
    'objects/layers/cutaway': 'src/objects/layers/cutaway/index.ts',
    'objects/layers/giant': 'src/objects/layers/giant/index.ts',
    'objects/layers/material-composition': 'src/objects/layers/material-composition/index.ts',
    'objects/layers/observed-surfaces': 'src/objects/layers/observed-surfaces/index.ts',
    'objects/layers/paged-ellipsoid': 'src/objects/layers/paged-ellipsoid/index.ts',
    'objects/layers/terrestrial': 'src/objects/layers/terrestrial/index.ts' }

/** Declarations come from one `tsc` pass over the sources (`tsconfig.build.json`, emitted per file under `dist/types/`),
 * not tsup's `dts`: its rollup bundling of every entry in one worker grew past Node's default heap as topics were added,
 * while a plain declaration emit costs one type-check whatever the entry count. Each entry's `dist/<entry>.d.ts`, the
 * path `package.json` exports, re-exports its source index. The build config extends `tsconfig.node.json`, so every entry
 * is declared with Node's types and the DOM library (offline CSSOM reads evaluate in a browser page, and the renderer
 * types they name use it); `tsconfig.json` keeps both out of the browser-safe sources. */
async function emitDeclarations(): Promise<void> {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
  const run = spawnSync(process.execPath, [tsc, '-p', resolve(root, 'tsconfig.build.json')], { cwd: root, stdio: 'inherit' })
  if (run.status !== 0) throw new Error(`@cssearth/bake declarations: tsc exited with ${run.status ?? run.signal}`)
  for (const [name, source] of Object.entries(entry)) {
    const stub = resolve(root, 'dist', `${name}.d.ts`)
    const target = resolve(root, 'dist/types', relative('src', source)).replace(/\.ts$/u, '.js')
    await mkdir(dirname(stub), { recursive: true })
    const specifier = relative(dirname(stub), target).replaceAll('\\', '/')
    await writeFile(stub, `export * from '${specifier.startsWith('.') ? specifier : `./${specifier}`}';\n`)
  }
}

export default defineConfig({
  entry,
  // ESM only, like the preparation tools and the lab that import it.
  format: ['esm'],
  onSuccess: emitDeclarations,
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
