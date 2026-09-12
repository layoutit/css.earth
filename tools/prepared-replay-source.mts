import type {CameraPlan} from '../src/renderers/css/navigation/types.ts';
import type {PreparedProjectiveTextureLeaf} from '../src/renderers/css/rendering/prepared-projective-texture-leaf.ts';
import type {Decoder} from './objects/terrestrial-layers/source-records.mts';
export interface ReplayRings {
 leaves:readonly (PreparedProjectiveTextureLeaf & {attributes?:Readonly<Record<string,string>>})[];
 resource:{key:string;url:string;pool:string};coverage:Record<string,unknown>;
 qualification:readonly {id:string;qualification:string}[];
}
export interface SolidReplayScene {
 rings?: ReplayRings;
 camera:CameraPlan;sky:ReturnType<typeof validatePreparedCubicSky>;sun:ReturnType<typeof validateDirectionalSunPlan>;systemTransform:string;
 bodyLeaves:readonly (PreparedProjectiveTextureLeaf & {attributes?:Readonly<Record<string,string>>})[];
 heliocentricView:ReturnType<typeof validatePreparedHeliocentricView>;surfaceTriangles?:number[][][];surfaceLensRanges?:readonly {lensId:string;start:number;count:number}[];
}
import {requireRecord} from './source-values.mts';
import {shape,text,number,array,optional,dictionary,boolean} from './objects/terrestrial-layers/source-records.mts';
import {camera} from './objects/camera-source.mts';
import {parse} from './objects/material-composition/data-schema.mts';
import {validatePreparedCubicSky} from '../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../src/platform/directional-sun-contract.mts';
import {validatePreparedHeliocentricView} from '../src/platform/heliocentric-view.mts';

const cameraPlan=(value:unknown)=>parse(value,camera,'saved camera');
const matrix=(value:unknown)=>typeof value==='string'?value:array(number)(value);
const leaf=shape({tag:optional(text),className:optional(text),style:text,attributes:optional(dictionary(text)),
  projectiveTextureLayer:optional(shape({schema:text,rasterScale:optional(number),textureMatrix:matrix,frameMatrix:matrix}))});
const parseReplayRings:Decoder<ReplayRings>=shape({leaves:array(leaf),resource:shape({key:text,url:text,pool:text}),coverage:requireRecord,qualification:array(shape({id:text,qualification:text}))});
const heliocentric=(value:unknown)=>{
  text(requireRecord(value).bodyId);
  // This existing scientific validator checks the numerical plan and its system.
  return validatePreparedHeliocentricView(value as Parameters<typeof validatePreparedHeliocentricView>[0]);
};
export const parseSolidReplayScene:Decoder<SolidReplayScene>=shape({rings:optional(parseReplayRings),camera:cameraPlan,sky:value=>validatePreparedCubicSky(value,{requireSun:false}),
  sun:validateDirectionalSunPlan,systemTransform:text,bodyLeaves:array(leaf),heliocentricView:heliocentric,
  surfaceTriangles:optional(array(array(array(number)))),surfaceLensRanges:optional(array(shape({lensId:text,start:number,count:number})))});
const asset=shape({url:text,width:number,height:number,bytes:number,sha256:text});
const surfaceFields=shape({id:text,textureScale:optional(number),displaySampling:optional(text),map:asset,surface:asset,thumbnail:asset,
  polesUrl:optional(text),shadowSurface:optional(asset),layout:value=>value});
const surface:Decoder<import('./objects/terrestrial-layers/solid-contract.mts').SolidSurface>=(value:unknown)=>Object.assign({},requireRecord(value),surfaceFields(value));
export const parseReplaySurfaces=shape({surfaces:array(surface)});
export const parseReplayMaterial=shape({surfaces:array(surface),lighting:shape({url:text,columns:number,rowCount:number,frameCount:number,
  frames:array(shape({resource:text,frame:number,row:number,backgroundPosition:text,backgroundSize:text}))})});
export const parseReplayLenses=shape({controls:array(shape({id:text,billboardColor:optional(text)}))});
export const parseReplayControls=shape({lenses:parseReplayLenses});
export const parseReplayMinimaps=shape({images:array(shape({id:text}))});
export const parseReplayTerrain=shape({width:number,height:number,source:shape({tileSize:number,atlasColumns:number}),
  faces:array(shape({vertices:array(array(number)),normal:array(number),vertexNormals:array(array(number)),estimated:optional(boolean)}))});
