/** Renderer-independent, pinned celestial radiance image and fixed offline display transfer. */
import { record, finite, text } from '../volume/config.js';
export interface SkyReference { path: string; sha256: string; }
export interface SkyShadowFloor { blackPoint: number; fullSignal: number; }
export interface SkyParallax { originM: [number, number, number]; radiusM: number; }
export interface SkyRecipe {
  schema: 'cssearth-sky-recipe@1';
  source: { format: 'rgb16f-le-zstd-rows'; width: number; height: number; decodedSha256: string;
    chunks: (SkyReference & { firstRow: number; rows: number })[]; acquisition: SkyReference };
  projection: { frame: 'icrf-j2000'; mapping: 'equirectangular-ra-left'; centerRaDegrees: 0 };
  bake: { faceSize: number; exposure: number; transfer: 'linear-to-srgb'; displayGain?: number;
    shadowFloor?: SkyShadowFloor; webpQuality: number };
  provenance: SkyReference;
  parallax?: SkyParallax;
}
export function reference(value: unknown): SkyReference {
  const r = record(value, 'sky source reference'), path = text(r.path, 'sky path'), sha256 = text(r.sha256, 'sky digest');
  if (path.startsWith('/') || /[\\\u0000]/u.test(path) || path.split('/').includes('..') || !/^[a-f0-9]{64}$/u.test(sha256)) throw new TypeError('Sky source needs a contained path and SHA256.');
  return { path, sha256 };
}
function positive(value: unknown, label: string, integer = false): number {
  const n = finite(value, label); if (n <= 0 || (integer && !Number.isSafeInteger(n))) throw new TypeError(`${label} must be positive.`); return n;
}
export function parseSkyRecipe(value: unknown): SkyRecipe {
  const r = record(value, 'sky recipe'), s = record(r.source, 'sky source'), p = record(r.projection, 'sky projection'), b = record(r.bake, 'sky bake');
  if (r.schema !== 'cssearth-sky-recipe@1' || s.format !== 'rgb16f-le-zstd-rows' || p.frame !== 'icrf-j2000' ||
    p.mapping !== 'equirectangular-ra-left' || p.centerRaDegrees !== 0 || b.transfer !== 'linear-to-srgb') throw new TypeError('Unsupported sky recipe.');
  const width = positive(s.width, 'sky width', true), height = positive(s.height, 'sky height', true);
  if (width !== height * 2 || width * height > 268435456 || !Array.isArray(s.chunks)) throw new TypeError('Sky source must be a bounded 2:1 image.');
  const decodedSha256 = text(s.decodedSha256, 'decoded sky digest');
  if (!/^[a-f0-9]{64}$/u.test(decodedSha256)) throw new TypeError('Invalid decoded sky digest.');
  let nextRow = 0;
  const chunks = s.chunks.map((input: unknown) => {
    const c = record(input, 'sky chunk'), rows = positive(c.rows, 'chunk rows', true);
    if (c.firstRow !== nextRow || nextRow + rows > height) throw new TypeError('Sky chunks must cover every row exactly once.');
    const firstRow = nextRow; nextRow += rows; return { ...reference(c), firstRow, rows };
  });
  if (nextRow !== height || new Set(chunks.map(c => c.path)).size !== chunks.length) throw new TypeError('Sky chunks must be unique and complete.');
  const faceSize = positive(b.faceSize, 'face size', true), webpQuality = positive(b.webpQuality, 'WebP quality', true);
  if (faceSize > 4096 || webpQuality > 100) throw new TypeError('Sky bake exceeds its bounded limits.');
  const displayGain = b.displayGain === undefined ? 1 : positive(b.displayGain, 'sky display gain');
  if (displayGain > 1) throw new TypeError('Sky display gain must be at most one.');
  let shadowFloor: SkyShadowFloor | undefined;
  let parallax: SkyParallax | undefined;
  if (r.parallax !== undefined) {
    const input = record(r.parallax, 'sky parallax');
    if (Object.keys(input).length !== 2 || Object.keys(input).some(key => !['originM', 'radiusM'].includes(key)) ||
      !Array.isArray(input.originM) || input.originM.length !== 3) throw new TypeError('Sky parallax needs an origin and radius only.');
    parallax = { originM: input.originM.map(n => finite(n, 'sky parallax origin')) as [number, number, number],
      radiusM: positive(input.radiusM, 'sky parallax radius') };
  }
  if (b.shadowFloor !== undefined) {
    const floor = record(b.shadowFloor, 'sky shadow floor');
    const blackPoint = finite(floor.blackPoint, 'sky shadow black point');
    const fullSignal = finite(floor.fullSignal, 'sky shadow full signal');
    if (blackPoint < 0 || fullSignal <= blackPoint || fullSignal > 1)
      throw new TypeError('Sky shadow floor must increase within transferred display RGB.');
    shadowFloor = { blackPoint, fullSignal };
  }
  return { schema: r.schema, source: { format: s.format, width, height, decodedSha256, chunks, acquisition: reference(s.acquisition) },
    projection: { frame: p.frame, mapping: p.mapping, centerRaDegrees: 0 },
    bake: { faceSize, exposure: positive(b.exposure, 'sky exposure'), transfer: b.transfer, displayGain,
      ...(shadowFloor ? { shadowFloor } : {}), webpQuality }, provenance: reference(r.provenance), ...(parallax ? { parallax } : {}) };
}
