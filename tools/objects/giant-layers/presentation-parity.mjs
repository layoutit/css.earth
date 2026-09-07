import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{isDeepStrictEqual}from'node:util';
import{fileURLToPath}from'node:url';
import{resolve}from'node:path';
import{prepareBandedEllipsoid}from'./geometry.mjs';
import{prepareLayeredSurfacePresentation}from'./presentation.mjs';
import{prepareWorldNavigationDefinition}from'../dist/prepare-world-navigation.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export async function assertLayeredPresentationParity(id){
 const directory=resolve(root,'src/planets',id),json=async path=>JSON.parse(await readFile(resolve(directory,path),'utf8'));
 const geometryConfig=await json('source/preparation/geometry.json'),geometry=prepareBandedEllipsoid(geometryConfig);
 const actual=await prepareLayeredSurfacePresentation({config:await json('source/preparation/presentation.json'),geometryConfig,geometry,observationConfig:await json('source/preparation/observations.json'),materialConfig:await json('source/preparation/materials.json'),sky:await json('prepared/sky.json'),sun:await json('prepared/sun.json')});
 const expected=await json('prepared/runtime.json');const {definition:runtime}=await prepareWorldNavigationDefinition({objectDirectory:directory,projectRoot:root,definition:{...actual,schema:expected.schema,id,controls:await json('prepared/controls.json')}});
 assert.ok(isDeepStrictEqual(runtime,expected),firstDifference(runtime,expected));return runtime;
}
function firstDifference(a,b,path='runtime'){
 if(isDeepStrictEqual(a,b))return null;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const key of keys){const difference=firstDifference(a[key],b[key],`${path}.${key}`);if(difference)return difference;}
 }
 return`${path}: ${JSON.stringify(a)?.slice(0,1500)} != ${JSON.stringify(b)?.slice(0,1500)}`;
}
