import type { RadialSimplification } from './radial-mesh.mts';
import { type Decoder, requireRecord, shape, number, text, optional, boolean } from '@cssearth/core';

export const parseRadialSimplification:Decoder<RadialSimplification> = shape({method:optional(text),targetFaces:number,maximumErrorMeters:number,regularize:optional(boolean),prune:optional(boolean)});
export const parseRadialSource = shape({format:optional(text),path:text,grid:requireRecord,faceBudget:number,texelsPerFace:number,
  latitudeSegments:optional(number),longitudeSegments:optional(number),backfaceVisible:optional(boolean),sourceTopology:optional(text),primitive:optional(text),
  simplification:optional(parseRadialSimplification),completion:optional(shape({method:text,depthMeters:number,faceBudget:number,
    reduction:optional(shape({targetFaces:number,maximumErrorMeters:number}))}))});

export const parseRadialSnapshot = shape({size:number,longitudeDegrees:number,latitudeDegrees:number,ambient:number,diffuse:number,displaySampling:optional(text)});

export const parseRadialLoaderConfig = shape({namespace:text,displayName:optional(text),
  geometry:shape({radius:number,radiusKm:number,radialTerrain:optional(requireRecord)})});
