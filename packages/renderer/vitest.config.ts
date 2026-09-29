import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Relocated Node suites retain their test:node lane.
    exclude: [...configDefaults.exclude, 'src/labels/surface-feature-discovery.test.mts'],
  },
});
