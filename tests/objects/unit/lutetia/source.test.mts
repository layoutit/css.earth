import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadVrmlShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/lutetia/source');
const read=createSourceFixtureReader(root);

test('Lutetia preserves its source pins and each runtime preparation input has a restoration operation',async()=>{
 const source=await createSourceManifest({planetId:'lutetia',planetName:'Lutetia',sourceRoot:root});await source.verify();
 const plan=await read('preparation/acquisition.json');
 for(const input of source.manifest.inputs)if(!['preparation/camera.json','observations/osiris-camera.json',
   'preparation/n20100710t154135529id4df22-camera.json','observations/n20100710t154135529id4df22-camera.json',
   'preparation/n20100710t154241240id4df22-camera.json','observations/n20100710t154241240id4df22-camera.json',
   // Surface places are project-authored and committed, so they have nothing to restore.
   'features/manifest.json','preparation/features.json','presentation/surface-map.json'].includes(input.path))assert.ok(plan.operations.some(step=>step.path===input.path),`Missing acquisition path for ${input.path}`);
});

test('Lutetia source axes, original indexed vertices and closed volume retain the released kilometer frame',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadVrmlShape(resolve(root,p.path),p.grid);
 for(const[i,v]of[-27784.472,29233.772,24435.734].entries())assert.ok(Math.abs(mesh.positions[0][i]-v)<1e-8);
 assert.deepEqual(mesh.indices[0],[79,81,0]);
 assert.deepEqual(mesh.bounds,[[-53099.48,-57367.287,-38279.991],[58525.684,63444.828,46437.126]]);
 const topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual([topology.vertices,topology.edges,topology.faces,topology.components,topology.eulerCharacteristic],[12265,36789,24526,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-498512.4896722754)<1e-6);
 const scalar=await loadScienceSurface(root,config.raster.scientific[0]);
 for(const[lon,lat,radius]of [[0,90,40543.383371951684],[0,-90,34177.16704935483],[0,0,52977.964785500444],[90,0,57848.821625701145],[180,0,49596.66693322307],[270,0,51349.55685780635]] as const)assert.ok(Math.abs(required(scalar.sample(lon,lat))-(radius/1000-49))<1e-8);
 assert.equal(scalar.sample(0,91),null);
});

test('Lutetia simplifies source connectivity into a closed native raster mesh within the authored budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'lutetia',planetName:'Lutetia',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.method,'source-meshoptimizer');
 assert.equal(radial.simplification.sourceFaces,24526);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.ok(radial.simplification.estimatedErrorMeters<=1200);assert.equal(radial.simplification.topology.eulerCharacteristic,2);
 assert.ok(radial.leaves.every(leaf=>leaf.tag==='u'&&leaf.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
