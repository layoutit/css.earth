import type { RadialSimplification } from '../../../geometry/index.ts';
import { type Decoder, requireRecord, shape, number, text, optional, boolean } from '@cssearth/core';

export const parseRadialSimplification:Decoder<RadialSimplification> = shape({method:optional(text),targetFaces:optional(number),maximumErrorMeters:number,regularize:optional(boolean),prune:optional(boolean)});
/** The atlas budget is `atlasTexels`, or `texelsPerFace` times the face count; a source states one of the two. */
export const parseRadialSource = shape({format:optional(text),path:text,grid:requireRecord,faceBudget:number,texelsPerFace:optional(number),atlasTexels:optional(number),
  latitudeSegments:optional(number),longitudeSegments:optional(number),backfaceVisible:optional(boolean),sourceTopology:optional(text),primitive:optional(text),
  simplification:optional(parseRadialSimplification),completion:optional(shape({method:text,depthMeters:number,faceBudget:number,
    reduction:optional(shape({targetFaces:number,maximumErrorMeters:number}))}))});

export const parseRadialSnapshot = shape({size:number,longitudeDegrees:number,latitudeDegrees:number,ambient:number,diffuse:number,displaySampling:optional(text)});

export const parseRadialLoaderConfig = shape({namespace:text,displayName:optional(text),
  geometry:shape({radius:number,radiusKm:number,radialTerrain:optional(requireRecord)})});
