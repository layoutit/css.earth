import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: process.env.CSSEARTH_SKIP_DECLARATIONS !== '1',
  clean: true,
  target: 'es2022',
})
