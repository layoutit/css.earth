import {requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('toutatis');
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mts';
const directory=resolve(import.meta.dirname,'../../../../src/objects/toutatis'),root=resolve(directory,'source');
const read=async (path: string)=>JSON.parse(await readFile(resolve(root,path),'utf8'));

test('Toutatis source pins and original mesh can be restored through their declared acquisition operations',async()=>{
 const source=await createSourceManifest({planetId:'toutatis',planetName:'Toutatis',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');for(const input of source.manifest.inputs)assert.ok(plan.operations.some((step: { path: string; })=>step.path===input.path));
});

test('Toutatis retains the published kilometer axes, closed volume and concave neck',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadObjShape(resolve(root,p.path),p.grid);
 assert.deepEqual(mesh.positions[0],[6.636,-1.313,2447.146]);assert.deepEqual(mesh.indices[0],[5104,3176,13637]);
 const topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);assert.deepEqual([topology.vertices,topology.edges,topology.faces,topology.components,topology.eulerCharacteristic],[20000,59994,39996,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-7.681121590257912)<1e-10);
 for(const[lon,lat,radius]of [[0,90,2449.7862822961642],[0,-90,1980.9096282333576],[0,0,1160.9794404202087],[90,0,876.140196401419],[180,0,1072.3449403952625],[270,0,847.7430851125813]] as const)assert.ok(Math.abs(required(mesh.sample(lon,lat))-radius)<1e-8);
 const lon=193.3851258165014*Math.PI/180,lat=63.30780877427701*Math.PI/180,d=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],first=required(mesh.intersect([0,0,0],d)),second=required(mesh.intersect(d.map(v=>v*(first.radius+.001)),d));
 assert.ok(second.radius>70&&second.radius<80,'The neck has more than one surface on a source ray');
 const sampler=createShapeSurfaceSampler(mesh,config.raster.scientific.find((lens:{id:string})=>lens.id==='elevation'));
 const outer=required(sampler.samplePoint([-757.9932613463443,-180.37153357385466,1549.709995282336]));
 assert.equal(outer.faceId,10456);assert.ok(Math.abs(outer.value-510.55721838405475)<1e-7);
 assert.ok(Math.abs(first.radius-1224-61.60656447048087)<1e-7,'The rejected first-ray value stays distinct from the outer neck surface');
 assert.equal(sampler.samplePoint([0,0,0]),null,'Out-of-bound transfers stay missing');
});

test('Toutatis preserves connected geometry as 800 native raster triangles with a fixed illustrative orientation',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'toutatis',planetName:'Toutatis',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));assert.equal(radial.faces.length,800);assert.equal(required(radial.simplification).method,'source-meshoptimizer');assert.equal(required(radial.simplification).sourceFaces,39996);assert.equal(required(radial.simplification).removedOppositeFaces,0);assert.ok(required(radial.simplification).estimatedErrorMeters<=50);assert.equal(required(radial.simplification).topology.eulerCharacteristic,2);
 assert.ok(radial.leaves.every(leaf=>leaf.tag==='u'&&leaf.attributes['data-polycss-texture-leaf-sizing']==='raster'));assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
 const descriptor=JSON.parse((await readFile(resolve(directory,'object.json'))).toString('utf8')),ref=descriptor.properties.recipe.sources.find((s: { id: string; })=>s.id==='rotation'),a=await readAuthoredRotation(directory,ref,2461286.5),b=await readAuthoredRotation(directory,ref,2461287.5);assert.deepEqual(a,b);assert.equal(a.spinRateRadPerDay,0);
});
