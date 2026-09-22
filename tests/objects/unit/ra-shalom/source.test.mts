import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape,createShapeSurfaceSampler} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {requireAcquisitionPlan,requireClosedRadialTerrain,requireHistoricalContent,requireRadialTestConfig,requireScalarAnchors} from '../radial-fixture.mts';
import {requireFiniteNumber,requireRecord,requireString} from '../../../../tools/sources/source-values.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/ra-shalom/source');
const read=async (path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(root,path),'utf8'));
test('Ra-Shalom retains original source pins and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'ra-shalom',planetName:'Ra-Shalom',sourceRoot:root});await source.verify();
 const plan=requireAcquisitionPlan(await read('preparation/acquisition.json'));
 for(const input of source.manifest.inputs)assert.ok(plan.operations.some(step=>step.path===input.path));
});
test('Ra-Shalom preserves the original kilometer mesh and published spin interpretation',async()=>{
 const {config,terrain:p,lens}=requireRadialTestConfig(await read('preparation/terrestrial.json'));
 const mesh=await loadObjShape(resolve(root,p.path),p.grid),topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual(mesh.positions[0],[0,0,892.5110000000001]);
 assert.deepEqual(mesh.indices[0],[0,1,2]);
 assert.deepEqual([topology.vertices,topology.faces,topology.components,topology.eulerCharacteristic],[1148,2292,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-6.203733938477497)<.00001);
 const rotation=requireRecord(await read('preparation/rotation.json'));assert.equal(requireFiniteNumber(rotation.periodHours,'Ra-Shalom rotation period'),19.793);assert.equal(requireString(rotation.phase,'Ra-Shalom rotation phase'),'arbitrary-display-phase');
 assert.equal(config.geometry.radiusKm,1.15);assert.equal(lens.valueTransform.offset,-1.15);
 const anchors=requireScalarAnchors(await read('reference/scalar-anchors.json')),sample=createShapeSurfaceSampler(mesh,lens);
 for(const check of anchors){const actual=sample.samplePoint(check.query);
  if(!check.accepted){assert.equal(actual,null);continue;}assert.ok(actual);
  assert.ok(Math.abs(actual.value-check.value)<1e-8);assert.ok(Math.abs(actual.distanceMeters-check.distanceMeters)<1e-6);
  actual.point.forEach((v,i)=>assert.ok(Math.abs(v-check.point[i])<1e-6));
 }

});
test('Ra-Shalom keeps a closed source-connected mesh within the retained raster budget',async()=>{
 const {config}=requireRadialTestConfig(await read('preparation/terrestrial.json')),source=await createSourceManifest({planetId:'ra-shalom',planetName:'Ra-Shalom',sourceRoot:root});
 const radial=requireClosedRadialTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.sourceFaces,2292);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.equal(radial.simplification.topology.eulerCharacteristic,2);assert.ok(radial.simplification.estimatedErrorMeters<=24);
 assert.ok(radial.leaves.every(l=>l.tag==='u'&&l.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});

test('Ra-Shalom qualifies the historical model and starts with Shadows off',async()=>{
 const content=requireHistoricalContent(await read('content/object.json'));
 const shadows=content.settings.controls.find(c=>c.name==='shadows'),distance=content.panel.facts.find(f=>f.id==='distance-from-sun');assert.ok(shadows);assert.ok(distance);
 assert.equal(shadows.checked,false);
 assert.equal(distance.label,'Solar semimajor axis');
 const summaries=Object.values(requireRecord(requireRecord(await read('../text.json')).datasets)).map(dataset=>requireString(requireRecord(dataset).summary)).join(' ');
 assert.match(summaries,/later/i);assert.match(summaries,/arbitrary spin phase/);
 assert.ok(!JSON.stringify(content).includes('49 km'));
});
