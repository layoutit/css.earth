/** Verified offline RGBA8/Zstd density-grid loading; no object names or sibling checkout paths. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import { resolve, relative, isAbsolute } from 'node:path';
import type { VolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
export interface DecodedGrid { width: number; height: number; depth: number; encodedRgba: Uint8Array; }
export interface VolumeSource extends DecodedGrid {
  recipe: VolumeRecipe;
  provenance: unknown;
}
export const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
export function containedPath(root: string, path: string): string {
  const resolved = resolve(root, path), offset = relative(root, resolved);
  if (isAbsolute(offset) || offset === '..' || offset.startsWith('../') || offset.startsWith('..\\')) throw new TypeError('Source escapes its object directory.');
  return resolved;
}
export async function sourceBytes(root: string, reference: { path: string }): Promise<Buffer> {
  return readFile(containedPath(root, reference.path));
}
export function decodeDensityKtx2(bytes: Buffer): DecodedGrid {
  const identifier = Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex');
  if (bytes.length < 104 || !bytes.subarray(0, 12).equals(identifier)) throw new Error('Invalid KTX2 header');
  if (bytes.readUInt32LE(12) !== 37 || bytes.readUInt32LE(16) !== 1 || bytes.readUInt32LE(32) !== 0 ||
    bytes.readUInt32LE(36) !== 1 || bytes.readUInt32LE(40) !== 1 || bytes.readUInt32LE(44) !== 2) {
    throw new Error('Expected single-level non-array RGBA8 KTX2 volume compressed with Zstd');
  }
  const width = bytes.readUInt32LE(20), height = bytes.readUInt32LE(24), depth = bytes.readUInt32LE(28);
  if (!width || !height || !depth) throw new Error('Density grid dimensions must be positive.');
  const offset = Number(bytes.readBigUInt64LE(80)), length = Number(bytes.readBigUInt64LE(88));
  const rawLength = Number(bytes.readBigUInt64LE(96));
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 104 ||
    offset + length > bytes.length || rawLength !== width * height * depth * 4) throw new Error('Invalid KTX2 level bounds');
  const encodedRgba = zstdDecompressSync(bytes.subarray(offset, offset + length));
  if (encodedRgba.length !== rawLength) throw new Error('Decoded density byte length mismatch');
  return { width, height, depth, encodedRgba };
}
export async function loadVolumeSource(sourceDirectory: string, recipe: VolumeRecipe): Promise<VolumeSource> {
  const bytes = await sourceBytes(sourceDirectory, recipe.grid);
  const decoded = decodeDensityKtx2(bytes);
  const [width, height, depth] = recipe.grid.dimensions;
  if (decoded.width !== width || decoded.height !== height || decoded.depth !== depth) throw new TypeError('KTX2 dimensions disagree with the source recipe.');
  const provenanceBytes = await sourceBytes(sourceDirectory, recipe.provenance);
  const provenance: unknown = JSON.parse(provenanceBytes.toString('utf8'));
  return { ...decoded, recipe, provenance };
}
/** Clamp-to-edge trilinear encoded sampling. Apply channel transfer AFTER filtering. */
export function sampleEncoded(source: VolumeSource, x: number, y: number, z: number, out: [number, number, number, number]): void {
  const { min, max } = source.recipe.grid.bounds;
  if (x < min[0] || x > max[0] || y < min[1] || y > max[1] || z < min[2] || z > max[2]) {
    out[0] = out[1] = out[2] = out[3] = 0; return;
  }
  const fx = Math.max(0, Math.min(source.width - 1, ((x - min[0]) / (max[0] - min[0])) * source.width - 0.5));
  const fy = Math.max(0, Math.min(source.height - 1, ((y - min[1]) / (max[1] - min[1])) * source.height - 0.5));
  const fz = Math.max(0, Math.min(source.depth - 1, ((z - min[2]) / (max[2] - min[2])) * source.depth - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, source.width - 1), y1 = Math.min(y0 + 1, source.height - 1), z1 = Math.min(z0 + 1, source.depth - 1);
  const ax = fx - x0, ay = fy - y0, az = fz - z0;
  const b = source.encodedRgba, w = source.width, h = source.height;
  for (let c = 0; c < 4; c++) {
    const a = b[4 * ((z0 * h + y0) * w + x0) + c] ?? 0;
    const b0 = b[4 * ((z0 * h + y0) * w + x1) + c] ?? 0;
    const c0 = b[4 * ((z0 * h + y1) * w + x0) + c] ?? 0;
    const d = b[4 * ((z0 * h + y1) * w + x1) + c] ?? 0;
    const e = b[4 * ((z1 * h + y0) * w + x0) + c] ?? 0;
    const f = b[4 * ((z1 * h + y0) * w + x1) + c] ?? 0;
    const g = b[4 * ((z1 * h + y1) * w + x0) + c] ?? 0;
    const i = b[4 * ((z1 * h + y1) * w + x1) + c] ?? 0;
    out[c] = ((1 - az) * ((1 - ay) * (a + ax * (b0 - a)) + ay * (c0 + ax * (d - c0))) +
      az * ((1 - ay) * (e + ax * (f - e)) + ay * (g + ax * (i - g)))) / 255;
  }
}
