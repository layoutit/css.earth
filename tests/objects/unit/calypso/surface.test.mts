import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('calypso');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

const source = resolve(import.meta.dirname, '../../../../src/objects/calypso/source');

test('Calypso released plate mesh preserves PDS units, axes and vertex indices', async () => {
  const recipe = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const terrain = recipe.geometry.radialTerrain;
  const mesh = await loadPdsPlateShape(resolve(source, terrain.path), terrain.grid);
  // Independent NumPy reference: project every released triangle onto the plane
  // normal to each of +/-XYZ, solve barycentrics, take the nearest positive hit.
  // Source vertices are kilometres and zero-indexed; reference radii are metres.
  for (const [longitude, latitude, expected] of [[0, 0, 16379.6], [90, 0, 9645.799559039497], [180, 0, 13725.450403395183], [270, 0, 8637.119432970661], [0, 90, 6613.199999999999], [0, -90, 6403.6]] as const) {
    const actual = mesh.sample(longitude, latitude);
    assert.ok(actual !== null && Math.abs(actual - expected) < 0.001,
      `${longitude}E ${latitude}N: expected ${expected}m, received ${actual}m`);
  }
});
