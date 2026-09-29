import { defineConfig } from 'tsup'
import { copyFile, mkdir } from 'node:fs/promises'

export default defineConfig({
  // `node` and `oracle/*` are Node-only; `index` and `schema` stay browser-safe.
  entry: { index: 'src/index.ts', schema: 'src/schema.ts', node: 'src/node/index.ts', 'oracle/fixture': 'src/node/oracle/fixture.mts', 'oracle/run': 'src/node/oracle/run.mts', 'oracle/setup': 'src/node/oracle/setup.mts' },
  format: ['esm', 'cjs'],
  // The Node-only entries need Node types; the browser-safe sources exclude them.
  dts: process.env.CSSEARTH_SKIP_DECLARATIONS !== '1' && { compilerOptions: { types: ['node'] } },
  external: ['@cssearth/core', '@cssearth/core/node'],
  clean: true,
  async onSuccess() {
    await mkdir(new URL('./dist/oracle/', import.meta.url), { recursive: true })
    for (const name of ['fixture.py', 'requirements.txt'])
      await copyFile(new URL(`./src/node/oracle/${name}`, import.meta.url), new URL(`./dist/oracle/${name}`, import.meta.url))
  },
  target: 'es2022',
  // Keep `node:` specifiers so a browser bundler can never mistake the node entry's imports for polyfillable modules.
  removeNodeProtocol: false,
})
