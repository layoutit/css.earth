import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('adrastea');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
const root=new URL('../../../../src/objects/adrastea/',import.meta.url);
test('Adrastea model preserves the independently published triaxial dimensions in metres',async()=>{
  const source=await readFile(new URL('source/shape/pck00011.tpc',root),'utf8');
  const radii=required(source.match(/BODY515_RADII\s*=\s*\(([^)]+)\)/))[1].trim().split(/\s+/).map(Number);
  assert.deepEqual(radii,[10,8,7]);
  const cfg=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
  const shape=parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab',root),'utf8'),cfg.geometry.radialTerrain.grid);
  for(const [lon,lat,radius] of [[0,0,10000],[90,0,8000],[180,0,10000],[270,0,8000],[0,90,7000],[0,-90,7000]] as const)
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<0.001,`${lon},${lat}`);
});
