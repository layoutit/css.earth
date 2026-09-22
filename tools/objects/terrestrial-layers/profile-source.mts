import { refuseAuthoredCameraAngles } from '../../../src/platform/default-camera.mts';
import {requireRecord} from '../../sources/source-values.mts';
import {shape,number,text,optional,nullable,array,boolean,dictionary,choice,parseTransform,parseSciencePalette} from './source-records.mts';
import {parseSolidScience,parseSolidRasterConfig} from './solid-source.mts';
import {parseRadialSource} from './radial-source.mts';

const grid = shape({width:optional(number),height:optional(number),noData:optional(nullable(number)),
  projection:optional(text),poleLatitude:optional(number),latitudeRange:optional(array(number)),
  member:optional(text),metersPerUnit:optional(number),expectedVertices:optional(number),expectedFaces:optional(number)});
function science(value:unknown) {
  return Object.assign({},parseSolidScience(value),shape({grid:optional(grid),sampling:optional(text),
    additionalGrids:optional(array(shape({path:text,grid}))),valueTransform:optional(parseTransform),
    coverage:optional(shape({path:text,member:text})),surfaceSampling:optional(shape({method:text,maximumDistanceMeters:number}))})(value));
}
const validity = shape({kind:text,resampling:optional(text),noData:optional(nullable(number)),centerLongitude:optional(number),
  grid:optional(shape({pixelsPerDegree:optional(number),sampleOffset:optional(number),lineOffset:optional(number)})),
  member:optional(text),targetName:optional(text),samples:optional(array(number)),sampleBytes:optional(number),alphaBand:optional(number),
  resolutionMeters:optional(number),resolutionDegrees:optional(number),origin:optional(array(number)),
  connectedFillRange:optional(array(number)),connectedEdge:optional(text),displayRange:optional(array(number)),
  specialValueMagnitude:optional(number),coordinates:optional(text),channels:optional(text),zeroValidity:optional(text),
  withholdLatitudeDegrees:optional(number),withholdLongitudeDegrees:optional(array(number))});
const observedColor = shape({id:text,consumer:text,monochromeBase:text,
  profile:shape({referenceRadiusMeters:number,filters:array(text),noData:number,specialValueMagnitude:number}),
  photometry:optional(shape({profile:shape({model:text,radiusKm:number,phaseNormalization:boolean,observationWeights:dictionary(number),
    referenceIncidenceDegrees:number,referenceEmissionDegrees:number,maximumIncidenceDegrees:number,maximumEmissionDegrees:number}),
    levels:shape({boundaryPixels:number,luminance:array(number)}),vectors:shape({sun:text,observer:text})}))});

/** Decode consumed fields; the profile validator owns their scientific relationships. */
export function parseSolidPreparationSource(input:unknown) {
  const source=requireRecord(input), base=parseSolidRasterConfig(input);
  const extra=shape({schema:choice('cssearth-terrestrial-preparation@1'),kind:choice('solid-observation-body'),
    namespace:text,displayName:text,publicBase:text,rings:optional(value=>value),
    geometry:shape({radius:number,radiusKm:number,mapUrl:text,polesUrl:text,radialModels:optional(value=>value),
      radialTerrain:optional(parseRadialSource),radialTerrainAlternatives:optional(array(value=>Object.assign({},parseRadialSource(value),shape({lensId:text,additionalLensIds:optional(array(text))})(value)))),
      camera:optional(value=>{const camera=shape({framingScale:optional(number)})(value);refuseAuthoredCameraAngles(camera);return camera;})}),
    lighting:shape({frameSize:number,frameCount:number,columns:number,logicalSize:number,terminatorWidth:number,
      directionalAmbient:number,fullPhaseAmbient:number,fullPhaseDiffuse:number,maximumOpacity:number}),
    presentation:shape({defaultLens:text}),
    celestial:shape({sunSource:text,sunQualification:optional(text),qualification:optional(text)})})(source);
  const raster=requireRecord(source.raster);
  return {...source,...base,...extra,raster:{...base.raster,
    observations:base.raster.observations.map(entry=>({...entry,validity:validity(entry.validity)})),
    scientific:raster.scientific===undefined?undefined:array(science)(raster.scientific),
    observedColors:raster.observedColors===undefined?undefined:array(observedColor)(raster.observedColors)}};
}
