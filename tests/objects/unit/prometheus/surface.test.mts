import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('prometheus');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/prometheus/source');

test('Prometheus released plate mesh preserves PDS units, axes and vertex indices', async () => {
  const recipe = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const terrain = recipe.geometry.radialTerrain;
  const mesh = await loadPdsPlateShape(resolve(source, terrain.path), terrain.grid);
  // Independent NumPy reference: project every released triangle onto the plane
  // normal to each of +/-XYZ, solve barycentrics, take the nearest positive hit.
  // Source vertices are kilometres and zero-indexed; reference radii are metres.
  for (const [longitude, latitude, expected] of [
    [0, 0, 69070.200000],
    [90, 0, 39555.487198],
    [180, 0, 71531.397380],
    [270, 0, 41530.340820],
    [0, 90, 26337.600000],
    [0, -90, 27992.100000],
  ] as const) {
    const actual = mesh.sample(longitude, latitude);
    assert.ok(actual !== null && Math.abs(actual - expected) < 0.001,
      `${longitude}E ${latitude}N: expected ${expected}m, received ${actual}m`);
  }
});
