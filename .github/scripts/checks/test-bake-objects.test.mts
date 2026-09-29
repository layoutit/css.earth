import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { BAKE_OBJECT_TEST_PATHS, bakeObjectTests } from './test-bake-objects.mts';

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

