import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root = new URL('../../../../src/planets/aegaeon/source/', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root)));

test('Aegaeon preserves the source dimensions as a closed physical surface', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0,0,700.0], [90,0,250.0], [180,0,700.0], [270,0,250.0], [0,90,200.0], [0,-90,200.0]]) {
    assert.ok(Math.abs(shape.sample(lon,lat)-radius)<.001, `${lon},${lat}`);
  }
  assert.ok(Math.abs(recipe.geometry.radiusKm-Math.cbrt(0.7*0.25*0.2))<1e-10);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2); assert.equal(topology.components, 1);
});

import sharp from 'sharp';
test('unmapped material stays entirely missing rather than becoming invented albedo', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).raw().toBuffer();
  assert.equal(recipe.raster.observations[0].validity.noData,160);
  assert.ok(pixels.every(value => value===160));
});
