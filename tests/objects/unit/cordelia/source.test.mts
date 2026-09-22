import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import sharp from 'sharp';
const root = new URL('../../../../src/objects/cordelia/', import.meta.url);

test('Cordelia preserves the published prolate dimensions and ring-derived mass', async () => {
  const recipe = JSON.parse((await readFile(new URL('source/preparation/terrestrial.json', root))).toString('utf8'));
  const shape = parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0, 0, 25000], [90, 0, 18000], [180, 0, 25000], [270, 0, 18000], [0, 90, 18000], [0, -90, 18000]] as const) {
    assert.ok(Math.abs(required(shape.sample(lon, lat)) - radius) < .001, `${lon},${lat}`);
  }
  assert.ok(Math.abs(recipe.geometry.radiusKm - Math.cbrt(25 * 18 * 18)) < 1e-10);
  const measurement = JSON.parse((await readFile(new URL('source/measurements.json', root))).toString('utf8'));
  assert.deepEqual(measurement.projectedRadiusKm, {value: 21, uncertainty: 3, definition: 'sqrt(A*B), not volume-equivalent radius'});
  assert.equal(measurement.measuredGM.valueKm3PerS2, .00406);
  assert.equal(measurement.measuredGM.uncertaintyKm3PerS2, .00038);
  assert.equal(measurement.measuredGM.massKg, 6.08e16);
});

test('Cordelia unqualified Voyager imagery remains absent from mapped surface coverage', async () => {
  const recipe = JSON.parse((await readFile(new URL('source/preparation/terrestrial.json', root))).toString('utf8'));
  const image = await sharp(new URL('source/material/neutral.png', root).pathname).raw().toBuffer({resolveWithObject: true});
  assert.equal(recipe.raster.observations[0].validity.noData, 160);
  for (const value of image.data) assert.equal(value, 160);
  const inventory = JSON.parse((await readFile(new URL('source/survey/opus-finest.json', root))).toString('utf8'));
  assert.equal(inventory.page[0][0], 'vg-iss-2-u-c2687151');
  assert.equal(Number(inventory.page[0][1]), 10.00939);
});
