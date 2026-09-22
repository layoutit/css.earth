import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('proteus');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';

test('Proteus keeps the published west-positive radius samples in metres', async () => {
  const source = resolve(import.meta.dirname, '../../../../src/objects/proteus/source');
  const config = JSON.parse((await readFile(resolve(source, 'preparation/terrestrial.json'))).toString('utf8'));
  const profile = config.geometry.radialTerrain;
  const mesh = await loadPdsRadiusTable(resolve(source, profile.path), profile.grid);
  // Independent reference: the six corresponding cardinal rows of the PDS table.
  // East 90 maps to the released west 270 row, not west 90.
  for (const [longitude, latitude, metres] of [[0, 0, 194700.0], [90, 0, 192000.0], [180, 0, 218658.6], [270, 0, 199704.1], [0, 90, 205000.0], [0, -90, 200300.0]] as const) {
    assert.ok(Math.abs(required(mesh.sample(longitude, latitude)) - metres) < 0.001);
  }
});
