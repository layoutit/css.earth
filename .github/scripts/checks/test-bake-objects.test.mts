import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob, resolve } from 'node:path';
import test from 'node:test';
import { BAKE_OBJECT_TEST_PATHS, RESTORED_PACKAGE_TESTS, bakeObjectTests } from './test-bake-objects.mts';

test('object-entry tests join the object-library run and unrelated test files stay out', () => {
  const sources: Record<string, string> = {
    'tests/objects/color-transfer.test.mts': "import { linearToSrgb } from '@cssearth/bake/objects/color';",
    'packages/bake/src/objects/raster/eclipse-map/phase-curve.test.mts': "const { planckRadiance } = await import('@cssearth/bake/objects/raster');",
    'tests/objects/unit/shape.test.ts': "import type { SourceMesh } from \"@cssearth/bake/objects/geometry\";",
    'tests/objects/terrestrial-layers/junocam.test.mts': "import { decodeJunocam } from '@cssearth/bake/objects/layers/terrestrial';",
    'tests/objects/stars.test.mts': "import { prepareStarsObject } from '@cssearth/bake/stars';",
    'tests/objects/raster.test.mts': "import { parseRasterRecipe } from '@cssearth/bake/raster';",
    'tests/objects/helper.mts': "import { linearToSrgb } from '@cssearth/bake/objects/color';",
  };
  assert.deepEqual(bakeObjectTests(Object.keys(sources), path => sources[path]!), [
    'tests/objects/color-transfer.test.mts', 'packages/bake/src/objects/raster/eclipse-map/phase-curve.test.mts',
    'tests/objects/terrestrial-layers/junocam.test.mts', 'tests/objects/unit/shape.test.ts',
  ].sort());
});

test('the checkout selects the moved libraries\' own tests', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...BAKE_OBJECT_TEST_PATHS], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const selected = bakeObjectTests(tracked, path => readFileSync(resolve(root, path), 'utf8'));
  for (const path of ['packages/bake/src/objects/color/color-transfer.test.mts', 'packages/bake/src/objects/geometry/obj-shape.test.mts',
    'packages/bake/src/objects/cameras/observer-camera.test.mts', 'packages/bake/src/objects/raster/scientific-raster.test.mts',
    'packages/bake/src/objects/scene/authored-rotation.test.mts', 'packages/bake/src/objects/layers/paged-ellipsoid/parallel-assets.test.ts',
    'packages/bake/src/objects/layers/paged-ellipsoid/texture-levels.test.ts', 'packages/bake/src/objects/layers/terrestrial/triangle-alpha-atlas.test.ts',
    'packages/bake/src/objects/raster/observed/observed-geotiff.test.ts']) assert.ok(selected.includes(path), path);
});

test('preparation suites stay out while relocated Node suites join without object-entry imports', () => {
  const sources: Record<string, string> = {
    'packages/bake/src/scene/scene.test.ts': "import test from 'node:test';",
    'packages/bake/src/density/atlas.test.ts': "import test from 'node:test';",
    'packages/bake/src/density/volume.test.ts': "import { sourceTest } from '@cssearth/objects/node/source-test';",
    'packages/bake/src/objects/surface-features/atlas-edge.test.ts': "import test from 'node:test';",
    'packages/bake/src/scene/leaf-raster-scale.test.ts': "import test from 'node:test';",
    'packages/bake/src/objects/acquisition/acquisition-request.test.ts': "import test from 'node:test';",
  };
  assert.deepEqual(bakeObjectTests(Object.keys(sources), path => sources[path]!), [
    'packages/bake/src/objects/acquisition/acquisition-request.test.ts',
    'packages/bake/src/scene/leaf-raster-scale.test.ts',
  ]);
});

test('the tests of restored packages stay in the lane that restores them', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...BAKE_OBJECT_TEST_PATHS], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of RESTORED_PACKAGE_TESTS) {
    assert.ok(tracked.includes(path), `${path} exists`);
    assert.ok(!bakeObjectTests(tracked, file => readFileSync(resolve(root, file), 'utf8')).includes(path), path);
    assert.ok(readFileSync(resolve(root, '.github/workflows/audit.yml'), 'utf8').includes(path), `audit.yml runs ${path}`);
  }
});

test('T2d relocated selector suites remain discoverable after their paths and imports change', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...BAKE_OBJECT_TEST_PATHS], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const selected = bakeObjectTests(tracked, path => readFileSync(resolve(root, path), 'utf8'));
  const relocated = [
    'packages/bake/src/astronomy/fixtures/small-kernel.oracle.test.mts',
    'packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts',
    'packages/bake/src/photometry/whole-disc-colour.test.mts',
    'packages/bake/src/surface-previews/surface-preview-rasters.test.mts',
  ];
  for (const path of relocated) assert.ok(selected.includes(path), `original selector lane retained: ${path}`);
  assert.deepEqual(bakeObjectTests(relocated, () => "import test from 'node:test';"), relocated.sort());
});

test('every data-dependent preparation exclusion stays out of the sparse-tree selector', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'packages/bake/src'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const config = readFileSync(resolve(root, 'packages/bake/vitest.config.ts'), 'utf8');
  // The following group owns preparation data; earlier relocated Node exclusions and later object-library exclusions
  // belong to other runners. Test the actual files, including node:test and sourceTest suites, rather than their labels.
  const preparationGroup = config.slice(config.indexOf("'src/scene/scene.test.ts'"), config.indexOf('// The object libraries'));
  const patterns = [...preparationGroup.matchAll(/'([^']+\.test\.ts)'/gu)].map(match => `packages/bake/${match[1]}`);
  assert.ok(patterns.includes('packages/bake/src/density/*.test.ts'), 'preparation group found');
  const preparation = tracked.filter(path => patterns.some(pattern => matchesGlob(path, pattern)));
  preparation.push('packages/bake/src/objects/surface-features/atlas-edge.test.ts');
  assert.ok(preparation.length >= 20, 'all preparation suites discovered');
  const selected = bakeObjectTests(tracked, path => readFileSync(resolve(root, path), 'utf8'));
  for (const path of [...preparation, ...RESTORED_PACKAGE_TESTS]) assert.ok(!selected.includes(path), `requires restored data: ${path}`);
});
