import type { SurfaceGeometryProfile } from '@cssearth/objects';
import type { SeamOutsetProfile } from './seam-outset.ts';

export interface GeometryProfile {
  schema: 'cssearth-css-geometry-profile@1'; namespace: string; surface: SurfaceGeometryProfile;
  projection: { tileSize: number; layerElevation: number; seamBleed: number; interiorSeamBleed: number;
    overlap: number; fitToSource: boolean; rasterScale: number; rasterGutter: number; rasterOverscan: number;
    projectivePoles: boolean; lightColor: string; ambientIntensity: number;
    /** Exact tiling whose surface leaves hold a silhouette-stepped outset instead of a fixed overlap. */
    seamOutset?: SeamOutsetProfile };
  bodyRotationDegrees: number;
  /** Flat textured discs in the body's equatorial plane, drawn under the same system node as the surface, so a ring
   * follows the body as the body is oriented rather than carrying an orientation of its own. */
  planes?: { id: string; radius: number; url: string; size: number; color: string }[];
  output: { schema: string; materialSchema: string; layout: 'retained' | 'body-container'; cutawaySchema?: string; interiorOrbitSchema?: string;
    body?: { axialTiltDegrees: number; rotationDirection: string; rotationPeriodEarthDays: number };
    motion?: { visualRotationSeconds: number; physicalSiderealRotationEarthDays: number; speedStates: Record<string, number> };
    animation?: { cloudsVisualSeconds: number; surfaceVisualSeconds: number; direction: string }; retainedRootCount?: number };

  cutaway?: { coreLatitudeSegments: number; coreLongitudeSegments: number; surfaceWidth: number; surfaceHeight: number;
    polarTileSize: number; polarWidth: number; polarHeight: number; polarRadiusScale: number; polarOffset: number;
    sectionWidth: number; sectionHeight: number; sectionPresentationWidth: number; sectionPresentationHeight: number;
    rotationDegrees: number; color: string; assistStartDegrees: number; assistMaximumDegrees: number;
    controlMaximumDegrees: number; millisecondsPerDegree: number };
}

const object = (value: unknown, name: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object.`);
  return value as Record<string, unknown>;
};
function numbers(value: Record<string, unknown>, names: readonly string[], label: string) {
  for (const name of names) if (typeof value[name] !== 'number' || !Number.isFinite(value[name])) throw new TypeError(`${label}.${name} must be finite.`);
}
function raster(value: unknown, label: string) {
  const source = object(value, label); numbers(source, ['width', 'height'], label);
  if (typeof source.url !== 'string' || !source.url.startsWith('/scenes/') || Number(source.width) <= 0 || Number(source.height) <= 0) throw new TypeError(`${label} needs an asset and positive raster dimensions.`);
}
/** Validates authored renderer parameters separately from semantic object capabilities. */
export function parseGeometryProfile(value: unknown): GeometryProfile {
  const profile = object(value, 'geometry');
  if (profile.schema !== 'cssearth-css-geometry-profile@1' || typeof profile.namespace !== 'string' || !/^[a-z][a-z0-9-]*$/.test(profile.namespace)) throw new TypeError('Unsupported geometry profile.');
  numbers(profile, ['bodyRotationDegrees'], 'geometry');
  const surface = object(profile.surface, 'surface');
  numbers(surface, ['radius', 'polarRadius', 'latitudeSegments', 'longitudeSegments', 'surfaceLatitudeHeight', 'packedBandGutter', 'polarTileSize', 'polarRadiusScale', 'polarOffset'], 'surface');
  for (const name of ['radius', 'polarRadius', 'surfaceLatitudeHeight', 'polarTileSize', 'polarRadiusScale']) if (Number(surface[name]) <= 0) throw new TypeError(`surface.${name} must be positive.`);
  for (const name of ['latitudeSegments', 'longitudeSegments']) if (!Number.isInteger(surface[name]) || Number(surface[name]) < 3 || Number(surface[name]) > 4096) throw new TypeError('Surface segmentation is invalid.');
  if (!['global', 'cell'].includes(String(surface.uv)) || typeof surface.color !== 'string') throw new TypeError('Surface mapping is invalid.');
  raster(surface.surface, 'surface texture'); raster(surface.poles, 'polar texture');
  if (surface.innerPoles !== undefined) numbers(object(surface.innerPoles, 'inner poles'), ['radiusScale', 'offset'], 'inner poles');
  const projection = object(profile.projection, 'projection');
  numbers(projection, ['tileSize', 'layerElevation', 'seamBleed', 'interiorSeamBleed', 'overlap', 'rasterScale', 'rasterGutter', 'rasterOverscan', 'ambientIntensity'], 'projection');
  if (typeof projection.lightColor !== 'string') throw new TypeError('Projection needs a light colour.');
  for (const name of ['fitToSource', 'projectivePoles']) if (typeof projection[name] !== 'boolean') throw new TypeError(`projection.${name} must be boolean.`);
  // Every leaf writes its texture address inline; a lens reaches it through the texture its variant writes on the body.
  if (projection.positionVariables !== undefined) throw new TypeError('projection.positionVariables is gone: remove it.');
  if (projection.seamOutset !== undefined) {
    numbers(object(projection.seamOutset, 'projection.seamOutset'), ['targetPixels', 'stepRatio', 'hysteresis', 'firstDiameter', 'lastDiameter'], 'projection.seamOutset');
    // The stepped outset replaces a stretched overlap. Leaves either tile exactly or overlap by exactly
    // their raster overscan, so every overlapping texel is the neighbouring source texel.
    const texture = object(surface.surface, 'surface texture');
    const matched = [Number(texture.width) / Number(surface.longitudeSegments), Number(surface.surfaceLatitudeHeight) / Number(surface.latitudeSegments)]
      .every(cellTexels => Math.abs(Number(projection.overlap) * cellTexels - Number(projection.rasterOverscan)) < 1e-9);
    if (projection.seamBleed !== 0 || !matched) throw new TypeError(`${String(profile.namespace)}: a stepped seam outset needs seamBleed 0 (got ${String(projection.seamBleed)}) and overlap x texels per cell = rasterOverscan (overlap ${String(projection.overlap)}, cells ${Number(texture.width) / Number(surface.longitudeSegments)} x ${Number(surface.surfaceLatitudeHeight) / Number(surface.latitudeSegments)} texels, overscan ${String(projection.rasterOverscan)}).`);
  }
  if (profile.planes !== undefined) {
    if (!Array.isArray(profile.planes) || !profile.planes.length) throw new TypeError('geometry.planes must be a non-empty array.');
    for (const value of profile.planes) {
      const plane = object(value, 'plane');
      numbers(plane, ['radius', 'size'], 'plane');
      if (Number(plane.radius) <= 0 || !Number.isInteger(plane.size) || Number(plane.size) <= 0) throw new TypeError('A plane needs a positive radius and raster size.');
      if (typeof plane.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(plane.id) || typeof plane.color !== 'string') throw new TypeError('A plane needs an identifier and colour.');
      if (typeof plane.url !== 'string' || !plane.url.startsWith('/scenes/')) throw new TypeError('A plane needs a prepared asset.');
    }
  }
  if (profile.cutaway !== undefined) {
    const cutaway = object(profile.cutaway, 'cutaway');
    numbers(cutaway, ['coreLatitudeSegments', 'coreLongitudeSegments', 'surfaceWidth', 'surfaceHeight', 'polarTileSize', 'polarWidth', 'polarHeight',
      'polarRadiusScale', 'polarOffset', 'sectionWidth', 'sectionHeight', 'sectionPresentationWidth', 'sectionPresentationHeight',
      'rotationDegrees', 'assistStartDegrees', 'assistMaximumDegrees', 'controlMaximumDegrees', 'millisecondsPerDegree'], 'cutaway');
    if (typeof cutaway.color !== 'string') throw new TypeError('Cutaway colour is invalid.');
  }
  const output=object(profile.output,'output');
  if (typeof output.schema!=='string'||typeof output.materialSchema!=='string'||!['retained','body-container'].includes(String(output.layout))) throw new TypeError('Scene output profile is invalid.');
  if (profile.cutaway!==undefined && (typeof output.cutawaySchema!=='string'||typeof output.interiorOrbitSchema!=='string')) throw new TypeError('Cutaway schema declarations are missing.');
  if(output.body!==undefined){const body=object(output.body,'output.body');numbers(body,['axialTiltDegrees','rotationPeriodEarthDays'],'output.body');if(typeof body.rotationDirection!=='string')throw new TypeError('Body rotation direction is missing.');}
  if(output.motion!==undefined){const motion=object(output.motion,'output.motion');numbers(motion,['visualRotationSeconds','physicalSiderealRotationEarthDays'],'output.motion');const speeds=object(motion.speedStates,'output.motion.speedStates');numbers(speeds,Object.keys(speeds),'output.motion.speedStates');}
  if(output.animation!==undefined){const animation=object(output.animation,'output.animation');numbers(animation,['cloudsVisualSeconds','surfaceVisualSeconds'],'output.animation');if(typeof animation.direction!=='string')throw new TypeError('Animation direction is missing.');}
  return value as GeometryProfile;
}
