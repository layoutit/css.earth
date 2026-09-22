import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('nereid');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/objects/nereid/source/', import.meta.url);
const read = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('Nereid preserves the published ellipsoid family and nominal scale as a closed surface', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0,0,193759.272628], [90,0,171014.362426], [180,0,193759.272628], [270,0,171014.362426], [0,90,148269.452223], [0,-90,148269.452223]] as const) {
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<.001, `${lon},${lat}`);
  }
  // Kiss et al. (2016), Eq. 4: a/b=1.133 and c/b=0.867.
  const a = required(shape.sample(0,0)), b = required(shape.sample(90,0)), c = required(shape.sample(0,90));
  assert.ok(Math.abs(a/b-1.133)<1e-10);
  assert.ok(Math.abs(c/b-.867)<1e-10);
  assert.ok(Math.abs(Math.cbrt(a*b*c)-170000)<.001);
  assert.equal(recipe.geometry.radiusKm,170);
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
