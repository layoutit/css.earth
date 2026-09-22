import {readFile} from 'node:fs/promises';
import {requireRecord,hasErrorCode} from '../sources/source-values.mts';
import {shape,text,number,array,optional} from '../objects/terrestrial-layers/source-records.mts';

export interface SurfacePreviewDirectories {objectDirectory:string;publicDirectory:string;outputDirectory:string;}
export async function optionalPreviewJson(path:string) {
  try {return requireRecord(JSON.parse(await readFile(path,'utf8')));}
  catch(error){if(hasErrorCode(error,'ENOENT'))return null;throw error;}
}
export const parsePreviewControls=shape({controls:array(shape({id:text,surface2xUrl:optional(text),surfaceUrl:optional(text),thumbnailUrl:optional(text),view:optional(text),overlayId:optional(text)}))});
export const parsePolarPreview=shape({dimensions:shape({width:number,height:number}),packing:shape({latitudeBoundsDegrees:array(number),gutter:number}),lenses:array(shape({id:text,files:shape({surface2x:text})}))});
export const parseObservedPreview=shape({lenses:array(shape({id:text,products:array(shape({kind:text,filename:text,packing:optional(shape({bandCount:number,gutter:number}))}))}))});
export const parseSpectralPreview=shape({namespace:text,descriptor:parsePreviewControls,parameters:shape({body2xWidth:number,body2xHeight:number,latitudeBandCount:number}),lenses:array(shape({id:text}))});
export const parseGeometryPreview=shape({parameters:shape({planetRasterCellSize:number,longitudeSegments:number,latitudeSegments:number})});
// Authored rasters reference a source path; prepared surfaces instead retain
// a provenance record and provide their preview through map.url.
export const parsePreviewSurface=(value:unknown)=>Object.assign({},requireRecord(value),shape({id:text,map:optional(shape({url:text})),source:optional(value=>typeof value==='string'?text(value):requireRecord(value))})(value));
