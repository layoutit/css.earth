import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadPdsVertexFacetShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {decodePdsByteImage} from '../../../../tools/objects/terrestrial-layers/pds-byte-mosaic.mjs';
const root=resolve(import.meta.dirname,'../../../../src/planets/phoebe/source');
test('Phoebe source mesh preserves PDS axes, units and polar radii',async()=>{
 const config=JSON.parse(await readFile(resolve(root,'preparation/terrestrial.json'))),p=config.geometry.radialTerrain;
 const mesh=await loadPdsVertexFacetShape(resolve(root,p.path),p.grid);
 // Independent NumPy intersections against every native source triangle, in metres.
 for(const [lon,lat,expected] of [[0,0,115295.083996],[90,0,112784.780872],[180,0,107396.895625],[270,0,108843.615011],[0,90,102115.335850],[0,-90,100250.599961]])
  assert.ok(Math.abs(mesh.sample(lon,lat)-expected)<.001,`${lon}E ${lat}N`);
 assert.ok(Math.abs(mesh.sample(0,0)-mesh.sample(360,0))<1e-6);
 const image=decodePdsByteImage(await readFile(resolve(root,'observations/SP_1M_0_0_SIMP.IMG')),{noData:0});
 assert.deepEqual([image.width,image.height,image.ppd,image.left,image.top,image.radiusKm],[2880,1440,8,1440,0,106.8]);
});
