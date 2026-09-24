import type {CameraPlan} from '../../src/renderers/css/navigation/types.ts';
import type {PreparedProjectiveTextureLeaf} from './projective-layout.mts';
import {type Decoder,requireRecord,shape,text,number,array,optional,dictionary,boolean} from '@cssearth/core';
export interface ReplayRings {
 leaves:readonly (PreparedProjectiveTextureLeaf & {attributes?:Readonly<Record<string,string>>})[];
 resource:{key:string;url:string;pool:string};coverage:Record<string,unknown>;
 qualification:readonly {id:string;qualification:string}[];
}
export interface SolidReplayScene {
 rings?: ReplayRings;
 camera:CameraPlan;sky:ReturnType<typeof validatePreparedCubicSky>;sun:ReturnType<typeof validateDirectionalSunPlan>;systemTransform:string;
 bodyLeaves:readonly (PreparedProjectiveTextureLeaf & {attributes?:Readonly<Record<string,string>>})[];
 surfaceTriangles?:number[][][];surfaceLensRanges?:readonly {lensId:string;start:number;count:number}[];
}
import {camera} from '../objects/camera-source.mts';
import {parse} from '@cssearth/core/schema';
import {validatePreparedCubicSky} from '../../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../../src/platform/directional-sun-contract.mts';

const cameraPlan=(value:unknown)=>parse(value,camera,'saved camera');
const matrix=(value:unknown)=>typeof value==='string'?value:array(number)(value);
const leaf=shape({tag:optional(text),className:optional(text),style:text,attributes:optional(dictionary(text)),
  projectiveTextureLayer:optional(shape({schema:text,rasterScale:optional(number),textureMatrix:matrix,frameMatrix:matrix}))});
const parseReplayRings:Decoder<ReplayRings>=shape({leaves:array(leaf),resource:shape({key:text,url:text,pool:text}),coverage:requireRecord,qualification:array(shape({id:text,qualification:text}))});
export const parseSolidReplayScene:Decoder<SolidReplayScene>=shape({rings:optional(parseReplayRings),camera:cameraPlan,sky:validatePreparedCubicSky,
  sun:validateDirectionalSunPlan,systemTransform:text,bodyLeaves:array(leaf),
  surfaceTriangles:optional(array(array(array(number)))),surfaceLensRanges:optional(array(shape({lensId:text,start:number,count:number})))});
const asset=shape({url:text,width:number,height:number,bytes:number,sha256:text});
const surfaceFields=shape({id:text,textureScale:optional(number),displaySampling:optional(text),map:asset,surface:asset,thumbnail:asset,
  polesUrl:optional(text),shadowSurface:optional(asset),layout:value=>value});
const surface:Decoder<import('../objects/terrestrial-layers/solid-contract.mts').SolidSurface>=(value:unknown)=>Object.assign({},requireRecord(value),surfaceFields(value));
export const parseReplaySurfaces=shape({surfaces:array(surface)});
export const parseReplayMaterial=shape({surfaces:array(surface),lighting:shape({url:text,columns:number,rowCount:number,frameCount:number,
  frames:array(shape({resource:text,frame:number,row:number,backgroundPosition:text,backgroundSize:text}))})});
export const parseReplayLenses=shape({controls:array(shape({id:text,billboardColor:optional(text)}))});
export const parseReplayControls=shape({lenses:parseReplayLenses});
export const parseReplayMinimaps=shape({images:array(shape({id:text}))});
