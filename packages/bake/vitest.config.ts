import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // These suites prepare real objects from their published prepared data and restored sources; the package's own run has
    // neither. `pnpm test:preparation` (tools/contract/test-preparation.mts) runs them after restoring that data, as it did
    // before the compilers joined this package: the presentation suites in Vitest, the others under node:test.
    exclude: [...configDefaults.exclude, 'src/scene/scene.test.ts', 'src/presentation/*.test.ts', 'src/volume-leaves/*.test.ts', 'src/stars/*.test.ts', 'src/shell/*.test.ts'],
  },
});
