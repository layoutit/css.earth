import {requireRecord} from '../../../../tools/source-values.mts';
import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/planets/polydeuces/source/', import.meta.url);
const read = async (path: string|URL) => JSON.parse((await readFile(new URL(path, root))).toString('utf8'));

test('Polydeuces preserves the source dimensions as a closed physical surface', async () => {
  const recipe = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), recipe.geometry.radialTerrain.grid);
  for (const [lon, lat, radius] of [[0,0,1750.0], [90,0,1550.0], [180,0,1750.0], [270,0,1550.0], [0,90,1310.0], [0,-90,1310.0]] as const) {
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<.001, `${lon},${lat}`);
  }
  assert.ok(Math.abs(recipe.geometry.radiusKm-Math.cbrt(1.75*1.55*1.31))<1e-10);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2); assert.equal(topology.components, 1);
});

import {decodeCalibratedCamera,prepareShapeCameraMosaic} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';
test('Polydeuces retains calibrated native pixels and withholds the unseen hemisphere', async () => {
  const recipe = await read('preparation/terrestrial.json'), manifest = await read('manifest.json');
  const chosen = recipe.raster.mosaics[0];
  const image = decodeCalibratedCamera(await readFile(new URL(chosen.frames[0].path, root)));
  assert.equal(image.offset,8192);
  assert.ok(image.data[511*1024+525]>.62 && image.data[511*1024+525]<.63);
  const map = await prepareShapeCameraMosaic(root.pathname,manifest.inputs.filter((e:unknown)=>array(text)(requireRecord(e).consumers).includes(chosen.consumer)),chosen,64,32,recipe.geometry.radialTerrain);
  assert.ok(map.grid.coveragePixels>50 && map.grid.coveragePixels<600);
  for(let y=0;y<32;y++)for(let x=35;x<55;x++)assert.equal(map.missing[y*64+x],1);
});
