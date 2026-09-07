import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { preparePhysicalMaterialTracks } from './world-navigation-materials.js';
import { authoredPresentationBasis } from './world-navigation-sources.js';
import { requireMaterials } from '../../src/renderers/css/validation/materials.js';
import { createPreparedEllipsoidProjection, readPreparedMatrix4 } from '../../src/renderers/css/solar-system/prepared-ellipsoid-projection.js';

const root=resolve(import.meta.dirname,'../..'),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

test('independent materials retain their actual silhouette-fit owner, never an unbound fallback',async()=>{
  for(const id of ['mercury','venus']){
    const runtime=JSON.parse(await readFile(resolve(root,'src/planets',id,'prepared/runtime.json'),'utf8'));
    const input={definition:runtime,bodyToPresentation:[1,0,0,0,1,0,0,0,1] as const,sourceRadiusUnits:230,tilePixels:50,
      physicalShape:{equatorialRadiusM:1000,polarRadiusM:1000},sources:new Map()};
    const output=preparePhysicalMaterialTracks(input);
    output.materials.forEach((track:any,index:number)=>assert.equal(track,runtime.materials[index]));
    assert.throws(()=>preparePhysicalMaterialTracks({...input,definition:{...runtime,viewBindings:[]}}),/close over its prepared scene/);
  }
});

for(const id of ['earth','mars','uranus','neptune'])test(`${id}: actual accepted material maps gain physical projection without changing affine content`,async()=>{
  const directory=resolve(root,'src/planets',id),read=async(path:string)=>JSON.parse(await readFile(resolve(directory,path),'utf8'));
  const descriptor=await read('object.json'),runtime=await read('prepared/runtime.json'),recipe=descriptor.properties.recipe;
  const sources=new Map<string,Record<string,any>>();
  for(const source of recipe.sources)if(source.path.endsWith('.json'))sources.set(source.id,await read(source.path));
  const original={...runtime,materials:runtime.materials.map((track:any)=>{
    if(!track.rotation)return track;const {physical,...rotation}=track.rotation;return {...track,rotation};
  })};
  const basis=authoredPresentationBasis(sources,[1,0,0,0,1,0,0,0,1]);
  const output=preparePhysicalMaterialTracks({definition:original,...basis,sources,physicalShape:{
    equatorialRadiusM:recipe.shape.radiusKm*1000,polarRadiusM:(recipe.shape.polarRadiusKm??recipe.shape.radiusKm)*1000,
  }});
  assert.equal(output.tree,original.tree);assert.equal(output.assets,original.assets);
  requireMaterials(output.materials,output.tree,new Set(output.assets.entries.map((entry:any)=>entry.key)));
  for(const [index,track] of output.materials.entries()){
    assert.equal(track.rotation.kind,original.materials[index].rotation.kind);
    assert.equal(track.banks,original.materials[index].banks);assert.equal(track.frame,original.materials[index].frame);
    assert.ok(track.rotation.physical,'new numerical projection is required');
    const projection=track.rotation.physical.projection,ellipse=projection.textureEllipse;
    assert.ok(ellipse.center.every(Number.isFinite));assert.ok(ellipse.covariance[0]*ellipse.covariance[2]>ellipse.covariance[1]**2);
    const eye=[...identity],radius=basis.sourceRadiusUnits*basis.tilePixels;eye[12]=radius*.5;eye[14]=-radius*3;
    const transform=createPreparedEllipsoidProjection(track.rotation.physical)({degrees:32,counterMatrix:identity,
      projection:{focalPixels:800,principalOffsetPixels:[-170,0],eyeFromScene:eye}});
    assert.ok(readPreparedMatrix4(transform).every(Number.isFinite));
    const malformed=structuredClone(output.materials);malformed[index].rotation.physical.projection.textureEllipse.covariance=[1,2,1];
    assert.throws(()=>requireMaterials(malformed,output.tree,new Set(output.assets.entries.map((entry:any)=>entry.key))),/positive definite/);
  }
  const missing={...original,viewBindings:[]};
  assert.throws(()=>preparePhysicalMaterialTracks({definition:missing,...basis,sources,physicalShape:{equatorialRadiusM:1,polarRadiusM:1}}),/actual prepared counter/);
});
