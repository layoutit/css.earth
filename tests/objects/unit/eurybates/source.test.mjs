import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root = new URL('../../../../src/planets/eurybates/source/', import.meta.url);
test('Eurybates preserves the published approximation extents, not the full axis lengths as radii', async () => {
  const config = JSON.parse(await readFile(new URL('preparation/terrestrial.json', root)));
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  for (const [lon, lat, metres] of [[0, 0, 38750], [90, 0, 35650], [0, 90, 30900], [0, -90, 30900]]) assert.ok(Math.abs(shape.sample(lon, lat) - metres) < .001);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2);
  assert.equal(topology.components, 1);
});
