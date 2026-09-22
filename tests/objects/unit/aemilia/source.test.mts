import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {loadObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const directory=resolve(import.meta.dirname,'../../../../src/objects/aemilia'),sourceRoot=resolve(directory,'source');
const read=async (path: string)=>JSON.parse(await readFile(resolve(directory,path),'utf8'));
const cross=(a: number[],b: number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a: number[],b: number[])=>a.reduce((sum: number,v: number,i: number)=>sum+v*b[i],0),sub=(a: number[],b: number[])=>a.map((v: number,i: number)=>v-b[i]);
const near=(a: number,b: number)=>assert.ok(Math.abs(a-b)<=Math.max(1e-12,Math.abs(b)*1e-10),`${a} versus ${b}`);
// Literal publisher-byte anchors were calculated independently during intake.
const expected={sha256:'4d412ad36155b974bdc0d1d676d426449c60f883b18f64a7ee609bdc753d08c9',bytes:239882,vertices:3842,faces:7680,edges:11520,firstVertex:[-1.011548,0.009636,1.272103],firstFace:[0,1,2],volume:19.225830895673912,pole:[138.85848,65.93886],periodHours:24.478724};
async function original(){
 const bytes=await readFile(resolve(sourceRoot,'shape/isam-sage-102.obj'));
 assert.equal(bytes.length,expected.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
 const vertices:number[][]=[],faces:number[][]=[],header:Record<string,string>={};
 for(const line of bytes.toString('utf8').split(/\r?\n/)){
  if(line.startsWith('#')&&line.includes(':')){const i=line.indexOf(':');header[line.slice(1,i)]=line.slice(i+1).trim();}
  if(line.startsWith('v '))vertices.push(line.trim().split(/\s+/).slice(1).map(Number));
  if(line.startsWith('f '))faces.push(line.trim().split(/\s+/).slice(1).map(v=>Number(v)-1));
 }
 assert.deepEqual([vertices.length,faces.length],[expected.vertices,expected.faces]);
 assert.deepEqual(vertices[0],expected.firstVertex);assert.deepEqual(faces[0],expected.firstFace);
 assert.equal(header.target,'159');assert.equal(header.method,'SAGE');
 assert.deepEqual([Number(header.lambda),Number(header.beta)],expected.pole);assert.equal(Number(header['period[h]']),expected.periodHours);
 return{vertices,faces};
}
test('Aemilia source preserves original ISAM OBJ identity and acquisition closure',async()=>{
 const source=await createSourceManifest({planetId:'aemilia',planetName:'Aemilia',sourceRoot});await source.verify();
 const plan=await read('source/preparation/acquisition.json');for(const i of source.manifest.inputs)assert.ok(plan.operations.some((s: { path: string; })=>s.path===i.path),i.path);
 const input=required(source.manifest.inputs.find(i=>i.path==='shape/isam-sage-102.obj'));
 assert.equal(input.origin,'http://isam.astro.amu.edu.pl/model.php?nr_planet=159&nr_modelu=102');assert.ok(plan.operations.some((s: { path: string; kind: string; url: string; })=>s.path===input.path&&s.kind==='download'&&s.url===input.origin));
 const model=await read('source/reference/isam-model.json');assert.equal(model.sourceArchive,'ISAM');assert.equal(model.modelId,102);assert.equal(model.nonconvex,true);assert.equal(model.sourceFormat,'wavefront-obj');await original();
});
test('Aemilia scale matches independent OBJ volume and published SAGE pole',async()=>{
 const{vertices,faces}=await original(),edges=new Map<string,number[]>(),adjacent=Array.from({length:vertices.length},()=>new Set<number>());let volume=0,divergence=0;
 for(const f of faces){
  assert.equal(new Set(f).size,3);assert.ok(f.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length));
  const[a,b,c]=f.map(i=>vertices[i]);assert.ok([a,b,c].every(v=>v.length===3&&v.every(Number.isFinite)));
  const n=cross(sub(b,a),sub(c,a));assert.ok(Math.hypot(...n)>0);volume+=dot(a,cross(b,c))/6;divergence+=dot(a.map((v,i)=>(v+b[i]+c[i])/3),n)/6;
  for(let i=0;i<3;i++){const x=f[i],y=f[(i+1)%3],key=x<y?`${x}:${y}`:`${y}:${x}`,values=edges.get(key)??[];values.push(x<y?1:-1);edges.set(key,values);adjacent[x].add(y);adjacent[y].add(x);}
 }
 near(volume,expected.volume);near(divergence,expected.volume);assert.equal(edges.size,expected.edges);assert.ok([...edges.values()].every(v=>v.length===2&&v[0]+v[1]===0));assert.equal(vertices.length-edges.size+faces.length,2);
 const seen=new Set([0]),pending=[0];while(pending.length)for(const n of adjacent[required(pending.pop())])if(!seen.has(n)){seen.add(n);pending.push(n);}assert.equal(seen.size,vertices.length);
 const[config,calibration,properties,rotation]=await Promise.all(['source/preparation/terrestrial.json','source/reference/calibration.json','source/reference/model-properties.json','source/preparation/rotation.json'].map(read));
 const p=config.geometry.radialTerrain;assert.equal(p.format,'wavefront-obj');assert.equal(p.path,'shape/isam-sage-102.obj');assert.equal(p.simplification.method,'source-meshoptimizer');assert.equal(p.simplification.targetFaces,800);
 assert.equal(calibration.diameterKm,135);assert.equal(calibration.uncertaintyKm,7);assert.equal(calibration.method,'published-volume-equivalent-size-transfer');near(Math.cbrt(6*volume/Math.PI)*p.grid.metersPerUnit/1000,135);near(config.geometry.radiusKm,67.5);near(calibration.metersPerSourceUnit,p.grid.metersPerUnit);near(properties.shape.volumeCubicKm,volume*(p.grid.metersPerUnit/1000)**3);
 const mesh=await loadObjShape(resolve(sourceRoot,p.path),p.grid);assert.deepEqual(mesh.indices[0],expected.firstFace);mesh.positions[0].forEach((v,i)=>near(v,expected.firstVertex[i]*p.grid.metersPerUnit));
 assert.deepEqual(properties.poleEclipticJ2000Degrees,expected.pole);assert.equal(rotation.periodHours,expected.periodHours);assert.equal(rotation.phase,'arbitrary-display-phase');
 const[l,b,o]=[...expected.pole,23.439291111].map(v=>v*Math.PI/180),eq=[Math.cos(b)*Math.cos(l),Math.cos(b)*Math.sin(l)*Math.cos(o)-Math.sin(b)*Math.sin(o),Math.cos(b)*Math.sin(l)*Math.sin(o)+Math.sin(b)*Math.cos(o)];near(rotation.rightAscensionDegrees,Math.atan2(eq[1],eq[0])*180/Math.PI);near(rotation.declinationDegrees,Math.asin(eq[2])*180/Math.PI);
 const s=config.raster.scientific.find((s: { id: string; })=>s.id==='elevation');assert.equal(s.format,p.format);assert.equal(s.path,p.path);assert.deepEqual(s.grid,p.grid);assert.deepEqual(s.valueTransform,{scale:.001,offset:-67.5});assert.equal(s.relief.referenceRadiusMeters,67500);assert.equal(s.surfaceSampling.method,'closest-source-point');
});
test('Aemilia prepared output retains closed native raster triangles from original OBJ',async()=>{
 const[terrain,scene,config]=await Promise.all(['prepared/terrain.json','prepared/scene.json','source/preparation/terrestrial.json'].map(read));assert.deepEqual(terrain.source.grid,config.geometry.radialTerrain.grid);assert.equal(terrain.source.path,'shape/isam-sage-102.obj');
 assert.equal(terrain.simplification.method,'source-meshoptimizer');assert.equal(terrain.simplification.sourceFaces,7680);assert.ok(terrain.faces.length>0&&terrain.faces.length<=800);assert.equal(scene.bodyLeaves.length,terrain.faces.length);assert.ok(terrain.simplification.estimatedErrorMeters<=1350);
 const positions:number[][]=[],indices:number[]=[],lookup=new Map<string,number>();for(const[i,f]of terrain.faces.entries()){
  const leaf=scene.bodyLeaves[i];assert.equal(leaf.tag,'u');assert.equal(leaf.attributes['data-polycss-texture-leaf-sizing'],'raster');assert.ok(leaf.style.includes('--polycss-atlas-width:128px'));
  for(const v of f.vertices){const key=v.join(',');if(!lookup.has(key)){lookup.set(key,positions.length);positions.push(v);}indices.push(required(lookup.get(key)));}
 }
 const topology=validateClosedMesh(indices,positions);assert.equal(topology.components,1);assert.equal(topology.eulerCharacteristic,2);
 const p=config.geometry.radialTerrain,mesh=await loadObjShape(resolve(sourceRoot,p.path),p.grid),scale=config.geometry.radiusKm*1000/config.geometry.radius;
 const bound=config.raster.scientific.find((s: { id: string; })=>s.id==='elevation').surfaceSampling.maximumDistanceMeters;
 for(const[i,f]of terrain.faces.entries()){
  const centroid=[0,1,2].map(axis=>f.vertices.reduce((sum:number,v:number[])=>sum+v[axis],0)*scale/3);
  assert.ok(mesh.closestPoint(centroid,bound),`Retained face ${i} has no source correspondence within ${bound} m`);
 }
});
