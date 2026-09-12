/** Explicit offline preview: one neutral shape field, then RGB-only painting of its exact slabs. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { containedPath, sha256, verifiedBytes } from '../../../../../src/preparation/volume/source.js';
import type { VolumeSlices } from '../../../../../src/preparation/volume/slices.js';
import { compileCssVolume } from '../../../../../src/renderers/css/preparation/volume.js';
import { validatePreparedCssVolume } from '../../../../../src/renderers/css/volume/validation.js';
import type { GeometryMap } from '../../alignment/observations-ui/geometry-model.js';
import type { StructureImage } from '../../alignment/observations-ui/structures-model.js';
import { bakeMasterVolumeSlices } from '../master-slices.js';
import { recolorCloudSlices } from '../cloud-material.js';
import { createShapeCloudField, createShapeImageSampler } from './field.js';
import { readShapeCloudSettings } from './model.js';
import { readShapeCloudQuality, shapeCloudSampling, SHAPE_CLOUD_PREPARATION_VERSION } from './quality.js';
import type { ShapeCloudPin, ShapeCloudResult, ShapeCloudSettings, ShapeCloudQuality } from './types.js';

export const SHAPE_CLOUD_METHOD = 'detected-boundary-signed-emission-shapes@2';
export interface ShapeCloudBakeProgress { phase: 'volume' | 'texture' | 'compile'; completed: number; total: number; message: string }
export interface ShapeCloudBakeOptions { signal?: AbortSignal; onProgress?(progress: ShapeCloudBakeProgress): void }
const hash = (value: string) => /^[a-f0-9]{64}$/.test(value);
function cancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Shape cloud preview cancelled.', 'AbortError');
}
async function writePin(root: string, path: string, bytes: Buffer): Promise<ShapeCloudPin> {
  await writeFile(containedPath(root, path), bytes);
  return { path, sha256: sha256(bytes) };
}
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + '\n');

/** Raw alpha identity covers every slab, including fully empty slabs omitted from the render graph. */
async function inspectAlpha(directory: string, slices: VolumeSlices, options: ShapeCloudBakeOptions, projection: boolean) {
  const digest = createHash('sha256'), zQuads = slices.quads.filter(quad => quad.axis === 'z');
  const first = zQuads[0]!;
  const transmission = projection ? new Float64Array(first.widthPx * first.heightPx).fill(1) : null;
  for (const quad of slices.quads) {
    cancellation(options.signal);
    const input = await verifiedBytes(directory, { path: quad.texturePath, sha256: quad.sha256 });
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== quad.widthPx || info.height !== quad.heightPx || info.channels !== 4)
      throw new Error('Shape cloud alpha inspection found changed slice dimensions.');
    const alpha = Buffer.alloc(quad.widthPx * quad.heightPx);
    for (let index = 0; index < alpha.length; index++) {
      alpha[index] = data[4 * index + 3]!;
      if (quad.axis === 'z' && transmission) transmission[index]! *= 1 - alpha[index]! / 255;
    }
    digest.update(alpha);
  }
  let projectionPng: Buffer | undefined;
  if (transmission) {
    const rgba = Buffer.alloc(transmission.length * 4);
    for (let index = 0; index < transmission.length; index++) {
      const at = index * 4;
      rgba[at] = rgba[at + 1] = rgba[at + 2] = 255;
      rgba[at + 3] = Math.round((1 - transmission[index]!) * 255);
    }
    projectionPng = await sharp(rgba, { raw: { width: first.widthPx, height: first.heightPx, channels: 4 } }).png().toBuffer();
  }
  return { alphaSha256: digest.digest('hex'), projectionPng };
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
  const output = containedPath(root, outputDirectory);
  const quality = readShapeCloudQuality(input.quality);
  const settings = readShapeCloudSettings(input.settings, image.width, image.height);
  const field = createShapeCloudField(settings, image.width, image.height);
  const sampling = shapeCloudSampling(quality, field.bounds), total = sampling.slices.x + sampling.slices.y + sampling.slices.z;
  cancellation(options.signal);
  const sourceBytes = await verifiedBytes(root, source);
  const { data: rgb, info } = await sharp(sourceBytes).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== image.width || info.height !== image.height || info.channels !== 3)
    throw new TypeError('Shape cloud source must retain the complete registered working-image pixels.');
  const result: ShapeCloudResult = { schema: 'cssearth-shape-cloud-result@1', id, imageId: image.id,
    preparationVersion: SHAPE_CLOUD_PREPARATION_VERSION,
    sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, geometrySha256: input.geometrySha256,
    width: image.width, height: image.height, unitsPerPixel: field.unitsPerPixel, settings, quality, empty: field.empty, source: { ...source } };
  if (field.empty) return result;
  await mkdir(output, { recursive: true });
  const neutralDirectory = containedPath(output, 'neutral'), texturedDirectory = containedPath(output, 'textured');
  const report = (phase: ShapeCloudBakeProgress['phase'], completed: number, total: number, message: string) => {
    cancellation(options.signal); options.onProgress?.({ phase, completed, total, message });
  };
  const provenance = { schema: 'cssearth-shape-cloud-provenance@1', method: SHAPE_CLOUD_METHOD, source: { ...source },
    sourceSha256: image.sourceSha256, mapSha256: image.mapSha256, geometrySha256: input.geometrySha256, settings, quality, sampling,
    projection: { width: image.width, height: image.height, unitsPerPixel: field.unitsPerPixel,
      pixelEdgeToUnits: ['(x-width/2)*unitsPerPixel', '(height/2-y)*unitsPerPixel', '0'] },
    interpretation: 'Automatically grouped projected boundaries seed editable shells, rings or filled ellipsoids. Nonnegative emission is max(0, sum(add terms) - sum(subtract terms)). Depth, wall thickness, softness and weights are authored assumptions, not recovered gas density. No photograph column normalization.',
    extent: 'Complete finite emission support retained; empty photo margins are excluded from sampling bounds. Full source registration is unchanged. Colors do not select support or alter depth.',
    coordinateMeaning: 'Image-relative dimensionless display units. No measured distance, physical size or 3D sky orientation.' };
  report('volume', 0, total, 'Preparing the shared neutral shape cloud');
  let samples = 0;
  const { masters } = await bakeMasterVolumeSlices({ sampleEmission(x, y, z, out) {
    if (++samples % 65536 === 0) cancellation(options.signal);
    field.sampleEmission(x, y, z, out);
  }, boundsKpc: field.bounds, sliceCounts: sampling.slices, samplesPerSlab: sampling.samples,
  exposureGain: settings.exposure, masterWidth: sampling.width, masterDirectory: neutralDirectory, deliveryBanks: [],
  unitsPerSourceUnit: 1, provenance, cropTransparent: false, allowEmpty: true,
  onProgress: progress => report('volume', progress.completed, progress.total, `Preparing ${progress.axis.toUpperCase()} cloud slabs`) });
  if (masters.quads.every(quad => quad.alphaCoverage === 0)) return { ...result, empty: true };
  const neutralAlpha = await inspectAlpha(neutralDirectory, masters, options, true);
  masters.provenance = { ...provenance, alphaSha256: neutralAlpha.alphaSha256 };
  await writeFile(containedPath(neutralDirectory, 'volume-slices.json'), json(masters));
  report('texture', 0, total, 'Painting source colors onto the same cloud');
  const painted = await recolorCloudSlices({ slices: masters, loadResource: path => readFile(containedPath(neutralDirectory, path)),
    sampleImageRgb: createShapeImageSampler(rgb, image.width, image.height), outputDirectory: texturedDirectory, encoding: { format: 'png' },
    onProgress: progress => report('texture', progress.completed, progress.total, 'Painting source colors; preserving every alpha byte') });
  const texturedAlpha = await inspectAlpha(texturedDirectory, painted.slices, options, false);
  if (texturedAlpha.alphaSha256 !== neutralAlpha.alphaSha256) throw new Error('Textured shape cloud changed the neutral geometry alpha.');
  painted.slices.provenance = { ...provenance, alphaSha256: neutralAlpha.alphaSha256, material: painted.slices.provenance,
    coverage: painted.coverage };
  await writeFile(containedPath(texturedDirectory, 'volume-slices.json'), json(painted.slices));
  const frame: DensityVolumeFrame = { referenceFrame: 'lab-image-relative-unscaled', epochJdTt: 2451545,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: field.bounds };
  report('compile', 0, 2, 'Preparing the retained PolyCSS scene');
  for (const [index, [name, slices]] of ( [['neutral', masters], ['textured', painted.slices]] as const ).entries()) {
    cancellation(options.signal);
    const data = compileCssVolume({ id: `shape-cloud-${id}`, frame, slices, recipe: { anchors: [] } });
    validatePreparedCssVolume(data);
    const path = relative(root, containedPath(output, `${name}/volume.json`));
    result[name] = await writePin(root, path, json(data));
    report('compile', index + 1, 2, 'Prepared cloud and texture share one geometry');
  }
  if (neutralAlpha.projectionPng) result.projection = await writePin(root, relative(root, containedPath(output, 'projection.png')), neutralAlpha.projectionPng);
  cancellation(options.signal);
  return result;
}
