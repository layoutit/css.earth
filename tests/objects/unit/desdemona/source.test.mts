import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import sharp from 'sharp';
const root = new URL('../../../../src/objects/desdemona/source/', import.meta.url);
const read = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('Desdemona retains the published axes without confusing projected and volume radii', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0,0,45000], [90,0,27000], [180,0,45000], [270,0,27000], [0,90,27000], [0,-90,27000]] as const) {
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<.001, `${lon},${lat}`);
  }
  assert.ok(Math.abs(recipe.geometry.radiusKm-Math.cbrt(45*27*27))<1e-10);
  const measurements = await read('measurements.json');
  assert.deepEqual(measurements.semiAxesKm, [45,27,27]);
});

test('Desdemona grid remains explicitly unavailable surface coverage', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).raw().toBuffer();
  assert.equal(recipe.raster.observations[0].validity.noData,160);
  assert.ok(pixels.every(value => value===160));
  const observation = await read('survey/native-inspection.json');
  assert.equal(observation.surfaceIntercept,null);
  const rotation = await read('preparation/rotation.json');
  assert.equal(rotation.referenceEpochJdTt,2461286.5);
});
