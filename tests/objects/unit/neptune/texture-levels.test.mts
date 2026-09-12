import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePreparedCubicSky } from '../../../../src/platform/cubic-sky-contract.mts';
import { validateDirectionalSunPlan } from '../../../../src/platform/directional-sun-contract.mts';
import { prepareBandedEllipsoid } from '../../../../tools/objects/giant-layers/geometry.mts';
import { prepareLayeredSurfacePresentation } from '../../../../tools/objects/giant-layers/presentation.mts';

const directory = resolve(fileURLToPath(new URL('../../../../', import.meta.url)), 'src/planets/neptune');
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(directory, path), 'utf8'));

// Neptune's density-1 surface carries no resize of its own, so the width comes
// from its lens transform: 2880 texels around 360 degrees. Its poles are written
// at one density only, which is why they stay a single resource.
test('the surface levels on its lens width while the single-density poles do not', async () => {
  const geometryConfig = await json('source/preparation/geometry.json');
  const presentation = await prepareLayeredSurfacePresentation({
    config: await json('source/preparation/presentation.json'), geometryConfig,
    geometry: prepareBandedEllipsoid(geometryConfig),
    observationConfig: await json('source/preparation/observations.json'),
    materialConfig: await json('source/preparation/materials.json'),
    sky: validatePreparedCubicSky(await json('prepared/sky.json'), { requireSun: false }),
    sun: validateDirectionalSunPlan(await json('prepared/sun.json')),
  });
  const levels = presentation.textureLevels;
  assert.ok(levels, 'Neptune declares prepared layer levels.');
  assert.deepEqual(levels.levels.map(level => level.minimumDiameter), [0, 2880 / (2 * Math.PI)]);
  assert.deepEqual(Object.keys(levels.levels[0]!.resources).sort(),
    ['surface:methane', 'surface:near-infrared', 'surface:normal']);
  assert.equal(levels.levels[0]!.resources['surface:normal'], 'surface:normal:level:2880');
  const keys = new Set(presentation.assets.entries.map(entry => entry.key));
  assert.ok(keys.has('poles:normal'), 'the single-density poles stay one resource');
  assert.ok(!keys.has('poles:normal:level:2880'), 'and gain no level twin');
  assert.ok(presentation.assets.startup.includes('surface:normal:level:2880'));
  assert.ok(presentation.assets.startup.includes('poles:normal'));
  const address = (key: string) => presentation.assets.entries.find(entry => entry.key === key)?.url;
  assert.equal(address('surface:normal:level:2880'), '/scenes/neptune/neptune-surface-normal.webp');
  assert.equal(address('surface:normal'), '/scenes/neptune/neptune-surface-normal@2x.webp');
});
