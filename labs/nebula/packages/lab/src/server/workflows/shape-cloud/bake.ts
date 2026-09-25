import {bakePaintedField} from '@cssearth/volume-bake/slices/painted-field';
/** Explicit offline preview: one neutral shape field, then RGB-only painting of its exact slabs. */
import { isAbsolute } from 'node:path';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import type { GeometryMap } from '../../../features/observations/models/geometry-model.ts';
import type { StructureImage } from '../../../features/observations/models/structures-model.ts';
import { createShapeCloudField, createShapeImageSampler } from '@cssearth/bake/volume';
import { readShapeCloudSettings } from '../../../features/shape-cloud/model.ts';
import { readShapeCloudQuality, shapeCloudSampling, SHAPE_CLOUD_PREPARATION_VERSION } from '../../../features/shape-cloud/quality.ts';
import { writeShapeComparison } from './comparison-artifacts.ts';
import type { ShapeCloudPin, ShapeCloudResult, ShapeCloudSettings, ShapeCloudQuality } from '../../../features/shape-cloud/types.ts';

export const SHAPE_CLOUD_METHOD = 'detected-boundary-signed-emission-shapes@2';
export interface ShapeCloudBakeProgress { phase: 'volume' | 'texture' | 'compile' | 'comparison'; completed: number; total: number; message: string }
export interface ShapeCloudBakeOptions { signal?: AbortSignal; onProgress?(progress: ShapeCloudBakeProgress): void }
const hash = (value: string) => /^[a-f0-9]{64}$/.test(value);
function cancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Shape cloud preview cancelled.', 'AbortError');
}
export async function bakeShapeCloud(input: {
  root: string; outputDirectory: string; id: string; image: StructureImage; geometry: GeometryMap;
  geometrySha256: string; settings: ShapeCloudSettings; source: ShapeCloudPin; quality?: ShapeCloudQuality;
}, options: ShapeCloudBakeOptions = {}): Promise<ShapeCloudResult> {
  const { root, image, geometry, source, outputDirectory, id } = input;
  if (!isAbsolute(root) || isAbsolute(outputDirectory) || !outputDirectory || !hash(id) ||
      !hash(input.geometrySha256) || !hash(source.sha256) || !hash(image.mapSha256) || !hash(image.sourceSha256) ||
      geometry.width !== image.width || geometry.height !== image.height || image.width * image.height > 1_000_000)
    throw new TypeError('Invalid shape cloud source or output identity.');
  const quality = readShapeCloudQuality(input.quality);
  const settings = readShapeCloudSettings(input.settings, image.width, image.height);
  const field = createShapeCloudField(settings, image.width, image.height);
  const sampling = shapeCloudSampling(quality, field.bounds);
  cancellation(options.signal);
  const imageBytes = await sourceBytes(root, source);
  const { data: rgb, info } = await sharp(imageBytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== image.width || info.height !== image.height || info.channels !== 3)
    throw new TypeError('Shape cloud source must retain the complete registered working-image pixels.');
  const result: ShapeCloudResult = { schema: 'cssearth-shape-cloud-result@1', id, imageId: image.id,
    preparationVersion: SHAPE_CLOUD_PREPARATION_VERSION,
    sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, geometrySha256: input.geometrySha256,
    width: image.width, height: image.height, unitsPerPixel: field.unitsPerPixel, settings, quality, empty: field.empty, source: { ...source } };
  const compare = async (projection?: { alpha: Float32Array; width: number; height: number }) => {
    options.onProgress?.({ phase: 'comparison', completed: 0, total: 1, message: 'Comparing neutral structure and source luminosity' });
    result.comparison = await writeShapeComparison({ root, directory: outputDirectory, rgb, width: image.width, height: image.height,
      projection: projection ? { ...projection, bounds: field.bounds } : undefined, signal: options.signal });
    options.onProgress?.({ phase: 'comparison', completed: 1, total: 1, message: 'Prepared grayscale structure comparison' });
    return result;
  };
  if (field.empty) return compare();
  const provenance = { schema: 'cssearth-shape-cloud-provenance@1', method: SHAPE_CLOUD_METHOD, source: { ...source },
    sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, geometrySha256: input.geometrySha256, settings, quality, sampling,
    projection: { width: image.width, height: image.height, unitsPerPixel: field.unitsPerPixel,
      pixelEdgeToUnits: ['(x-width/2)*unitsPerPixel', '(height/2-y)*unitsPerPixel', '0'] },
    interpretation: 'Automatically grouped projected boundaries seed editable shells, rings or filled ellipsoids. Nonnegative emission is max(0, sum(add terms) - sum(subtract terms)). Depth, wall thickness, softness and weights are authored assumptions, not recovered gas density. No photograph column normalization.',
    extent: 'Complete finite emission support retained; empty photo margins are excluded from sampling bounds. Full source registration is unchanged. Colors do not select support or alter depth.',
    coordinateMeaning: 'Image-relative dimensionless display units. No measured distance, physical size or 3D sky orientation.' };
  const frame: DensityVolumeFrame = { referenceFrame: 'lab-image-relative-unscaled', epochJdTt: 2451545,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: field.bounds };
  const prepared = await bakePaintedField({root,outputDirectory,volumeId:`shape-cloud-${id}`,frame,bounds:field.bounds,
    sampleEmission:field.sampleEmission,sampleImageRgb:createShapeImageSampler(rgb,image.width,image.height),
    exposure:settings.exposure,sampling,provenance},{compileVolume:input=>{
      const data=compileCssVolume({...input,recipe:{anchors:[]}});validatePreparedCssVolume(data);return data;
    }},options);
  if(prepared.empty){result.empty=true;return compare();}
  result.neutral=prepared.neutral;result.textured=prepared.textured;result.projection=prepared.projection;
  return compare(prepared.projectedAlpha);
}
