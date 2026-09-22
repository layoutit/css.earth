import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('gaspra');
import {readFile} from 'node:fs/promises';
import {loadPdsRadialTable} from '../../../../tools/objects/terrestrial-layers/pds-radial-table.mts';
import {prepareFitsObservation} from '../../../../tools/objects/terrestrial-layers/observed-fits.mts';
import {parseObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {evaluateRegistration} from './registration.mts';
const directory='src/objects/gaspra/source',read=async (path: string)=>JSON.parse(await readFile(`${directory}/${path}`,'utf8'));

test('Gaspra radial model keeps independent west-longitude source anchors',async()=>{
 const config=await read('preparation/terrestrial.json'),grid=await loadPdsRadialTable(`${directory}/shape/951gaspra.tab`,config.geometry.radialTerrain.grid);
 for(const[lon,lat,radius]of [[0,0,10564.5],[90,0,5679.4],[180,0,7628.6],[270,0,4959.2],[0,90,4463.6],[0,-90,4466.7]] as const)assert.ok(Math.abs(required(grid.sample(lon,lat))-radius)<1e-8);
 assert.equal(grid.width,181);assert.equal(grid.height,91);
 assert.equal(Math.min(...grid.values),4.1442);assert.equal(Math.max(...grid.values),10.7966);
});

test('Gaspra monochrome registration preserves source samples and zero coverage',async()=>{
 const config=await read('preparation/terrestrial.json'),manifest=await read('manifest.json'),entry=manifest.inputs.find((e: { id: string; })=>e.id==='gaspra-normal'),policy=config.raster.observations[0].validity;
 const map=await prepareFitsObservation(`${directory}/${entry.path}`,entry,policy,720,360);
 // Raw source(250,100) maps to longitude305.25E,latitude39.75N.
 assert.deepEqual([...map.rgb.subarray((100*720+610)*3,(100*720+610)*3+3)],[70,70,70]);
 assert.equal(map.missing[100*720+610],0);
 assert.equal(map.missing[300*720+40],1);
 // A zero in the neighboring source row rejects the whole interpolation footprint.
 assert.equal(map.missing[180*720],1);
 assert.equal(map.sourceMissingPixels,167449);
});

test('Gaspra observation geometry rejects the misleading generic FITS display orientation',async()=>{
 const report=await evaluateRegistration(),accepted=required(report.candidates.find(c=>c.rows==='north-to-south'&&c.samplesIncrease==='east')),literal=required(report.candidates.find(c=>c.rows==='south-to-north'&&c.samplesIncrease==='west'));
 assert.equal(accepted.valid,22330);assert.ok(accepted.visibleFraction>.99);assert.ok(accepted.bothFraction>.94);assert.ok(literal.bothFraction<.01);
 const pinned=await read('reference/registration.json');assert.deepEqual(report.candidates,pinned.candidates);
});

test('Gaspra rotation binds the pinned NAIF pole and spin',async()=>{
 const rotation=await read('preparation/rotation.json'),pck=await readFile(`${directory}/reference/pck00011.tpc`,'utf8');
 const value=(key: string)=>required(pck.match(new RegExp(`BODY9511010_${key}\\s*=\\s*\\(\\s*([\\d.]+)\\s+([\\d.]+)`))).slice(1).map(Number);
 assert.equal(rotation.rightAscensionDegrees,value('POLE_RA')[0]);assert.equal(rotation.declinationDegrees,value('POLE_DEC')[0]);
 assert.equal(rotation.primeMeridianDegrees,value('PM')[0]);assert.equal(rotation.spinDegreesPerDay,value('PM')[1]);
});


test('Gaspra prepared silhouette keeps bounded sampled error against the source radii',async()=>{
 const config=await read('preparation/terrestrial.json'),source=await loadPdsRadialTable(`${directory}/shape/951gaspra.tab`,config.geometry.radialTerrain.grid);
 const {faces}=JSON.parse(await readFile('src/objects/gaspra/prepared/terrain.json','utf8')),metersPerUnit=6100/config.geometry.radius;
 const text=faces.flatMap((f: { vertices: number[][]; })=>f.vertices.map((v: number[])=>'v '+v.map((n: number)=>n*metersPerUnit).join(' '))).join('\n')+'\n'+faces.map((_:unknown,i: number)=>`f ${i*3+1} ${i*3+2} ${i*3+3}`).join('\n');
 const reduced=parseObjShape(text,{metersPerUnit:1,expectedVertices:faces.length*3,expectedFaces:faces.length}),errors=[];
 for(let y=0;y<40;y++)for(let x=0;x<80;x++){
  const lon=(x+.37)/80*360,lat=Math.asin(-1+2*(y+.5)/40)*180/Math.PI,a=required(source.sample(lon,lat)),b=required(reduced.sample(lon,lat));
  assert.notEqual(b,null,'Every source ray must still intersect the reduced surface');errors.push(Math.abs(a-b));
 }
 errors.sort((a,b)=>a-b);assert.ok(errors[3040]<100);assert.ok(required(errors.at(-1))<250);
});
