/** Offline material replacement on an Alignment prepared cloud; geometry and opacity are immutable. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { encodeVolumeRaster } from '../../../../src/preparation/volume/raster.js';
import { containedPath, sha256 } from '../../../../src/preparation/volume/source.js';
import type { VolumeImageEncoding, Vector3 } from '../../../../src/preparation/volume/config.js';
import type { VolumeSlices, VolumeSliceQuad } from '../../../../src/preparation/volume/slices.js';

export const CLOUD_MATERIAL_METHOD = 'density-opacity-image-chromaticity@1';
export interface CloudMaterialCoverage {
  positiveAlphaTexels: number;
  recoloredTexels: number;
  outsideImageTexels: number;
  blackImageTexels: number;
  preservedReferenceTexels: number;
}
export interface CloudMaterialOptions {
  slices: VolumeSlices;
  loadResource(path: string): Promise<Uint8Array>;
  /** Physical coordinates in the unchanged quad units. RGB is [0,255]; false means outside image coverage. */
  sampleImageRgb(x: number, y: number, z: number, out: Vector3): boolean;
  outputDirectory: string;
  encoding?: VolumeImageEncoding;
  onProgress?(progress: { completed: number; total: number }): void;
}

/**
 * Paint candidate image chromaticity onto the Alignment cloud's exact alpha.
 * Image brightness never becomes new density. Outside coverage (or where RGB
 * is zero and has no chromaticity), keep the reference material explicitly.
 */
export async function recolorCloudSlices(options: CloudMaterialOptions): Promise<{
  slices: VolumeSlices; coverage: CloudMaterialCoverage;
}> {
  const encoding = options.encoding ?? { format: 'webp' as const, quality: 92 };
  if (!['png', 'webp'].includes(encoding.format) || (encoding.quality !== undefined &&
      (!Number.isInteger(encoding.quality) || encoding.quality < 1 || encoding.quality > 100)))
    throw new TypeError('Cloud material requires PNG or valid-quality WebP.');
  if (!options.slices.quads.length) throw new TypeError('Cloud material requires an accepted slice bank.');
  const coverage: CloudMaterialCoverage = { positiveAlphaTexels: 0, recoloredTexels: 0,
    outsideImageTexels: 0, blackImageTexels: 0, preservedReferenceTexels: 0 };
  const quads: VolumeSliceQuad[] = [], outputPaths = new Set<string>(), rgb: Vector3 = [0, 0, 0];
  for (const quad of options.slices.quads) {
    const input = Buffer.from(await options.loadResource(quad.texturePath));
    if (input.length !== quad.bytes || sha256(input) !== quad.sha256) throw new TypeError(`Accepted cloud texture changed: ${quad.texturePath}.`);
    const { data: source, info } = await sharp(input).ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
    if (info.width !== quad.widthPx || info.height !== quad.heightPx || info.channels !== 4)
      throw new TypeError(`Accepted cloud texture dimensions/format changed: ${quad.texturePath}.`);
    if (quad.vertices.length !== 4 || quad.vertices.some(vertex => vertex.length !== 3 || vertex.some(value => !Number.isFinite(value))))
      throw new TypeError('Accepted cloud quad coordinates must be finite.');
    const rgba = Buffer.from(source), [origin, horizontal, , vertical] = quad.vertices;
    for (let row = 0; row < info.height; row++) for (let column = 0; column < info.width; column++) {
      const offset = (row * info.width + column) * 4;
      if (!source[offset + 3]) continue;
      coverage.positiveAlphaTexels++;
      const u = (column + .5) / info.width, v = (row + .5) / info.height;
      const x = origin[0] + u * (horizontal[0] - origin[0]) + v * (vertical[0] - origin[0]);
      const y = origin[1] + u * (horizontal[1] - origin[1]) + v * (vertical[1] - origin[1]);
      const z = origin[2] + u * (horizontal[2] - origin[2]) + v * (vertical[2] - origin[2]);
      rgb[0] = rgb[1] = rgb[2] = 0;
      if (!options.sampleImageRgb(x, y, z, rgb)) { coverage.outsideImageTexels++; continue; }
      if (rgb.some(value => !Number.isFinite(value) || value < 0 || value > 255))
        throw new TypeError('Cloud image samples must be finite RGB in [0,255].');
      const peak = Math.max(...rgb);
      if (peak === 0) { coverage.blackImageTexels++; continue; }
      for (let channel = 0; channel < 3; channel++) rgba[offset + channel] = Math.round(rgb[channel]! / peak * 255);
      coverage.recoloredTexels++;
    }
    const texturePath = quad.texturePath.replace(/\.[^/.]+$/, '') + '.' + encoding.format;
    const outputPath = containedPath(options.outputDirectory, texturePath);
    if (outputPaths.has(outputPath)) throw new TypeError('Cloud material output textures must be unique.');
    outputPaths.add(outputPath);
    const bytes = await encodeVolumeRaster({ rgba, width: info.width, height: info.height,
      crop: { left: 0, top: 0, width: info.width, height: info.height }, encoding });
    const { data: decoded, info: decodedInfo } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (decodedInfo.width !== info.width || decodedInfo.height !== info.height || decodedInfo.channels !== 4 || decoded.length !== source.length)
      throw new Error('Recoloring changed Alignment cloud texture dimensions.');
    for (let offset = 3; offset < source.length; offset += 4) if (decoded[offset] !== source[offset])
      throw new Error(`Recoloring changed Alignment cloud alpha: ${quad.texturePath}.`);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
    quads.push({ ...structuredClone(quad), texturePath, sha256: sha256(bytes), bytes: bytes.length });
    options.onProgress?.({ completed: quads.length, total: options.slices.quads.length });
  }
  coverage.preservedReferenceTexels = coverage.outsideImageTexels + coverage.blackImageTexels;
  const slices: VolumeSlices = { ...structuredClone(options.slices), quads,
    provenance: { schema: 'cssearth-cloud-material@1', method: CLOUD_MATERIAL_METHOD,
      reference: options.slices.provenance, coverage,
      opacity: 'Every decoded reference alpha byte is preserved exactly; no geometry, crop, extent or depth change.',
      color: 'Candidate RGB divided by its maximum channel supplies chromaticity only. Image brightness does not define density.',
      fallback: 'Uncovered or zero-RGB pixels retain decoded neutral density RGB. Lossy delivery may re-encode RGB; alpha remains exact.' },
    approximation: { ...structuredClone(options.slices.approximation),
      method: `${options.slices.approximation.method} Material: ${CLOUD_MATERIAL_METHOD}.`,
      limitations: [...options.slices.approximation.limitations,
        'This is material replacement on the accepted reference cloud, not new geometry inference. Uncovered/black image regions retain neutral density color.'] } };
  await mkdir(options.outputDirectory, { recursive: true });
  await writeFile(containedPath(options.outputDirectory, 'volume-slices.json'), JSON.stringify(slices, null, 2) + '\n');
  return { slices, coverage };
}
