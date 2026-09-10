import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ellipsoidParameterMesh} from '../../../../tools/objects/terrestrial-layers/ellipsoid-parameters.mts';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mts';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
export function testRadarApproximation(id,semiaxesMeters){
 test(`${id}: published absolute axes produce a closed 800-triangle approximation`,async()=>{
  const root=resolve('src/planets',id),source=await read(`${root}/source/shape/model.json`),mesh=ellipsoidParameterMesh(source);
  mesh.axesMeters.forEach((v,i)=>assert.ok(Math.abs(v-semiaxesMeters[i])<1e-8));
  const terrain=await read(`${root}/prepared/terrain.json`),config=await read(`${root}/source/preparation/terrestrial.json`);
  assert.equal(terrain.faces.length,800);
  const scale=config.geometry.radiusKm*1000/config.geometry.radius,vertices=new Set(),edges=new Map();
  const errors=[];
  for(const f of terrain.faces){
   const ps=f.vertices.map(p=>p.map(v=>v*scale));
   for(let i=0;i<3;i++){
    const a=ps[i].join(','),b=ps[(i+1)%3].join(','),key=[a,b].sort().join(';');vertices.add(a);
    const edge=edges.get(key)??{incidents:0,winding:0};edge.incidents++;edge.winding+=a<b?1:-1;edges.set(key,edge);
   }
   const samples=[...ps,ps[0].map((_,i)=>ps.reduce((s,p)=>s+p[i],0)/3),...ps.map((p,i)=>p.map((n,k)=>(n+ps[(i+1)%3][k])/2))];
   for(const p of samples){let q=p.slice();for(let i=0;i<12;i++){
    const f=q.reduce((s,n,j)=>s+(n/semiaxesMeters[j])**2,0)-1,g=q.map((n,j)=>2*n/semiaxesMeters[j]**2),gg=g.reduce((s,n)=>s+n*n,0);q=q.map((n,j)=>n-f*g[j]/gg);
   }
   assert.ok(Math.abs(q.reduce((s,n,j)=>s+(n/semiaxesMeters[j])**2,0)-1)<1e-12);
   errors.push(Math.hypot(...q.map((n,j)=>n-p[j])));
   }
  }
  assert.ok([...edges.values()].every(e=>e.incidents===2&&e.winding===0));assert.equal(vertices.size-edges.size+800,2);
  assert.ok(Math.max(...errors)<100,'Sampled analytic-surface distance is below 100 m; this is not a source uncertainty.');
 });
 test(`${id}: no-imagery grid covers the whole nucleus without default directional shading`,async()=>{
  const root=resolve('src/planets',id),config=await read(`${root}/source/preparation/terrestrial.json`),surfaces=await read(`${root}/prepared/surfaces.json`),controls=await read(`${root}/source/content/object.json`);
  assert.equal(surfaces.surfaces.length,1);const s=surfaces.surfaces[0];assert.equal(s.missingPixels,config.raster.width*config.raster.height);assert.match(s.appearance,/no-imagery grid/);assert.equal(s.layout.faceCount,800);assert.equal(s.layout.tileSize,64);
  assert.equal(config.geometry.radialTerrain.sourceLighting.uniformFlood,true);
  assert.deepEqual(config.raster.observations,[]);assert.equal(controls.settings.controls.find(c=>c.name==='shadows').checked,false);
 });
 test(`${id}: scene attitude stays illustrative instead of inventing rotational phase`,async()=>{
  const root=resolve('src/planets',id),d=await read(`${root}/object.json`),ref=d.properties.recipe.sources.find(r=>r.id==='rotation');
  const a=await readAuthoredRotation(root,ref,2461286.5),b=await readAuthoredRotation(root,ref,2462286.5);assert.deepEqual(a,b);assert.equal(a.spinRateRadPerDay,0);
 });
}
