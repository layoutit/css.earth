import {SHAPE_MATERIAL} from '../../../../tools/objects/terrestrial-layers/shape-material.mts';
import {preparedModelTerrain, modelConfig, modelSurfaces, modelSettings} from './model-fixture.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../../src/platform/source-manifest.mts';
import {ellipsoidParameterMesh} from '../../../../tools/objects/terrestrial-layers/ellipsoid-parameters.mts';
import {readAuthoredRotation} from '../../../../tools/objects/authored-rotation.mts';
import {requireObjectRotationReference} from '../radial-fixture.mts';
const json=async (p:string):Promise<unknown>=>JSON.parse(await readFile(p,'utf8'));
const near=(a:number,b:number,t:number)=>assert.ok(Math.abs(a-b)<t,`${a} differs from ${b}`);
const astronomyRadius=async (id:string)=>{
 const body=await json(resolve('packages/astronomy/data/bodies',`${id}.json`));
 assert.ok(body&&typeof body==='object'&&'physical' in body&&body.physical&&typeof body.physical==='object'&&'meanRadiusKm' in body.physical);
 assert.equal(typeof body.physical.meanRadiusKm,'number');return Number(body.physical.meanRadiusKm);
};

/** A published effective nucleus radius and lightcurve elongation, drawn as a volume-equivalent ellipsoid. */
export function testRadiusNucleus(id:string,radiusKm:number,axisRatioAB:number){
 test(`${id}: published radius and elongation produce one closed 800-triangle ellipsoid`,async()=>{
  const root=resolve('src/objects',id),mesh=ellipsoidParameterMesh(await json(`${root}/source/shape/model.json`)),[a,b,c]=mesh.axesMeters;
  near(Math.cbrt(a*b*c),radiusKm*1000,1e-8);near(a/b,axisRatioAB,1e-12);near(b/c,1,1e-12);
  const config=modelConfig(await json(`${root}/source/preparation/terrestrial.json`)),terrain=preparedModelTerrain(await json(`${root}/prepared/terrain.json`));
  assert.equal(config.geometry.radiusKm,radiusKm);assert.equal(await astronomyRadius(id),radiusKm);
  assert.equal(terrain.faces.length,800);
  const scale=config.geometry.radiusKm*1000/config.geometry.radius,points=new Set<string>(),edges=new Map<string,number>();let volume=0;
  for(const face of terrain.faces){
   const ps=face.vertices.map(v=>v.map(n=>n*scale));
   for(let i=0;i<3;i++){const p=ps[i].join(','),q=ps[(i+1)%3].join(',');points.add(p);const key=[p,q].sort().join(';');edges.set(key,(edges.get(key)??0)+(p<q?1:-1));}
   const [u,v,w]=ps;volume+=(u[0]*(v[1]*w[2]-v[2]*w[1])+u[1]*(v[2]*w[0]-v[0]*w[2])+u[2]*(v[0]*w[1]-v[1]*w[0]))/6;
  }
  assert.ok([...edges.values()].every(n=>n===0),'Every edge has opposite incidents');assert.equal(points.size-edges.size+terrain.faces.length,2);
  // An inscribed 800-triangle tessellation holds most, not all, of the analytic volume.
  const ratio=volume/(4/3*Math.PI*a*b*c);assert.ok(ratio>0.95&&ratio<=1,`Tessellated volume ratio ${ratio}`);
 });
 test(`${id}: shape material covers the whole nucleus with Shadows off`,async()=>{
  const root=resolve('src/objects',id),config=modelConfig(await json(`${root}/source/preparation/terrestrial.json`));
  const surfaces=modelSurfaces(await json(`${root}/prepared/surfaces.json`)),content=modelSettings(await json(`${root}/source/content/object.json`));
  assert.equal(surfaces.surfaces.length,1);const [surface]=surfaces.surfaces;
  assert.equal(surface.missingPixels,config.raster.width*config.raster.height);assert.equal(surface.appearance,SHAPE_MATERIAL.appearance);assert.equal(surface.layout.faceCount,800);
  assert.deepEqual(config.raster.observations,[]);assert.equal(config.geometry.radialTerrain.sourceLighting.uniformFlood,true);
  assert.equal(content.settings.controls.find(control=>control.name==='shadows')?.checked,false);
 });
 test(`${id}: source closure and fixed illustrative attitude`,async()=>{
  const root=resolve('src/objects',id),source=await createSourceManifest({planetId:id,planetName:id,sourceRoot:`${root}/source`});await source.verify();
  const ref=requireObjectRotationReference(await json(`${root}/object.json`));
  const a=await readAuthoredRotation(root,ref,2461286.5),b=await readAuthoredRotation(root,ref,2462286.5);assert.deepEqual(a,b);assert.equal(a.spinRateRadPerDay,0);
 });
}
