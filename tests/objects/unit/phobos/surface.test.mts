import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/phobos/source');
test('phobos published mesh preserves axes, units, seam and polar samples',async()=>{
 const config=JSON.parse((await readFile(resolve(root,'preparation/terrestrial.json'))).toString('utf8')),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid);
 // Independent NumPy intersections against all native OBJ triangles, in metres.
 for(const [lon,lat,expected] of [[0, 0, 12533.906071], [90, 0, 11852.380973], [180, 0, 12847.932125], [270, 0, 11293.046229], [0, 90, 9867.899056], [0, -90, 8153.026985]] as const) {
  assert.ok(Math.abs(required(mesh.sample(lon,lat))-expected)<.001,`${lon}E ${lat}N`);
 }
 assert.ok(Math.abs(required(mesh.sample(0,0))-required(mesh.sample(360,0)))<.000001);
 const elevation=await loadScienceSurface(root,config.raster.scientific[0]);
 for(const lon of [0,90,180,270]) {
  const height=elevation.sample(lon,0);
  if(height!==null)assert.ok(Math.abs(height-(required(mesh.sample(lon,0))/1000-11.1))<.001);
 }
});
