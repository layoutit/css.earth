import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These suites prepare real bodies from their published prepared data and, for the scene, bake them; the package's own
    // run has neither. `pnpm test:preparation` (tools/contract/test-preparation.mts) runs them after restoring that data,
    // as it did before the compilers joined this package: the scene suite under node:test, the presentation one in Vitest.
    exclude: [...configDefaults.exclude, 'src/scene/scene.test.ts', 'src/presentation/*.test.ts'],
  },
});
