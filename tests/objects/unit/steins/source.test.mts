import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {loadVrmlShape,parseObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {prepareByteObservation} from '../../../../tools/objects/terrestrial-layers/observed-image.mts';
const directory='src/objects/steins/source',read=async (p: string)=>JSON.parse(await readFile(`${directory}/${p}`,'utf8'));

test('Steins source mesh preserves released kilometer coordinates and independent principal rays',async()=>{
 const c=await read('preparation/terrestrial.json'),mesh=await loadVrmlShape(`${directory}/shape/steins_cart.wrl`,c.geometry.radialTerrain.grid);
 assert.equal(mesh.vertices,10242);assert.equal(mesh.faces,20480);
 // First XYZ row is independently specified by the pinned PDS vertex table.
 for(const [i,v]of [741.47618,910.40307,1945.98230].entries())assert.ok(Math.abs(mesh.positions[0][i]-v)<1e-8);
 for(const [lon,lat,r]of [[0,0,3165.583232014827],[90,0,2905.4732933897985],[180,0,3574.3718085389255],[270,0,2626.214531407711],[0,90,2155.1841971449626],[0,-90,1958.590202996904]] as const)assert.ok(Math.abs(required(mesh.sample(lon,lat))-r)<1e-6);
});

test('Steins cylindrical map retains eastward geography, dark crater pixels and connected coverage',async()=>{
 const c=await read('preparation/terrestrial.json'),manifest=await read('manifest.json'),entry=manifest.inputs.find((x: { id: string; })=>x.id==='steins-normal');
 const map=await prepareByteObservation(`${directory}/${entry.path}`,entry,c.raster.observations[0].validity,3600,1800);
 // Published x1800 is longitude0; source x1350 is315E. Row order is north-first.
 for(const[x,y,v]of [[0,900,203],[3150,600,20],[400,1000,174]] as const){const i=y*3600+x;assert.deepEqual([...map.rgb.subarray(i*3,i*3+3)],[v,v,v]);assert.equal(map.missing[i],0)}
 assert.equal(map.missing[500*3600+2700],1,'Black western exterior is a gap');
 assert.equal(map.missing[512*3600+875],0,'Isolated exact-black observed crater pixel must survive');
 assert.deepEqual([...map.rgb.subarray((512*3600+875)*3,(512*3600+875)*3+3)],[0,0,0]);
 assert.ok("sourceMissingPixels" in map);assert.equal(map.sourceMissingPixels,3567208);
});

test('Steins rotation uses the revised PCK model that matches the released pole',async()=>{
 const r=await read('preparation/rotation.json'),pck=await readFile(`${directory}/reference/pck00011.tpc`,'utf8');
 const values=(key: string)=>required(pck.match(new RegExp(`BODY2002867_${key}\\s*=\\s*\\(\\s*([-\\d.]+)\\s+([-\\d.]+)`))).slice(1).map(Number);
 assert.equal(r.rightAscensionDegrees,values('POLE_RA')[0]);assert.equal(r.declinationDegrees,values('POLE_DEC')[0]);assert.equal(r.primeMeridianDegrees,values('PM')[0]);assert.equal(r.spinDegreesPerDay,values('PM')[1]);
});

test('Steins reduced mesh retains bounded source fit over independent equal-area rays',async()=>{
 const c=await read('preparation/terrestrial.json'),source=await loadVrmlShape(`${directory}/shape/steins_cart.wrl`,c.geometry.radialTerrain.grid);
 const {faces}=JSON.parse(await readFile('src/objects/steins/prepared/terrain.json','utf8')),scale=2580/c.geometry.radius;
 const text=faces.flatMap((f: { vertices: number[][]; })=>f.vertices.map((v: number[])=>'v '+v.map((n: number)=>n*scale).join(' '))).join('\n')+'\n'+faces.map((_:unknown,i: number)=>`f ${i*3+1} ${i*3+2} ${i*3+3}`).join('\n');
 const mesh=parseObjShape(text,{metersPerUnit:1,expectedVertices:faces.length*3,expectedFaces:faces.length}),errors=[];
 for(let y=0;y<40;y++)for(let x=0;x<80;x++){const lon=(x+.37)/80*360,lat=Math.asin(-1+2*(y+.5)/40)*180/Math.PI,a=required(source.sample(lon,lat)),b=required(mesh.sample(lon,lat));assert.notEqual(b,null);errors.push(Math.abs(a-b));}
 errors.sort((a,b)=>a-b);assert.ok(errors[3040]<35);assert.ok(required(errors.at(-1))<65);
});
