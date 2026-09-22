import {SHAPE_MATERIAL} from '../../../../tools/objects/terrestrial-layers/shape-material.mts';
import {preparedModelTerrain, modelConfig, modelSurfaces} from './model-fixture.mts';
import {requireObjectRotationReference} from '../radial-fixture.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ellipsoidParameterMesh } from '../../../../tools/objects/terrestrial-layers/ellipsoid-parameters.mts';
import { readAuthoredRotation } from '../../../../tools/objects/authored-rotation.mts';
const json=async (p:string):Promise<unknown>=>JSON.parse(await readFile(p,'utf8'));
const near=(a:number,b:number,t:number)=>assert.ok(Math.abs(a-b)<t,`${a} differs from ${b}`);
export function testLightcurveModel(id:string,ab:number,bc:number,radius:number,longitude:number,latitude:number) {
 test(`${id}: delivered approximation retains published proportions and closes one surface`,async()=>{
  const root=resolve('src/objects',id),model=await json(`${root}/source/shape/model.json`);
  const mesh=ellipsoidParameterMesh(model),[a,b,c]=mesh.axesMeters;
  near(a/b,ab,1e-12);near(b/c,bc,1e-12);near(Math.cbrt(a*b*c),radius*1000,1e-8);
  const config=modelConfig(await json(`${root}/source/preparation/terrestrial.json`)),terrain=preparedModelTerrain(await json(`${root}/prepared/terrain.json`));
  assert.equal(terrain.faces.length,800);
  const surfaces=modelSurfaces(await json(`${root}/prepared/surfaces.json`));
  assert.equal(surfaces.surfaces[0].missingPixels,config.raster.width*config.raster.height,'The entire nucleus has no photographic texels');
  assert.equal(surfaces.surfaces[0].appearance,SHAPE_MATERIAL.appearance);
  assert.deepEqual(config.raster.observations,[]);
  assert.equal(config.geometry.radialTerrain.sourceLighting.uniformFlood,true,'Shadows off must not bake directional shading into the grid');
  const points=new Map<string,boolean>(),edges=new Map<string,number>(),sampleErrors:number[]=[];
  const scale=config.geometry.radiusKm*1000/config.geometry.radius;
  for(const face of terrain.faces){
   const ps=face.vertices.map(v=>v.map(n=>n*scale));
   for(let i=0;i<3;i++){const p=ps[i].join(','),q=ps[(i+1)%3].join(',');points.set(p,true);const key=[p,q].sort().join(';');edges.set(key,(edges.get(key)??0)+(p<q?1:-1));}
   const samples=[...ps,ps[0].map((_,i)=>ps.reduce((s,p)=>s+p[i],0)/3),...ps.map((p,i)=>p.map((n,k)=>(n+ps[(i+1)%3][k])/2))];
   for(const p of samples){
    // Project along the local analytic gradient until the point lies on the
    // ellipsoid. Distance to this surface point bounds nearest-surface error;
    // a radial ray would overstate the error on a flattened body.
    let q=p.slice();
    for(let i=0;i<10;i++){
     const residual=q.reduce((s,n,i)=>s+(n/mesh.axesMeters[i])**2,0)-1;
     const gradient=q.map((n,i)=>2*n/mesh.axesMeters[i]**2),square=gradient.reduce((s,n)=>s+n*n,0);
     q=q.map((n,i)=>n-residual*gradient[i]/square);
    }
    near(q.reduce((s,n,i)=>s+(n/mesh.axesMeters[i])**2,0),1,1e-12);
    sampleErrors.push(Math.hypot(...q.map((n,i)=>n-p[i])));
   }
  }
  assert.ok([...edges.values()].every(n=>n===0),'Every edge has opposite incidents');assert.equal(points.size-edges.size+terrain.faces.length,2);
  assert.ok(Math.max(...sampleErrors)<150,'Sampled distance to the analytic ellipsoid stays under 150 metres');
 });
 test(`${id}: fixed nominal pole recovers the published J2000 ecliptic coordinates`,async()=>{
  const root=resolve('src/objects',id),d=await json(`${root}/object.json`),ref=requireObjectRotationReference(d);
  const a=await readAuthoredRotation(root,ref,2461286.5),b=await readAuthoredRotation(root,ref,2461316.5);assert.deepEqual(a,b);assert.equal(a.spinRateRadPerDay,0);
  const e=84381.448*Math.PI/(180*3600),x=Math.cos(a.poleDeclinationRad)*Math.cos(a.poleRightAscensionRad),y=Math.cos(a.poleDeclinationRad)*Math.sin(a.poleRightAscensionRad),z=Math.sin(a.poleDeclinationRad);
  const ey=y*Math.cos(e)+z*Math.sin(e),ez=-y*Math.sin(e)+z*Math.cos(e);
  near((Math.atan2(ey,x)*180/Math.PI+360)%360,longitude,1e-9);near(Math.asin(ez)*180/Math.PI,latitude,1e-9);
 });
}
