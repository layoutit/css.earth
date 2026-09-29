import assert from 'node:assert/strict';
import test from 'node:test';
import { bakeObjectTests } from './test-bake-objects.mts';

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
