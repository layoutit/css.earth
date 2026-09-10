import {array,boolean,dictionary,json,literal,number,object,optional,parse,string} from '../material-composition/data-schema.mts';
import {responsiveFit} from '../camera-source.mts';
import type {Infer} from '../material-composition/data-schema.mts';
const lensInfo={id:string,label:string,shortLabel:string,measurement:string,falseColor:boolean,qualification:string};
const lens=object({...lensInfo,source:string,coveragePreparation:string,coverage:optional(object({kind:literal('polar-connected-zero')}))});
const normal=object({...lensInfo,thumbnailUrl:string,surfaceUrl:string,surface2xUrl:string,polesUrl:string,poles2xUrl:string});
const profile=object({schema:literal('cssearth-terrestrial-preparation@1'),kind:literal('affine-photographic-atmosphere'),namespace:string,displayName:string,publicBase:string,
 distanceAu:number,width:number,height:number,polarTileSize:number,shapePath:string,atmospherePath:string,
 source:object({path:string,label:string}),projection:object({rasterScale:number,tileSize:number,overlap:number,seamBleed:number,rasterOverscan:number}),
 color:string,rotationHours:number,rotationSeconds:number,lenses:object({normal,plans:array(lens),polarInpaintRadius:number,provenance:dictionary(json)}),
 reference:object({path:string,schema:string,cameraLabel:string,catalogueLabel:string,skyQualification:string}),
 camera:object({minimumControlPitchDegrees:number,maximumControlPitchDegrees:number,initialScenePitchDegrees:number,maximumScenePitchDegrees:number,
  minimumZoom:number,maximumZoom:number,defaultZoom:number,responsiveFit}),
 lighting:object({frameCount:number,minimumLightViewZ:number,maximumLightViewZ:number,pitchDegrees:number,frameGutter:number,sourcePaths:array(string),
  atmosphereLabel:string,shadowLabel:string,deliveryPath:optional(string)})});
export type AffineProfile=Infer<typeof profile>;
export type AffineLens=Infer<typeof lens>;
export const parseAffineProfile=(value:unknown)=>parse(value,profile,'affine preparation profile');
