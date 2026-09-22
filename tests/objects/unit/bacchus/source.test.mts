import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('bacchus');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireProjectionAnchors,requireRadialTestConfig,requireRotation} from '../radial-fixture.mts';
import {requireArray,requireRecord,requireString} from '../../../../tools/sources/source-values.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/bacchus/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Bacchus preserves the original kilometer mesh and published spin interpretation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,203.03]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[256,508,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-0.1312520820552817)<.00001);
 const rotation=requireRotation(await read('preparation/rotation.json'),['periodHours','phase']);assert.equal(rotation.periodHours,15);assert.equal(rotation.phase,'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,0.315);assert.equal(lens.valueTransform.offset,-0.315);

});
test('Bacchus keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'bacchus',planetName:'Bacchus',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,508);assert.equal(radial.simplification.sourceFaces,508);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=1);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});

test('Bacchus radius colors match independent full-source projections',async()=>{
 const {terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json')),mesh=await loadObjShape(resolve(root,p.path),p.grid),sample=createShapeSurfaceSampler(mesh,lens);
 const anchors=requireProjectionAnchors(JSON.parse(await readFile(new URL('./scalar-anchors.json',import.meta.url),'utf8')));
 const sampling=requireRecord(lens.surfaceSampling,'Bacchus surface sampling');assert.equal(requireString(sampling.method,'Bacchus surface sampling method'),'closest-source-point');
 for(const check of anchors.checks){const value=sample.samplePoint(check.query);if(!check.withinTransferLimit){assert.equal(value,null);continue;}assert.ok(value,check.kind);assert.ok(Math.abs(value.value-check.expectedValue)<1e-9,check.kind);assert.ok(Math.abs(value.radius-check.expectedRadiusMeters)<1e-6,check.kind);assert.ok(value.point.every((n,i)=>Math.abs(n-check.point[i])<1e-6),check.kind);}

});
