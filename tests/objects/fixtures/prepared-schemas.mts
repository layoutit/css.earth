import {array,dictionary,number,nullable,optional,shape,text,requireRecord} from '@cssearth/core';
export const textureLayer=shape({schema:text,rasterScale:number,frameMatrix:text,textureMatrix:text});
export const preparedLeaf=shape({tag:text,className:optional(text),style:text,projectiveTextureLayer:optional(textureLayer),
  leafWidth:optional(number),leafHeight:optional(number),latitudeIndex:optional(number),longitudeIndex:optional(nullable(number)),
  polarCap:optional(nullable(text)),asset:optional(requireRecord),attributes:optional(dictionary(text))});
export const parseTitle=shape({label:text,viewBox:text,width:number,height:number,path:text,source:optional(text),sourceGenerator:optional(text),weight:optional(number),opticalSize:optional(number)});
const fact=shape({id:text,label:text,value:text,source:optional(shape({url:text,label:text,checked:optional(text),path:optional(text)}))});
export const parsePanel=shape({sourceId:optional(number),introduction:text,facts:array(fact),moreFacts:array(fact)});
export const parseContent=shape({schema:text,objectId:text,provenance:shape({editorial:shape({sourceId:number,modified:text})}),title:parseTitle,facts:array(fact),moreFacts:array(fact),
  resources:array(shape({label:text,role:text,description:text,href:text})),charts:array(requireRecord)});
