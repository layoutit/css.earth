import {requireRecord} from '../../sources/source-values.mts';
import {shape,number,text,optional,boolean,array,dictionary,choice,parseSciencePalette} from './source-records.mts';
import {parseNativePhotographicSampling} from './native-photograph.mts';

const texture = {textureScale:optional(number),monochromeBase:optional(text),
  previewGrid:optional(shape({width:number,height:number})),displaySampling:optional(text)};
const identity = {id:text,consumer:text,metadata:optional(requireRecord)};
const sourcePath = shape({path:text});
export const parseSolidObservation = shape({id:text,...texture,validity:shape({kind:text,labelPath:optional(text),resampling:optional(text)}),
  nativePhotographicSampling:optional(parseNativePhotographicSampling),
  projection:optional(requireRecord),metadata:optional(requireRecord),reportComposition:optional(boolean)});
export function parseSolidScience(value: unknown) {
  return Object.assign({}, requireRecord(value), parseSciencePalette(value), shape({...identity,...texture,path:text,format:text,label:text,
    grid:optional(requireRecord),labelPath:optional(text),meshPath:optional(text),
    facetField:optional(shape({path:text,labelPath:text})),table:optional(shape({labelPath:optional(text)})),
    surfaceSampling:optional(shape({maximumDistanceMeters:number,renderedMeshPath:optional(text),ambiguityReference:optional(sourcePath)})),
    symbols:optional(shape({paths:text,locations:text})),comparison:optional(sourcePath),
    qualityMasks:optional(array(sourcePath)),additionalGrids:optional(array(sourcePath))})(value));
}
export const parseColorPhotometry = shape({consumer:text,profile:shape({radiusKm:number,maximumIncidenceDegrees:number,
  maximumEmissionDegrees:number,referenceIncidenceDegrees:number,referenceEmissionDegrees:number,observationWeights:dictionary(number),
  withheld:optional(choice('monochrome','next-observation')),
  bandLevels:optional(shape({reference:text,cellDegrees:number,minimumOverlapPixels:number})),
  bandRatios:optional(shape({reference:text,ratios:(value:unknown)=>Object.fromEntries(Object.entries(requireRecord(value)).map(([filter,ratio])=>[filter,number(ratio)])),source:text}))}),
  vectors:shape({sun:text,observer:text}),levels:shape({boundaryPixels:number,luminance:array(number)})});
export const parseSolidRasterConfig = shape({namespace:text,publicBase:text,
  geometry:optional(shape({radius:number,radiusKm:number,radialTerrain:optional(shape({path:text}))})),
  raster:shape({width:number,height:number,bandCount:number,gutter:number,poleSize:number,reportMissingPixels:optional(boolean),
    observations:array(parseSolidObservation),scientific:optional(array(parseSolidScience)),
    shapeViews:optional(array(shape({...identity,label:text}))),
    surfaceObservations:optional(array(shape(identity))),
    observedColors:optional(array(shape({...identity,profile:requireRecord,monochromeBase:text,photometry:optional(parseColorPhotometry)})))})});

/** The manifest verifies bytes; the observation consumer owns these extra fields. */
const surfaceSource = shape({id:text,lensId:text,path:text,width:number,height:number,
  label:optional(text),falseColor:optional(boolean),projection:optional(requireRecord)});
export const parseSurfaceSource = (value: unknown) => Object.assign({}, requireRecord(value), surfaceSource(value));
