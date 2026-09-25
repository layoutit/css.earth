/** Renderer-independent, pinned celestial radiance image and fixed offline display transfer. */
import { text } from '@cssearth/bake/volume';
import { requireRecord as record, requireFiniteNumber as finite } from '@cssearth/core';
export interface SkyReference { path: string; }
export interface SkyShadowFloor { blackPoint: number; fullSignal: number; }
export interface SkyParallax { originM: [number, number, number]; radiusM: number; }
export interface SkyRecipe {
  schema: 'cssearth-sky-recipe@1';
  source: { format: 'rgb16f-le-zstd-rows'; width: number; height: number;
    chunks: (SkyReference & { firstRow: number; rows: number })[]; acquisition: SkyReference };
  projection: { frame: 'icrf-j2000'; mapping: 'equirectangular-ra-left'; centerRaDegrees: 0 };
  bake: { faceSize: number; exposure: number; transfer: 'linear-to-srgb'; displayGain?: number;
    shadowFloor?: SkyShadowFloor; webpQuality: number };
  provenance: SkyReference;
  parallax?: SkyParallax;
  /** Bake a prepared point field into a second face set for the observer near its origin. */
  stars?: SkyStars;
}
/** The point field is a sibling object; its pinned descriptor pins the bank it carries.
 * Sprite radii are screen pixels, so one authored screen scale fixes their angular size. */
export interface SkyStars { object: string; cssPixelsPerDegree: number; }
export function reference(value: unknown): SkyReference {
  const r = record(value, 'sky source reference'), path = text(r.path, 'sky path');
  if (path.startsWith('/') || /[\\\u0000]/u.test(path) || path.split('/').includes('..')) throw new TypeError('Sky source needs a contained path.');
  return { path };
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
  let stars: SkyStars | undefined;
  if (r.stars !== undefined) {
    const input = record(r.stars, 'sky stars'), object = text(input.object, 'sky stars object');
    if (!/^[a-z][a-z0-9-]*$/u.test(object) || Object.keys(input).length !== 2) throw new TypeError('Sky stars need a sibling object id and a screen scale.');
    stars = { object, cssPixelsPerDegree: positive(input.cssPixelsPerDegree, 'sky stars screen scale') };
  }
  if (b.shadowFloor !== undefined) {
    const floor = record(b.shadowFloor, 'sky shadow floor');
    const blackPoint = finite(floor.blackPoint, 'sky shadow black point');
    const fullSignal = finite(floor.fullSignal, 'sky shadow full signal');
    if (blackPoint < 0 || fullSignal <= blackPoint || fullSignal > 1)
      throw new TypeError('Sky shadow floor must increase within transferred display RGB.');
    shadowFloor = { blackPoint, fullSignal };
  }
  return { schema: r.schema, source: { format: s.format, width, height, chunks, acquisition: reference(s.acquisition) },
    projection: { frame: p.frame, mapping: p.mapping, centerRaDegrees: 0 },
    bake: { faceSize, exposure: positive(b.exposure, 'sky exposure'), transfer: b.transfer, displayGain,
      ...(shadowFloor ? { shadowFloor } : {}), webpQuality }, provenance: reference(r.provenance), ...(parallax ? { parallax } : {}),
    ...(stars ? { stars } : {}) };
}
