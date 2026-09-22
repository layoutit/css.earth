import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/hektor/source'),read=createSourceFixtureReader(root);
test('Hektor preserves calibrated original coordinates and the paired spin model',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadPdsPlateShape(resolve(root,p.path),p.grid),t=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[88380.341,61101.066000000006,59425.758]);assert.deepEqual(mesh.indices[0],[0,1,2]);assert.deepEqual([t.vertices,t.faces,t.components,t.eulerCharacteristic],[1022,2040,1,2]);
 assert.ok(Math.abs(t.signedVolumeCubicMeters/1e9-2806162.602147672)<.00001);const r=await read('preparation/rotation.json');assert.equal(r.periodHours,6.920509);assert.equal(r.phase,'arbitrary-display-phase');
 assert.equal(config.raster.scientific[0].valueTransform.offset,-87.5);
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180,d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);}
});
test('Hektor keeps closed source connectivity at 800 native raster leaves',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'hektor',planetName:'Hektor',sourceRoot:root}),r=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(r.faces.length,800);assert.equal(r.simplification.sourceFaces,2040);assert.equal(r.simplification.removedOppositeFaces,0);assert.equal(r.simplification.topology.eulerCharacteristic,2);assert.ok(r.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));assert.ok(r.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*r.faces.length);
 assert.ok(r.simplification.estimatedErrorMeters<=700);
});
