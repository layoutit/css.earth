import {refuseAuthoredCameraAngles} from '../../../src/platform/default-camera.mts';
import {shape,text,number,optional,array,requireRecord} from '@cssearth/core';
export const parseShapeModelConfig=shape({schema:text,displayName:text,displayRadius:number,quadBudget:number,
  mesh:shape({latitudeSegments:number,longitudeSegments:number,width:number,height:number,poleSize:number,seamOverlap:number}),
  ring:optional(shape({innerRadiusKm:number,outerRadiusKm:number,segments:number,displayValue:number,displayOpacity:number})),
  // One entry per lens; a body without entries shows one neutral gray lens. Each kind validates its own science block.
  surfaces:optional(array(shape({lens:text,source:text,science:(value):Record<string,unknown>&{kind:string}=>({...requireRecord(value),kind:shape({kind:text})(value).kind})}))),
  camera:value=>{const camera=shape({maximumHeightShare:number})(value);refuseAuthoredCameraAngles(camera);return camera;}});
export type ShapeModelConfig=ReturnType<typeof parseShapeModelConfig>;
export const parseShapeContent=shape({lenses:shape({controls:array(shape({id:text,thumbnail:text,source:shape({id:text,url:optional(text)})}))})});
