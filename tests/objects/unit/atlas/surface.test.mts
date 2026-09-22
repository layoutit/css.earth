import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('atlas');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/atlas/source');

test('Atlas released plate mesh preserves PDS units, axes and vertex indices', async () => {
  const recipe = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const terrain = recipe.geometry.radialTerrain;
  const mesh = await loadPdsPlateShape(resolve(source, terrain.path), terrain.grid);
  // Independent NumPy reference: project every released triangle onto the plane
  // normal to each of +/-XYZ, solve barycentrics, take the nearest positive hit.
  // Source vertices are kilometres and zero-indexed; reference radii are metres.
  for (const [longitude, latitude, expected] of [
    [0, 0, 23361.400000],
    [90, 0, 20864.141904],
    [180, 0, 24156.148142],
    [270, 0, 20115.707689],
    [0, 90, 9182.000000],
    [0, -90, 10053.500000],
  ] as const) {
    const actual = mesh.sample(longitude, latitude);
    assert.ok(actual !== null && Math.abs(actual - expected) < 0.001,
      `${longitude}E ${latitude}N: expected ${expected}m, received ${actual}m`);
  }
});
