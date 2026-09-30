import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Relocated Node suites retain their test:node lane.
    exclude: [...configDefaults.exclude, 'src/node/provenance/dataset-destination.test.mts', 'src/node/runtime-asset-closure.test.mts', 'src/node/voyager-color.test.mts', 'src/node/prepared-activation-transport.test.mts', 'src/node/provenance/exploration-catalog.test.mts'],
  },
});
