/** Fixed celestial cube projection and linear-light resampling, prepared before runtime. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { Vector3 } from '../volume/config.js';
import { sha256, verifiedBytes } from '../volume/source.js';
import type { SkyRecipe } from './config.js';
import { loadSkySource, HALF_LINEAR } from './source.js';
import type { LinearHalfImage } from './exr.js';
export interface SkyBasis { id: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'; forwardIcrf: Vector3; rightIcrf: Vector3; upIcrf: Vector3; }
export const SKY_BASES: readonly SkyBasis[] = [
  { id: 'px', forwardIcrf: [1, 0, 0], rightIcrf: [0, -1, 0], upIcrf: [0, 0, 1] },
  { id: 'nx', forwardIcrf: [-1, 0, 0], rightIcrf: [0, 1, 0], upIcrf: [0, 0, 1] },
  { id: 'py', forwardIcrf: [0, 1, 0], rightIcrf: [1, 0, 0], upIcrf: [0, 0, 1] },
  { id: 'ny', forwardIcrf: [0, -1, 0], rightIcrf: [-1, 0, 0], upIcrf: [0, 0, 1] },
  { id: 'pz', forwardIcrf: [0, 0, 1], rightIcrf: [0, -1, 0], upIcrf: [-1, 0, 0] },
  { id: 'nz', forwardIcrf: [0, 0, -1], rightIcrf: [0, -1, 0], upIcrf: [1, 0, 0] },
];
export interface BakedSkyFace extends SkyBasis {
  texturePath: string; widthPx: number; heightPx: number; sha256: string; bytes: number;
  vertices: Vector3[]; uvs: [number, number][];
}
export interface BakedSky { faces: BakedSkyFace[]; provenance: unknown; approximation: unknown; }
/** u runs left→right, v runs bottom→top; values ±1 reach exact cube edges. */
export function skyRay(basis: SkyBasis, u: number, v: number): Vector3 {
  const ray = basis.forwardIcrf.map((f, i) => f + u * basis.rightIcrf[i]! + v * basis.upIcrf[i]!) as Vector3;
  const length = Math.hypot(...ray); return ray.map(n => n / length) as Vector3;
}
export function skyUv(ray: Vector3): [number, number] {
  const u = 0.5 - Math.atan2(ray[1], ray[0]) / (2 * Math.PI);
  return [u - Math.floor(u), 0.5 - Math.asin(Math.max(-1, Math.min(1, ray[2]))) / Math.PI];
}
export function sampleLinearSky(source: LinearHalfImage, u: number, v: number, out: Vector3): void {
  const fx = ((u % 1 + 1) % 1) * source.width - 0.5, fy = Math.max(0, Math.min(source.height - 1, v * source.height - 0.5));
  const floorX = Math.floor(fx), x0 = (floorX + source.width) % source.width, x1 = (x0 + 1) % source.width;
  const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, source.height - 1), ax = fx - floorX, ay = fy - y0;
  const offsets = [(y0 * source.width + x0) * 6, (y0 * source.width + x1) * 6, (y1 * source.width + x0) * 6, (y1 * source.width + x1) * 6];
  for (let c = 0; c < 3; c++) {
    const a = HALF_LINEAR[source.rgb16f.readUInt16LE(offsets[0]! + c * 2)]!, b = HALF_LINEAR[source.rgb16f.readUInt16LE(offsets[1]! + c * 2)]!;
    const d = HALF_LINEAR[source.rgb16f.readUInt16LE(offsets[2]! + c * 2)]!, e = HALF_LINEAR[source.rgb16f.readUInt16LE(offsets[3]! + c * 2)]!;
    out[c] = (a + ax * (b - a)) * (1 - ay) + (d + ax * (e - d)) * ay;
  }
}
export function displayByte(linear: number, exposure: number, displayGain = 1): number {
  const c = Math.max(0, Math.min(1, linear * exposure));
  // Display attenuation follows the original transfer, equally in each RGB channel.
  const srgb = c === 1 ? 1 : c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(255 * displayGain * srgb);
}
export function skyFacePixels(source: LinearHalfImage, basis: SkyBasis, bake: SkyRecipe['bake']): Buffer {
  const size = bake.faceSize, rgba = Buffer.alloc(size * size * 4, 255), rgb: Vector3 = [0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ray = skyRay(basis, 2 * (x + 0.5) / size - 1, 1 - 2 * (y + 0.5) / size), [u, v] = skyUv(ray);
    sampleLinearSky(source, u, v, rgb);
    for (let c = 0; c < 3; c++) rgba[(y * size + x) * 4 + c] = displayByte(rgb[c]!, bake.exposure, bake.displayGain);
  }
  return rgba;
}
export async function prepareSkyFaces(options: { sourceDirectory: string; outputDirectory: string; recipe: SkyRecipe }): Promise<BakedSky> {
  const { sourceDirectory, outputDirectory, recipe } = options, source = await loadSkySource(sourceDirectory, recipe);
  const provenance: unknown = JSON.parse((await verifiedBytes(sourceDirectory, recipe.provenance)).toString('utf8'));
  const size = recipe.bake.faceSize, faces: BakedSkyFace[] = [];
  await mkdir(resolve(outputDirectory, 'sky'), { recursive: true });
  for (const basis of SKY_BASES) {
    const rgba = skyFacePixels(source, basis, recipe.bake);
    const bytes = await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).webp({ quality: recipe.bake.webpQuality, alphaQuality: 100, effort: 5, smartSubsample: true }).toBuffer();
    const texturePath = `sky/${basis.id}.webp`; await writeFile(resolve(outputDirectory, texturePath), bytes);
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const;
    const vertices = corners.map(([u, v]) => basis.forwardIcrf.map((f, i) => f + u * basis.rightIcrf[i]! + v * basis.upIcrf[i]!) as Vector3);
    faces.push({ ...basis, texturePath, widthPx: size, heightPx: size, sha256: sha256(bytes), bytes: bytes.length,
      vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    console.log(`Prepared sky ${basis.id}: ${size}×${size}, ${bytes.length} bytes`);
  }
  return { faces, provenance, approximation: { sourceProjection: recipe.projection, resampling: 'pixel-center bilinear in linear RGB HALF radiance; periodic RA, clamped declination',
    display: { ...recipe.bake, photometricCalibration: false }, translation: 'distant celestial directions, observer translation ignored',
    geometry: 'six opaque cube images; exact ICRF bases and source UVs; display transfer fixed offline' } };
}
