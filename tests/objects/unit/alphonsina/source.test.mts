import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadPdsPlateShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/alphonsina/source'),read=createSourceFixtureReader(root);
test('Alphonsina preserves calibrated original coordinates and the paired spin model',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadPdsPlateShape(resolve(root,p.path),p.grid),t=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[4930.254,-2561.543,24049.759000000002]);assert.deepEqual(mesh.indices[0],[0,1,2]);assert.deepEqual([t.vertices,t.faces,t.components,t.eulerCharacteristic],[1020,2036,1,2]);
 assert.ok(Math.abs(t.signedVolumeCubicMeters/1e9-102160.40500136057)<.00001);const r=await read('preparation/rotation.json');assert.equal(r.periodHours,7.87754);assert.equal(r.phase,'arbitrary-display-phase');
 assert.equal(config.raster.scientific[0].valueTransform.offset,-29);
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180,d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);}
});
test('Alphonsina keeps closed source connectivity at 800 native raster leaves',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'alphonsina',planetName:'Alphonsina',sourceRoot:root}),r=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(r.faces.length,800);assert.equal(r.simplification.sourceFaces,2036);assert.equal(r.simplification.removedOppositeFaces,0);assert.equal(r.simplification.topology.eulerCharacteristic,2);assert.ok(r.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));assert.ok(r.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*r.faces.length);
 assert.ok(r.simplification.estimatedErrorMeters<=200);
});
