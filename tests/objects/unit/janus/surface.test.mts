import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('janus');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/janus/source');

test('Janus released plate mesh preserves PDS units, axes and vertex indices', async () => {
  const recipe = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const terrain = recipe.geometry.radialTerrain;
  const mesh = await loadPdsPlateShape(resolve(source, terrain.path), terrain.grid);
  // Independent NumPy reference: project every released triangle onto the plane
  // normal to each of +/-XYZ, solve barycentrics, take the nearest positive hit.
  // Source vertices are kilometres and zero-indexed; reference radii are metres.
  for (const [longitude, latitude, expected] of [
    [0, 0, 93736.000000],
    [90, 0, 95997.528245],
    [180, 0, 106067.128583],
    [270, 0, 88844.543809],
    [0, 90, 70236.500000],
    [0, -90, 73980.100000],
  ] as const) {
    const actual = mesh.sample(longitude, latitude);
    assert.ok(actual !== null && Math.abs(actual - expected) < 0.001,
      `${longitude}E ${latitude}N: expected ${expected}m, received ${actual}m`);
  }
});
