import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import sharp from 'sharp';
const root = new URL('../../../../src/objects/portia/', import.meta.url);

test('Portia preserves published prolate radii and separates projected from volume radius', async () => {
  const recipe = JSON.parse((await readFile(new URL('source/preparation/terrestrial.json', root))).toString('utf8'));
  const shape = parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0, 0, 78000], [90, 0, 63000], [180, 0, 78000], [270, 0, 63000], [0, 90, 63000], [0, -90, 63000]] as const) {
    assert.ok(Math.abs(required(shape.sample(lon, lat)) - radius) < .001, `${lon},${lat}`);
  }
  assert.ok(Math.abs(recipe.geometry.radiusKm - Math.cbrt(78 * 63 * 63)) < 1e-10);
  const published = JSON.parse((await readFile(new URL('source/survey/published-shape.json', root))).toString('utf8'));
  assert.deepEqual(published.moons[0].reportedSqrtABRadiusKm, {value: 70, uncertainty: 4});
  assert.deepEqual(published.moons[0].reportedMinorMajorRatio, {value: .8, uncertainty: .1});
  assert.match(published.moons[0].thirdAxis, /assumed/);
});

test('Portia few-pixel imagery does not become fabricated mapped surface coverage', async () => {
  const recipe = JSON.parse((await readFile(new URL('source/preparation/terrestrial.json', root))).toString('utf8'));
  const image = await sharp(new URL('source/material/neutral.png', root).pathname).raw().toBuffer({resolveWithObject: true});
  assert.equal(recipe.raster.observations[0].validity.noData, 160);
  for (const value of image.data) assert.equal(value, 160);
  const inventory = JSON.parse((await readFile(new URL('source/survey/opus-finest.json', root))).toString('utf8'));
  assert.equal(inventory.page[0][0], 'vg-iss-2-u-c2675821');
  assert.equal(Number(inventory.page[0][1]), 35.93425);
});
