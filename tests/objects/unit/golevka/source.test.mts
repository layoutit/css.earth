import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/golevka/source');
const read=createSourceFixtureReader(root);
test('Golevka preserves the original kilometer mesh and published spin interpretation',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain;
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,215.195]);
 assert.deepEqual(mesh.indices[0],[614,469,745]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[2048,4092,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.07794652698335355)<.00001);
 const rotation=await read('preparation/rotation.json');assert.equal(rotation.periodHours,6.0289);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.265);assert.equal(config.raster.scientific[0].valueTransform.offset,-0.265);
 // A second radial intersection would make one scalar height ambiguous.
 for(let i=0;i<2048;i++){const z=1-2*(i+.5)/2048,phi=i*137.50776405003785*Math.PI/180;
  const d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],hit=mesh.intersect([0,0,0],d);
  assert.ok(hit);assert.equal(mesh.intersect(d.map(v=>v*(hit.radius+.001)),d),null);
 }
});
test('Golevka keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'golevka',planetName:'Golevka',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,4092);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=10);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});

test('Golevka binds elevation to known source coordinates and its reference sphere',async()=>{
 const config=await read('preparation/terrestrial.json'),lens=config.raster.scientific[0];
 const mesh=await loadObjShape(resolve(root,lens.path),lens.grid),sample=createShapeSurfaceSampler(mesh,lens).samplePoint(mesh.positions[0]);
 assert.ok(sample);assert.ok(Math.abs(sample.value-(-0.049805000000000016))<1e-9);
 assert.ok(sample.distanceMeters<1e-9);
 assert.ok(Math.abs(Math.max(...mesh.positions.map(p=>p[1]))-Math.min(...mesh.positions.map(p=>p[1]))-685.157)<1e-6);
});
