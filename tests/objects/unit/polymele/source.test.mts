import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/objects/polymele/source/', import.meta.url);
test('Polymele preserves the occultation semiaxes, not the full axis lengths as radii', async () => {
  const config = JSON.parse((await readFile(new URL('preparation/terrestrial.json', root))).toString('utf8'));
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  for (const [lon, lat, metres] of [[0, 0, 13500], [90, 0, 12200], [0, 90, 5200], [0, -90, 5200]] as const) assert.ok(Math.abs(required(shape.sample(lon, lat)) - metres) < .001);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2);
  assert.equal(topology.components, 1);
  const rotation = JSON.parse((await readFile(new URL('preparation/rotation.json', root))).toString('utf8'));
  assert.equal(rotation.schema, 'cssearth-display-orientation@1');
  assert.equal(rotation.phase, 'arbitrary-display-phase');
  assert.equal(rotation.periodHours, undefined, 'The uncertain catalog period must not become a measured rotation.');
});
