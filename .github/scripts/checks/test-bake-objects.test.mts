import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { BAKE_OBJECT_TEST_PATHS, bakeObjectTests } from './test-bake-objects.mts';

test('a test joins the object-library run exactly when it imports an @cssearth/bake/objects entry', () => {
  const sources: Record<string, string> = {
    'tests/objects/color-transfer.test.mts': "import { linearToSrgb } from '@cssearth/bake/objects/color';",
    'tests/objects/eclipse-map/phase-curve.test.mts': "const { planckRadiance } = await import('@cssearth/bake/objects/raster');",
    'tests/objects/unit/shape.test.ts': "import type { SourceMesh } from \"@cssearth/bake/objects/geometry\";",
    'tests/objects/terrestrial-layers/junocam.test.mts': "import { decodeJunocam } from '@cssearth/bake/objects/layers/terrestrial';",
    'tests/objects/stars.test.mts': "import { prepareStarsObject } from '@cssearth/bake/stars';",
    'tests/objects/raster.test.mts': "import { parseRasterRecipe } from '@cssearth/bake/raster';",
    'tests/objects/helper.mts': "import { linearToSrgb } from '@cssearth/bake/objects/color';",
  };
  assert.deepEqual(bakeObjectTests(Object.keys(sources), path => sources[path]!), [
    'tests/objects/color-transfer.test.mts', 'tests/objects/eclipse-map/phase-curve.test.mts',
    'tests/objects/terrestrial-layers/junocam.test.mts', 'tests/objects/unit/shape.test.ts',
  ]);
});

test('the checkout selects the moved libraries\' own tests', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...BAKE_OBJECT_TEST_PATHS], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const selected = bakeObjectTests(tracked, path => readFileSync(resolve(root, path), 'utf8'));
  for (const path of ['tests/objects/color/color-transfer.test.mts', 'tests/objects/terrestrial/obj-shape.test.mts',
    'tests/objects/terrestrial/observer-camera.test.mts', 'tests/objects/terrestrial/scientific-raster.test.mts',
    'tests/objects/scene/authored-rotation.test.mts', 'packages/bake/src/objects/layers/paged-ellipsoid/parallel-assets.test.ts',
    'packages/bake/src/objects/layers/paged-ellipsoid/texture-levels.test.ts', 'packages/bake/src/objects/layers/terrestrial/triangle-alpha-atlas.test.ts',
    'packages/bake/src/objects/raster/observed/observed-geotiff.test.ts']) assert.ok(selected.includes(path), path);
});
