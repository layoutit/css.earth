import {shape,text,number,optional,array} from '../terrestrial-layers/source-records.mts';
export const parseShapeModelConfig=shape({schema:text,displayName:text,displayRadius:number,quadBudget:number,
  mesh:shape({latitudeSegments:number,longitudeSegments:number,width:number,height:number,poleSize:number,seamOverlap:number}),
  ring:optional(shape({innerRadiusKm:number,outerRadiusKm:number,segments:number,displayValue:number,displayOpacity:number})),
  surface:optional(shape({source:text,science:shape({kind:text,colorMatching:text,illuminant:text,qualification:text})})),
  camera:shape({initialScenePitchDegrees:number,defaultControlYawDegrees:number,maximumHeightShare:number})});
export type ShapeModelConfig=ReturnType<typeof parseShapeModelConfig>;
export const parseShapeContent=shape({lenses:shape({controls:array(shape({id:text,thumbnail:text,source:shape({id:text,url:optional(text)})}))})});
