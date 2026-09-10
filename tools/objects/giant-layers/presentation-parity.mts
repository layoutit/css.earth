import {parse,object,string} from '../material-composition/data-schema.mts';
import {validatePreparedCubicSky} from '../../../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{isDeepStrictEqual}from'node:util';
import{fileURLToPath}from'node:url';
import{resolve}from'node:path';
import{prepareBandedEllipsoid}from'./geometry.mts';
import{prepareLayeredSurfacePresentation}from'./presentation.mts';
import{prepareWorldNavigationDefinition}from'../dist/prepare-world-navigation.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export async function assertLayeredPresentationParity(id:string){
 const directory=resolve(root,'src/planets',id),json=async(path:string):Promise<unknown>=>JSON.parse(await readFile(resolve(directory,path),'utf8'));
 const geometryConfig=await json('source/preparation/geometry.json'),geometry=prepareBandedEllipsoid(geometryConfig);
 const actual=await prepareLayeredSurfacePresentation({config:await json('source/preparation/presentation.json'),geometryConfig,geometry,observationConfig:await json('source/preparation/observations.json'),materialConfig:await json('source/preparation/materials.json'),sky:validatePreparedCubicSky(await json('prepared/sky.json'),{requireSun:false}),sun:validateDirectionalSunPlan(await json('prepared/sun.json'))});
 const expected=parse(await json('prepared/runtime.json'),object({schema:string}),'runtime presentation');const {definition:runtime}=await prepareWorldNavigationDefinition({objectDirectory:directory,projectRoot:root,definition:{...actual,schema:expected.schema,id,controls:await json('prepared/controls.json')}});
 assert.ok(isDeepStrictEqual(runtime,expected),firstDifference(runtime,expected)??'Runtime presentations differ');return runtime;
}
function firstDifference(a:unknown,b:unknown,path='runtime'):string|null{
 if(isDeepStrictEqual(a,b))return null;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const key of keys){const difference=firstDifference(Reflect.get(a,key),Reflect.get(b,key),`${path}.${key}`);if(difference)return difference;}
 }
 return`${path}: ${JSON.stringify(a)?.slice(0,1500)} != ${JSON.stringify(b)?.slice(0,1500)}`;
}
