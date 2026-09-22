import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
const root=new URL('../../../../src/objects/despina/',import.meta.url);
test('Despina preserves the published triaxial axes rather than using the PCK sphere as shape',async()=>{
  const cfg=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
  const shape=parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab',root),'utf8'),cfg.geometry.radialTerrain.grid);
  // Karkoschka (2003), Icarus 162:400–407 abstract and Table 1, independent of the recipe.
  for(const [lon,lat,radius] of [[0,0,90000],[90,0,74000],[180,0,90000],[270,0,74000],[0,90,64000],[0,-90,64000]] as const)
    assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<0.001,`${lon},${lat}`);
  const pck=await readFile(new URL('source/shape/pck00011.tpc',root),'utf8');
  assert.deepEqual(required(pck.match(/BODY805_RADII\s*=\s*\(([^)]+)\)/))[1].trim().split(/\s+/).map(Number),[74,74,74]);
  assert.equal(cfg.geometry.radiusKm,74);
});
