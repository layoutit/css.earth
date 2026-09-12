import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePreparedCubicSky } from '../../../../src/platform/cubic-sky-contract.mts';
import { validateDirectionalSunPlan } from '../../../../src/platform/directional-sun-contract.mts';
import { prepareBandedEllipsoid } from '../../../../tools/objects/giant-layers/geometry.mts';
import { prepareLayeredSurfacePresentation } from '../../../../tools/objects/giant-layers/presentation.mts';

const directory = resolve(fileURLToPath(new URL('../../../../', import.meta.url)), 'src/planets/uranus');
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(directory, path), 'utf8'));

// The layered lane reads the density-1 texel width from its own recipe: the last
// resize applied before packing, 1920 texels around 360 degrees for Uranus. The
// prepared plan itself is not compared here, because this lane's accepted runtime
// no longer reproduces from its source (see its presentation-preparation test).
test('observed layers level by the projected silhouette of the density-1 map', async () => {
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
  assert.ok(levels, 'Uranus declares prepared layer levels.');
  assert.equal(levels.hysteresis, 0.2);
  assert.deepEqual(levels.levels.map(level => level.minimumDiameter), [0, 1920 / (2 * Math.PI)]);
  // Both observed layers carry two densities, so both level together.
  assert.deepEqual(levels.levels[0]!.resources, Object.fromEntries(
    ['normal', 'methane', 'near-infrared'].flatMap(lens => ['surface', 'poles']
      .map(role => [`${role}:${lens}`, `${role}:${lens}:level:1920`]))));
  assert.deepEqual(levels.levels[1]!.resources, Object.fromEntries(
    ['normal', 'methane', 'near-infrared'].flatMap(lens => ['surface', 'poles']
      .map(role => [`${role}:${lens}`, `${role}:${lens}`]))));
  // The mount names level 0, and every level address is a declared resource.
  const keys = new Set(presentation.assets.entries.map(entry => entry.key));
  assert.ok(presentation.assets.startup.includes('surface:normal:level:1920'));
  assert.ok(presentation.assets.startup.includes('poles:normal:level:1920'));
  for (const level of levels.levels) for (const [source, target] of Object.entries(level.resources)) {
    assert.ok(keys.has(source), `${source} is declared`);
    assert.ok(keys.has(target), `${target} is declared`);
  }
  const address = (key: string) => presentation.assets.entries.find(entry => entry.key === key)?.url;
  assert.equal(address('surface:normal:level:1920'), '/scenes/uranus/uranus-surface-normal.webp');
  assert.equal(address('surface:normal'), '/scenes/uranus/uranus-surface-normal@2x.webp');
});
