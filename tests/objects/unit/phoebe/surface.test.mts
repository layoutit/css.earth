import {requireRecord} from '../../../../tools/sources/source-values.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {simplifyRadialShape} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/phoebe/source');
test('Phoebe 2023 source frame, units and retained closed shape match independent source intersections',async()=>{
 const config=JSON.parse((await readFile(resolve(root,'preparation/terrestrial.json'))).toString('utf8')),p=config.geometry.radialTerrain;
 const independent=JSON.parse((await readFile(resolve(root,'validation/2023-independent-geometry.json'))).toString('utf8'));
 const qualified=JSON.parse((await readFile(resolve(root,'validation/2023-geometry-qualification.json'))).toString('utf8'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid);
 for(const f of independent.axisRayRadiiMeters)
  assert.ok(Math.abs(required(mesh.sample(f.longitudeEastDegrees,f.latitudeDegrees))-f.radiusMeters)<.001,`${f.longitudeEastDegrees}E ${f.latitudeDegrees}N`);
 assert.ok(Math.abs(required(mesh.sample(0,0))-required(mesh.sample(360,0)))<1e-6);
 const faces=await simplifyRadialShape(mesh,p,1);assert.equal(faces.length,3500);assert.equal(requireRecord(required(faces.simplification).topology).eulerCharacteristic,2);assert.equal(requireRecord(required(faces.simplification).topology).components,1);
 assert.equal(required(faces.simplification).sourceVertices,99846);assert.equal(required(faces.simplification).sourceFaces,196608);assert.equal(required(faces.simplification).weldedVertices,98306);
 let maximum=0;
 for(const face of faces)for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]] as const){
  const point=[0,1,2].map(k=>face.vertices.reduce((s,v,i)=>s+v[k]*weights[i],0));maximum=Math.max(maximum,required(mesh.closestPoint(point)).distanceMeters);
 }
 assert.ok(maximum<=1195);assert.ok(Math.abs(maximum-qualified.acceptedTrial.independentSamples.maximumMeters)<1e-6);
});
