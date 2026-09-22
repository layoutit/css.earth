import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/objects/himalia/source/', import.meta.url);
const read = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('Himalia preserves approximate elongation and volume through a closed physical surface', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0,0,98633.76271427155], [90,0,78907.01017141724], [180,0,98633.76271427155], [270,0,78907.01017141724], [0,90,78907.01017141724], [0,-90,78907.01017141724]] as const) {
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<.001, `${lon},${lat}`);
  }
  // Cassini projected elongation is modeled as intrinsic 1.25:1 with b=c;
  // the separate JPL radius sets the approximation's volume, not its axes.
  const a = required(shape.sample(0, 0)) / 1000, b = required(shape.sample(90, 0)) / 1000, c = required(shape.sample(0, 90)) / 1000;
  assert.ok(Math.abs(a / b - 150 / 120) < 1e-10);
  assert.ok(Math.abs(Math.cbrt(a * b * c) - 85) < 1e-10);
  assert.equal(recipe.geometry.radiusKm, 85);
  assert.ok(Math.abs(recipe.geometry.camera.framingScale - 85 / a) < 1e-10);
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
