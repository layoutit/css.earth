import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('didymos');
import {createSourceFixtureReader,requireClosedTerrain} from '../../fixtures/source-fixture.mts';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {loadRadialTerrain,validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=resolve(import.meta.dirname,'../../../../src/objects/didymos/source');
const read=createSourceFixtureReader(root);

test('Didymos direct source frame retains the released axes, kilometer scale and closed volume',async()=>{
 const config=await read('preparation/terrestrial.json'),p=config.geometry.radialTerrain,mesh=await loadObjShape(resolve(root,p.path),p.grid);
 // Independent anchors printed in the released OBJ header.
 const expected=[[-387.43001222610474,-361.11000180244446,-337.92999386787415],[430.81000447273254,440.3400123119354,266.5500044822693]];
 for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(mesh.bounds[side][axis]-expected[side][axis])<1e-8);
 const topology=validateClosedMesh(mesh.indices.flat(),mesh.positions);
 assert.deepEqual([topology.vertices,topology.edges,topology.faces,topology.components,topology.eulerCharacteristic],[24578,73728,49152,1,2]);
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/1e9-.2033564365122846)<1e-10);
 const scalar=await loadScienceSurface(root,config.raster.scientific[0]);
 for(const [lon,lat]of [[0,90],[0,-90],[0,0],[90,0],[180,0],[270,0]] as const)assert.ok(Math.abs(required(scalar.sample(lon,lat))-(required(mesh.sample(lon,lat))-365))<1e-8);
 assert.equal(scalar.sample(0,91),null);
});

test('Didymos native raster surface preserves closed source connectivity within its simplification budget',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await createSourceManifest({planetId:'didymos',planetName:'Didymos',sourceRoot:root});
 const radial=requireClosedTerrain(await loadRadialTerrain({config,sourceDirectory:root,source}));
 assert.equal(radial.faces.length,800);assert.equal(radial.simplification.method,'source-meshoptimizer');
 assert.equal(radial.simplification.sourceFaces,49152);assert.equal(radial.simplification.removedOppositeFaces,0);
 assert.ok(radial.simplification.estimatedErrorMeters<=8);assert.equal(radial.simplification.topology.eulerCharacteristic,2);
 assert.ok(radial.leaves.every(leaf=>leaf.tag==='u'&&leaf.attributes['data-polycss-texture-leaf-sizing']==='raster'));
 assert.ok(radial.plans.reduce((sum,p)=>sum+p.rect.width*p.rect.height,0)<=16384*radial.faces.length);
});
