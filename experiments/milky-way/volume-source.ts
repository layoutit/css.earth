/** Offline-only decoder for the pinned Galaxio square-root density texture. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import path from 'node:path';

export type Vector3 = [number, number, number];
export interface VolumeComponent {
  color: Vector3;
  strength: number;
  z0: number;
  r0: number;
  inner: number;
}
export interface VolumeModel {
  components: Record<'bulge' | 'disk' | 'stars' | 'dust', VolumeComponent>;
  intensityScale: number;
  stepScale: number;
}
export interface VolumeSource {
  width: number;
  height: number;
  depth: number;
  encodedRgba: Uint8Array;
  model: VolumeModel;
  solarPositionLocal: Vector3;
  provenance: {
    path: string;
    sha256: string;
    decodedSha256: string;
    manifestSha256: string;
    source: string;
    license: string;
    status: string;
    model: VolumeModel;
  };
}
export const PINNED_VOLUME_SHA256 = '34ed2cdfdf388b30be441db4e6a94a7a420e0bf6446aafb2f61c60b49a7fc51b';
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function positive(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${name} must be a string`);
  return value;
}
function component(value: unknown): VolumeComponent {
  const c = object(value, 'component');
  if (!Array.isArray(c.color) || c.color.length !== 3) throw new Error('component requires RGB color');
  return { color: [positive(c.color[0], 'red'), positive(c.color[1], 'green'), positive(c.color[2], 'blue')],
    strength: positive(c.strength, 'strength'), z0: positive(c.z0, 'z0'),
    r0: positive(c.r0, 'r0'), inner: positive(c.inner, 'inner') };
}
/** Only the actual one-level RGBA8/Zstd contract is accepted; no lossy transcoding. */
export function decodeDensityKtx2(bytes: Buffer): Pick<VolumeSource, 'width' | 'height' | 'depth' | 'encodedRgba'> {
  const identifier = Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex');
  if (bytes.length < 104 || !bytes.subarray(0, 12).equals(identifier)) throw new Error('Invalid KTX2 header');
  if (bytes.readUInt32LE(12) !== 37 || bytes.readUInt32LE(16) !== 1 || bytes.readUInt32LE(32) !== 0 ||
    bytes.readUInt32LE(36) !== 1 || bytes.readUInt32LE(40) !== 1 || bytes.readUInt32LE(44) !== 2) {
    throw new Error('Expected single-level non-array RGBA8 KTX2 volume compressed with Zstd');
  }
  const width = bytes.readUInt32LE(20), height = bytes.readUInt32LE(24), depth = bytes.readUInt32LE(28);
  if (width !== 512 || height !== 512 || depth !== 64) throw new Error('Pinned density volume must be 512×512×64');
  const offset = Number(bytes.readBigUInt64LE(80)), length = Number(bytes.readBigUInt64LE(88));
  const rawLength = Number(bytes.readBigUInt64LE(96));
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 104 ||
    offset + length > bytes.length || rawLength !== width * height * depth * 4) throw new Error('Invalid KTX2 level bounds');
  const encodedRgba = zstdDecompressSync(bytes.subarray(offset, offset + length));
  if (encodedRgba.length !== rawLength) throw new Error('Decoded density byte length mismatch');
  return { width, height, depth, encodedRgba };
}
export async function loadVolumeSource(options: { galaxioRoot: string; expectedSha256?: string }): Promise<VolumeSource> {
  const manifestBytes = await readFile(path.join(options.galaxioRoot, 'data/manifest.json'));
  const manifest: unknown = JSON.parse(manifestBytes.toString('utf8'));
  const root = object(manifest, 'manifest');
  const assets = object(root.assets, 'manifest assets');
  const record = object(assets['textures/milky-way-volume'], 'Milky Way asset');
  const extra = object(record.extra, 'asset extra');
  if (extra.encoding !== 'sqrt-density-unorm8' || extra.colorspace !== 'linear' ||
    extra.format !== 'VK_FORMAT_R8G8B8A8_UNORM') throw new Error('Expected linear square-root density contract');
  const channels = object(extra.channels, 'channels');
  if (channels.r !== 'sqrtDiskDensity' || channels.g !== 'sqrtStarsDensity' ||
    channels.b !== 'sqrtDustDensity' || channels.a !== 'reservedZero') throw new Error('Unexpected density channels');
  const relativePath = text(record.path, 'asset path');
  const bytes = await readFile(path.join(options.galaxioRoot, 'data', relativePath));
  const sha256 = hash(bytes);
  if (sha256 !== (options.expectedSha256 ?? PINNED_VOLUME_SHA256)) throw new Error('Milky Way volume SHA256 pin mismatch');
  const decoded = decodeDensityKtx2(bytes);
  const rawModel = object(extra.galaxiumModel, 'model');
  const rawComponents = object(rawModel.components, 'components');
  const model: VolumeModel = { components: { bulge: component(rawComponents.bulge), disk: component(rawComponents.disk),
    stars: component(rawComponents.stars), dust: component(rawComponents.dust) },
    intensityScale: positive(rawModel.intensityScale, 'intensityScale'), stepScale: positive(rawModel.stepScale, 'stepScale') };
  const rawOrientation = extra.orientationXyzw;
  const rawCenter = extra.centerOffsetIcrfM;
  if (!Array.isArray(rawOrientation) || rawOrientation.length !== 4 ||
    !rawOrientation.every(value => typeof value === 'number' && Number.isFinite(value)) ||
    !Array.isArray(rawCenter) || rawCenter.length !== 3 ||
    !rawCenter.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error('Invalid galaxy placement');
  const radiusM = positive(extra.radiusM, 'radiusM');
  const norm = Math.hypot(...rawOrientation);
  if (Math.abs(norm - 1) > 1e-6) throw new Error('Galaxy orientation must be normalized');
  // Inverse rotation maps the Sun (ICRF origin) into galaxy-local physical coordinates.
  const qx = -Number(rawOrientation[0]) / norm, qy = -Number(rawOrientation[1]) / norm;
  const qz = -Number(rawOrientation[2]) / norm, qw = Number(rawOrientation[3]) / norm;
  const x = -Number(rawCenter[0]) / radiusM, y = -Number(rawCenter[1]) / radiusM, z = -Number(rawCenter[2]) / radiusM;
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  const solarPositionLocal: Vector3 = [x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
  return { ...decoded, model, solarPositionLocal, provenance: { path: relativePath, sha256, decodedSha256: hash(decoded.encodedRgba),
    manifestSha256: hash(manifestBytes), source: text(record.source, 'source'), license: text(record.license, 'license'),
    status: 'Local reference only. Recovered Galaxium / Stellarium Labs SRL model; no publication license implied.', model } };
}
/** Matches Three's clamp-to-edge trilinear encoded sampling. Square AFTER filtering. */
export function sampleEncoded(source: VolumeSource, x: number, y: number, z: number, out: Vector3): void {
  if (Math.abs(x) > 1 || Math.abs(y) > 1 || Math.abs(z) > 0.125) { out[0] = out[1] = out[2] = 0; return; }
  const fx = Math.max(0, Math.min(source.width - 1, (x * 0.5 + 0.5) * source.width - 0.5));
  const fy = Math.max(0, Math.min(source.height - 1, (y * 0.5 + 0.5) * source.height - 0.5));
  const fz = Math.max(0, Math.min(source.depth - 1, (z * 4 + 0.5) * source.depth - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, source.width - 1), y1 = Math.min(y0 + 1, source.height - 1), z1 = Math.min(z0 + 1, source.depth - 1);
  const ax = fx - x0, ay = fy - y0, az = fz - z0;
  const b = source.encodedRgba, w = source.width, h = source.height;
  for (let c = 0; c < 3; c++) {
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
