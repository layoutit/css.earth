import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The scene compiler's suite is a node:test file that bakes real bodies; `pnpm test:preparation` compiles and runs it
    // (tools/contract/test-preparation.mts), as it did before the compilers joined this package.
    exclude: [...configDefaults.exclude, 'src/scene/scene.test.ts'],
  },
});
