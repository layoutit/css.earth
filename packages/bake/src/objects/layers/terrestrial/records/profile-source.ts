import { refuseAuthoredCameraAngles } from '../../../scene/index.ts';
import {requireRecord,shape,number,text,optional,nullable,array,boolean,dictionary,choice} from '@cssearth/core';
import { parseSciencePalette } from '../../../raster/index.ts';
import { parseTransform } from '../../../geometry/index.ts';
import { parseSolidScience, parseSolidRasterConfig } from './solid-source.ts';
import { parseRadialSource } from './radial-source.ts';
import { parseLimbBlock } from '@cssearth/objects';

/** A sphere's lighting frames: lit by the body's published photometric models (`limb`, packages/bake/src/photometry/limb.ts) or
 * by the lane's authored sphere law, never both. */
const AUTHORED_SPHERE_LAW=['terminatorWidth','directionalAmbient','fullPhaseAmbient','fullPhaseDiffuse','maximumOpacity'] as const;
export function parseSolidLighting(value:unknown) {
  const source=requireRecord(value), frames=shape({frameSize:number,frameCount:number,columns:number,logicalSize:number})(value);
  if(source.limb===undefined) return {...frames,...shape({terminatorWidth:number,directionalAmbient:number,fullPhaseAmbient:number,fullPhaseDiffuse:number,maximumOpacity:number})(value)};
  const stated=AUTHORED_SPHERE_LAW.filter(key=>key in source);
  if(stated.length) throw new TypeError(`limb names published models, so the authored sphere law is not stated: remove ${stated.join(', ')}`);
  return {...frames,limb:parseLimbBlock(source.limb,'limb')};
}

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
  const extra=shape({schema:choice('cssearth-terrestrial-preparation@2'),kind:choice('solid-observation-body'),
    namespace:text,displayName:text,publicBase:text,rings:optional(value=>value),
    geometry:shape({radius:number,radiusKm:number,mapUrl:text,polesUrl:text,radialModels:optional(value=>value),
      radialTerrain:optional(parseRadialSource),radialTerrainAlternatives:optional(array(value=>Object.assign({},parseRadialSource(value),shape({datasetId:text,additionalDatasetIds:optional(array(text)),display:optional(text)})(value)))),
      camera:optional(value=>{const camera=shape({framingScale:optional(number)})(value);refuseAuthoredCameraAngles(camera);return camera;})}),
    lighting:optional(parseSolidLighting),
    presentation:shape({defaultDataset:text}),
    celestial:shape({sunSource:text,sunQualification:optional(text),qualification:optional(text)})})(source);
  // A sphere draws lighting frames and needs their recipe. A shape-model body bakes its lighting into its mesh atlases
  // (radial/radial-materials.ts) and draws none, so a lighting block there would be read by nothing.
  const lightingField=`${extra.namespace}: source/preparation/terrestrial.json lighting`;
  if(extra.geometry.radialTerrain!==undefined&&extra.lighting!==undefined)
    throw new TypeError(`${lightingField} is read by nothing: geometry.radialTerrain makes this a shape-model body, whose lighting is baked into its mesh atlases. Remove the block.`);
  if(extra.geometry.radialTerrain===undefined&&extra.lighting===undefined)
    throw new TypeError(`${lightingField} is missing: a body without geometry.radialTerrain is a sphere, which draws lighting frames.`);
  const raster=requireRecord(source.raster);
  return {...source,...base,...extra,raster:{...base.raster,
    observations:base.raster.observations.map(entry=>({...entry,validity:validity(entry.validity)})),
    scientific:raster.scientific===undefined?undefined:array(science)(raster.scientific),
    observedColors:raster.observedColors===undefined?undefined:array(observedColor)(raster.observedColors)}};
}
