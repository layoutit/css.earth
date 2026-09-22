import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
const root=new URL('../../../../src/objects/naiad/',import.meta.url);
test('Naiad prepared-source radii preserve the published ellipsoid axes in metres',async()=>{
  // Karkoschka2003 publisher abstract, DOI10.1016/S0019-1035(03)00002-2.
  const cfg=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
  const shape=parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab',root),'utf8'),cfg.geometry.radialTerrain.grid);
  for(const [lon,lat,radius] of [[0,0,48000],[90,0,30000],[180,0,48000],[270,0,30000],[0,90,26000],[0,-90,26000]] as const)
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<0.001,`${lon},${lat}`);
});
