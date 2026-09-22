import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('fortuna');
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/fortuna/source');
const read=createSourceFixtureReader(root);
test('Fortuna preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[7764.416200000001,-3312.0055,97129.89]);
 assert.deepEqual(mesh.indices[0],[0,1162,1163]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[4642,9280,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-4885782.97441428)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,7.443224);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,105.5);assert.equal(config.raster.scientific[0].valueTransform.offset,-105.5);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('Fortuna keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'fortuna',planetName:'Fortuna',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,9280);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=1800);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
