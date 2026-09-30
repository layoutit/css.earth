import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import { discoverObjectTests } from '@cssearth/bake/run-implemented-objects';

const root = projectRoot(import.meta.url);
test('per-object discovery keeps its four relocated shared suites and the body-owned suite', async () => {
  const files = await discoverObjectTests('earth', { projectRoot: root, readDirectory: async directory => {
    if (directory === resolve(root, 'src/objects/earth')) return ['paged-ellipsoid-scene.test.mts', 'object.json'];
    if (directory === resolve(root, 'site/test')) return ['runtime-package.test.mts', 'lighting-frame.test.mts',
      'exoplanet-radius.test.mts', 'exoplanet-limb-coverage.test.mts', 'unrelated.test.mts', 'prepared-world-context.test.ts'];
    throw new Error(`Retired test directory: ${directory}`);
  } });
  assert.deepEqual(files, [resolve(root, 'src/objects/earth/paged-ellipsoid-scene.test.mts'),
    ...['exoplanet-limb-coverage', 'exoplanet-radius', 'lighting-frame', 'runtime-package'].map(name => resolve(root, `site/test/${name}.test.mts`)),
    resolve(root, 'packages/bake/src/raster/raster-pages.test.mts')]);
});
