import {array,boolean,choice,dictionary,number,nullable,optional,shape,text} from '../../../tools/objects/terrestrial-layers/source-records.mts';
import {requireRecord} from '../../../tools/source-values.mts';
import {validatePreparedCubicSky} from '../../../src/platform/cubic-sky-contract.mts';
export const textureLayer=shape({schema:text,rasterScale:number,frameMatrix:text,textureMatrix:text});
export const preparedLeaf=shape({tag:text,className:optional(text),style:text,projectiveTextureLayer:optional(textureLayer),
  leafWidth:optional(number),leafHeight:optional(number),latitudeIndex:optional(number),longitudeIndex:optional(nullable(number)),
  polarCap:optional(nullable(text)),asset:optional(requireRecord),attributes:optional(dictionary(text))});
const camera=shape({cameraModel:text,defaultControlYawDegrees:number,pitchBounded:boolean,yawBounded:boolean,projection:optional(requireRecord)});
export const parseStaticScene=shape({schema:text,camera,body:shape({meanRadiusKm:optional(number),orbitalPeriodYears:optional(number),latitudeSegments:number,longitudeSegments:number,
  bands:array(shape({latitudeIndex:number,leaves:array(preparedLeaf)}))}),counts:shape({retainedLeafCount:number,materialLeafCount:number,
  retainedSkyboxFaceCount:number,directionalSunLeafCount:number,runtimeGeometryPreparation:boolean,runtimeRasterization:boolean})});
const lensFields={id:text,label:text,shortLabel:optional(text),surfaceUrl:text,surface2xUrl:text,polesUrl:text,poles2xUrl:text,thumbnailUrl:text,qualification:text};
export const parseStaticLenses=shape({schema:text,defaultLens:text,runtimeFilters:boolean,runtimeRasterization:boolean,
  material:shape({schema:text,one:text,two:text,runtimeRasterization:boolean}),controls:array(shape(lensFields))});
export const parseSolarLenses=shape({schema:text,defaultLens:text,runtimeFilters:boolean,runtimeRasterization:boolean,
  controls:array(shape({...lensFields,coronaUrl:text,corona2xUrl:text,limbUrl:text,limb2xUrl:text,falseColor:boolean,detail:text,summary:text,title:text,description:text}))});
export const parseSolarScene=shape({schema:text,runtimeGeometry:boolean,runtimeRasterization:boolean,camera,
  body:shape({radius:number,latitudeSegments:number,longitudeSegments:number,sourceProjection:text,sourceMapSize:array(number),
    continuumPreparation:text,polarPreparation:text,sourceTimeRange:text,sourceRotation:number,leaves:array(preparedLeaf)}),
  offLimbContext:shape({defaultUrl:text,defaultUrl2x:text,composition:text,runtimeAlphaProcessing:boolean}),
  limbMaterial:shape({defaultUrl:text,defaultUrl2x:text,composition:text,surfaceReplacement:boolean,runtimeAlphaProcessing:boolean}),
  animation:shape({rotationVisualSeconds:number,model:text,flatDiscRotation:boolean}),
  counts:shape({polygonCount:number,textureLeafCount:number,polarLeafCount:number}),
  worldFrame:requireRecord,starfield:(v:unknown)=>({...validatePreparedCubicSky(v,{requireSun:false}),...shape({model:text})(v)})});
export const parseTitle=shape({label:text,viewBox:text,width:number,height:number,path:text,source:optional(text),sourceSha256:optional(text),sourceGenerator:optional(text),weight:optional(number),opticalSize:optional(number)});
const fact=shape({id:text,label:text,value:text,source:optional(shape({url:text,label:text,checked:optional(text),path:optional(text)}))});
export const parsePanel=shape({sourceId:optional(number),introduction:text,facts:array(fact),moreFacts:array(fact)});
export const parseContent=shape({schema:text,objectId:text,provenance:shape({editorial:shape({sourceId:number,modified:text})}),title:parseTitle,introduction:text,facts:array(fact),moreFacts:array(fact),
  resources:array(shape({label:text,role:text,description:text,href:text})),charts:array(requireRecord)});
