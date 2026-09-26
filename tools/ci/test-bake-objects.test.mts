import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { BAKE_OBJECT_TEST_PATHS, bakeObjectTests } from './test-bake-objects.mts';

test('a test joins the object-library run exactly when it imports an @cssearth/bake/objects entry', () => {
  const sources: Record<string, string> = {
    'tools/objects/color-transfer.test.mts': "import { linearToSrgb } from '@cssearth/bake/objects/color';",
    'tools/objects/eclipse-map/phase-curve.test.mts': "const { planckRadiance } = await import('@cssearth/bake/objects/raster');",
    'tests/objects/unit/shape.test.ts': "import type { SourceMesh } from \"@cssearth/bake/objects/geometry\";",
    'tools/objects/terrestrial-layers/junocam.test.mts': "import { decodeJunocam } from '@cssearth/bake/objects/layers/terrestrial';",
    'tools/objects/stars.test.mts': "import { prepareStarsObject } from '@cssearth/bake/stars';",
    'tools/objects/raster.test.mts': "import { parseRasterRecipe } from '@cssearth/bake/raster';",
    'tools/objects/helper.mts': "import { linearToSrgb } from '@cssearth/bake/objects/color';",
  };
  assert.deepEqual(bakeObjectTests(Object.keys(sources), path => sources[path]!), [
    'tests/objects/unit/shape.test.ts', 'tools/objects/color-transfer.test.mts', 'tools/objects/eclipse-map/phase-curve.test.mts',
    'tools/objects/terrestrial-layers/junocam.test.mts',
  ]);
});

test('the checkout selects the moved libraries\' own tests', () => {
  const root = resolve(import.meta.dirname, '../..');
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...BAKE_OBJECT_TEST_PATHS], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const selected = bakeObjectTests(tracked, path => readFileSync(resolve(root, path), 'utf8'));
  for (const path of ['tools/objects/color-transfer.test.mts', 'tools/objects/terrestrial-layers/obj-shape.test.mts',
    'tools/objects/terrestrial-layers/observer-camera.test.mts', 'tools/objects/terrestrial-layers/scientific-raster.test.mts',
    'tools/objects/authored-rotation.test.mts']) assert.ok(selected.includes(path), path);
});
