/** Fixed celestial cube projection and linear-light resampling, prepared before runtime. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { Vector3 } from '@cssearth/bake/volume';
import { sourceBytes } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';
import type { SkyRecipe } from './config.js';
import { loadSkySource, HALF_LINEAR } from './source.js';
import type { LinearHalfImage } from './exr.js';
import { loadPreparedCssPointField } from '@cssearth/renderer/stars/loader.ts';
import { pointLuminanceVisible, pointPhotometry } from '@cssearth/renderer/stars/point-field-projection.ts';
import type { PreparedCssPointField } from '@cssearth/renderer/stars/types.ts';
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
export interface BakedSky {
  faces: BakedSkyFace[]; provenance: unknown; approximation: unknown; parallax?: SkyRecipe['parallax'];
  /** The same cube with the sibling point field composited, valid where its parallax is invisible. */
  nearFaces?: BakedSkyFace[]; stars?: { objectId: string; cssPixelsPerDegree: number };
}
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
function transferredDisplay(linear: number, exposure: number): number {
  const c = Math.max(0, Math.min(1, linear * exposure));
  return c === 1 ? 1 : c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}
export function displayByte(linear: number, exposure: number, displayGain = 1): number {
  // Display attenuation follows the original transfer, equally in each RGB channel.
  return Math.round(255 * displayGain * transferredDisplay(linear, exposure));
}
export function skyFacePixels(source: LinearHalfImage, basis: SkyBasis, bake: SkyRecipe['bake']): Buffer {
  const size = bake.faceSize, rgba = Buffer.alloc(size * size * 4, 255), rgb: Vector3 = [0, 0, 0], displayRgb: Vector3 = [0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ray = skyRay(basis, 2 * (x + 0.5) / size - 1, 1 - 2 * (y + 0.5) / size), [u, v] = skyUv(ray);
    sampleLinearSky(source, u, v, rgb);
    if (!bake.shadowFloor) {
      for (let c = 0; c < 3; c++) rgba[(y * size + x) * 4 + c] = displayByte(rgb[c]!, bake.exposure, bake.displayGain);
      continue;
    }
    for (let c = 0; c < 3; c++) displayRgb[c] = transferredDisplay(rgb[c]!, bake.exposure);
    // This is ordinary transferred display RGB luminance, not radiometric luminance.
    const luminance = displayRgb[0] * .2126 + displayRgb[1] * .7152 + displayRgb[2] * .0722;
    const t = Math.max(0, Math.min(1, (luminance - bake.shadowFloor.blackPoint) /
      (bake.shadowFloor.fullSignal - bake.shadowFloor.blackPoint)));
    const commonGain = (bake.displayGain ?? 1) * t * t * (3 - 2 * t);
    for (let c = 0; c < 3; c++) rgba[(y * size + x) * 4 + c] = Math.round(255 * commonGain * displayRgb[c]!);
  }
  return rgba;
}
/** The runtime sprite of one star: its atlas tile scaled to the halo diameter at
 * `luminance` opacity. Baking draws exactly that, source-over in display RGB, at the
 * gnomonic scale of each face. Parallax is absent, so the runtime only shows these
 * faces while the observer sits where the field's own parallax is invisible. */
export interface SkyStarSprites { field: PreparedCssPointField; atlas: { rgba: Buffer; width: number; height: number }; cssPixelsPerDegree: number; }
export async function loadSkyStarSprites(objectDirectory: string, stars: NonNullable<SkyRecipe['stars']>): Promise<SkyStarSprites> {
  const descriptorBytes = await readFile(resolve(objectDirectory, 'object.json'));
  const descriptor: unknown = JSON.parse(descriptorBytes.toString('utf8'));
  const read = async (url: string) => { const b = await readFile(resolve(objectDirectory, url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
  const field = await loadPreparedCssPointField(descriptor, { read });
  if (field.id !== stars.object) throw new TypeError('Sky stars descriptor id differs from the recipe.');
  const atlasResource = field.resources.find(resource => resource.path === field.atlas.path);
  const atlasBytes = await readFile(resolve(objectDirectory, 'prepared', field.atlas.path));
  if (!atlasResource || sha256(atlasBytes) !== atlasResource.sha256) throw new TypeError('Sky stars atlas digest mismatch.');
  const { data, info } = await sharp(atlasBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== field.atlas.tileSize * field.atlas.columns || info.height !== field.atlas.tileSize) throw new TypeError('Sky stars atlas shape differs from its manifest.');
  return { field, atlas: { rgba: data, width: info.width, height: info.height }, cssPixelsPerDegree: stars.cssPixelsPerDegree };
}
const SUPERSAMPLE = 3;
/** Composites the field seen from its origin onto one face; a sprite spanning an edge lands on both faces. */
export function compositeSkyStars(rgba: Buffer, size: number, basis: SkyBasis, sprites: SkyStarSprites): number {
  const { field, atlas } = sprites, tile = field.atlas.tileSize, halfSize = size / 2;
  // Face pixels per CSS pixel at the face centre; the gnomonic scale grows by 1+u²+v² outward.
  const centreScale = halfSize / (sprites.cssPixelsPerDegree * 180 / Math.PI);
  const origin: [number, number, number] = [0, 0, 0];
  let drawn = 0;
  for (const star of field.stars) {
    const p = star.positionUnits, forward = p[0] * basis.forwardIcrf[0] + p[1] * basis.forwardIcrf[1] + p[2] * basis.forwardIcrf[2];
    if (forward <= 0) continue;
    const u = (p[0] * basis.rightIcrf[0] + p[1] * basis.rightIcrf[1] + p[2] * basis.rightIcrf[2]) / forward;
    const v = (p[0] * basis.upIcrf[0] + p[1] * basis.upIcrf[1] + p[2] * basis.upIcrf[2]) / forward;
    if (Math.abs(u) > 1.5 || Math.abs(v) > 1.5) continue;
    const light = pointPhotometry(field, star.absoluteMagnitude, Math.hypot(p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]), star.coverageAnchor);
    if (!pointLuminanceVisible(light.luminance, star.coverageAnchor)) continue;
    const spriteCss = light.radiusPx * 2 * field.atlas.haloRadii, spritePx = spriteCss * centreScale * (1 + u * u + v * v);
    const cx = (u + 1) * halfSize - .5, cy = (1 - v) * halfSize - .5, half = spritePx / 2;
    const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(size - 1, Math.ceil(cx + half)), y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(size - 1, Math.ceil(cy + half));
    if (x0 > x1 || y0 > y1) continue;
    const color = field.atlas.colors[star.colorIndex]!, tileX = star.colorIndex * tile;
    drawn++;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let coverage = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) for (let sx = 0; sx < SUPERSAMPLE; sx++) {
        // Face sample → sprite box → tile, sampled as the compositor scales the tile:
        // nothing outside the box, bilinear alpha clamped to the tile's edge inside it.
        const fx = (x + (sx + .5) / SUPERSAMPLE - (cx + .5)) / spritePx + .5, fy = (y + (sy + .5) / SUPERSAMPLE - (cy + .5)) / spritePx + .5;
        if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) continue;
        coverage += tileAlpha(atlas, tileX, fx * tile - .5, fy * tile - .5, tile);
      }
      const alpha = light.luminance * coverage / (SUPERSAMPLE * SUPERSAMPLE);
      if (alpha <= 0) continue;
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) rgba[offset + c] = Math.round(rgba[offset + c]! + (color[c]! - rgba[offset + c]!) * alpha);
    }
  }
  return drawn;
}
function tileAlpha(atlas: SkyStarSprites['atlas'], tileX: number, tx: number, ty: number, tile: number): number {
  const x0 = Math.floor(tx), y0 = Math.floor(ty), ax = tx - x0, ay = ty - y0;
  const at = (x: number, y: number) => atlas.rgba[(Math.max(0, Math.min(tile - 1, y)) * atlas.width + tileX + Math.max(0, Math.min(tile - 1, x))) * 4 + 3]! / 255;
  return (at(x0, y0) * (1 - ax) + at(x0 + 1, y0) * ax) * (1 - ay) + (at(x0, y0 + 1) * (1 - ax) + at(x0 + 1, y0 + 1) * ax) * ay;
}
export async function prepareSkyFaces(options: { sourceDirectory: string; outputDirectory: string; recipe: SkyRecipe; stars?: SkyStarSprites }): Promise<BakedSky> {
  const { sourceDirectory, outputDirectory, recipe, stars } = options, source = await loadSkySource(sourceDirectory, recipe);
  const provenance: unknown = JSON.parse((await sourceBytes(sourceDirectory, recipe.provenance)).toString('utf8'));
  const size = recipe.bake.faceSize, faces: BakedSkyFace[] = [], nearFaces: BakedSkyFace[] = [];
  await mkdir(resolve(outputDirectory, 'sky'), { recursive: true });
  if (stars) await mkdir(resolve(outputDirectory, 'sky-near'), { recursive: true });
  const encode = async (basis: SkyBasis, rgba: Buffer, texturePath: string): Promise<BakedSkyFace> => {
    const bytes = await sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).webp({ quality: recipe.bake.webpQuality, alphaQuality: 100, effort: 5, smartSubsample: true }).toBuffer();
    await writeFile(resolve(outputDirectory, texturePath), bytes);
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const;
    const vertices = corners.map(([u, v]) => basis.forwardIcrf.map((f, i) => f + u * basis.rightIcrf[i]! + v * basis.upIcrf[i]!) as Vector3);
    return { ...basis, texturePath, widthPx: size, heightPx: size, sha256: sha256(bytes), bytes: bytes.length, vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  };
  for (const basis of SKY_BASES) {
    const rgba = skyFacePixels(source, basis, recipe.bake);
    const face = await encode(basis, rgba, `sky/${basis.id}.webp`);
    faces.push(face);
    console.log(`Prepared sky ${basis.id}: ${size}×${size}, ${face.bytes} bytes`);
    if (!stars) continue;
    const drawn = compositeSkyStars(rgba, size, basis, stars);
    const near = await encode(basis, rgba, `sky-near/${basis.id}.webp`);
    nearFaces.push(near);
    console.log(`Prepared near sky ${basis.id}: ${drawn} stars, ${near.bytes} bytes`);
  }
  return { faces, provenance, ...(recipe.parallax ? { parallax: recipe.parallax } : {}),
    ...(stars ? { nearFaces, stars: { objectId: stars.field.id, cssPixelsPerDegree: stars.cssPixelsPerDegree } } : {}),
    approximation: { sourceProjection: recipe.projection, resampling: 'pixel-center bilinear in linear RGB HALF radiance; periodic RA, clamped declination',
    display: { ...recipe.bake, photometricCalibration: false }, translation: recipe.parallax ? 'fixed finite panorama cube at authored origin and radius; inferred display depth, not measured source depth' : 'distant celestial directions, observer translation ignored',
    geometry: 'six opaque cube images; exact ICRF bases and source UVs; display transfer fixed offline',
    ...(stars ? { stars: `${stars.field.id} sprites seen from its origin, composited source-over in display RGB at ${stars.cssPixelsPerDegree} CSS px/degree; no parallax` } : {}) } };
}
