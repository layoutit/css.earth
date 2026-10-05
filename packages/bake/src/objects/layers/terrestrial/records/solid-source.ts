import {requireRecord,shape,number,text,optional,boolean,array,dictionary,choice} from '@cssearth/core';
import {parseSciencePalette} from '../../../raster/index.ts';
import {parseNativePhotographicSampling} from '../native-photograph.ts';

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
    qualityMasks:optional(array(sourcePath)),additionalGrids:optional(array(sourcePath)),
    underlay:optional(parseScienceUnderlay)})(value));
}
/** A catalogue dataset drawn over an earlier observation: its empty cells show that photograph as grey context
 * (applyUnderlay in the raster lane owns the arithmetic). */
export function parseScienceUnderlay(value: unknown) {
  const underlay = shape({surface:text,brightness:number,grayscale:optional(boolean),bits:optional(number)})(value);
  if (Object.keys(requireRecord(value)).some(key => !['surface','brightness','grayscale','bits'].includes(key)))
    throw new TypeError('A scientific underlay takes only surface, brightness, grayscale and bits.');
  if (!(underlay.brightness > 0 && underlay.brightness <= 1)) throw new TypeError(`Underlay brightness must be in (0, 1], not ${underlay.brightness}.`);
  if (underlay.bits !== undefined && !(Number.isInteger(underlay.bits) && underlay.bits >= 1 && underlay.bits <= 8))
    throw new TypeError(`Underlay bits must be an integer from 1 to 8, not ${underlay.bits}.`);
  return underlay;
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
    // A shape view is neutral gray unless `science` names the body's published whole-disc color (shape-material.ts).
    shapeViews:optional(array(shape({...identity,label:text,science:optional(shape({kind:text,source:text,illuminant:text,qualification:text}))}))),
    surfaceObservations:optional(array(shape(identity))),
    observedColors:optional(array(shape({...identity,profile:requireRecord,monochromeBase:text,photometry:optional(parseColorPhotometry)})))})});

/** The manifest verifies bytes; the observation consumer owns these extra fields. */
const surfaceSource = shape({id:text,datasetId:text,path:text,width:number,height:number,
  label:optional(text),falseColor:optional(boolean),projection:optional(requireRecord)});
export const parseSurfaceSource = (value: unknown) => Object.assign({}, requireRecord(value), surfaceSource(value));
