/** Data-only emission/absorption recipe for a bounded scalar-field volume. */
export type Vector3 = [number, number, number];
/** Row-major transform of ordinary display RGB values during offline preparation. */
export type DisplayColorMatrix = [number, number, number, number, number, number, number, number, number];
export type Axis = 'x' | 'y' | 'z';
export interface Bounds3 { min: Vector3; max: Vector3; }
export interface VolumeImageEncoding { format: 'png' | 'webp'; quality?: number; }
export interface DensityChannel { channel: number; color: Vector3; strength: number; decodedPower?: number; }
export interface RadialEmission {
  color: Vector3; strength: number; flattening: number; radialScale: number; inner: number;
  exponent: number; falloff: number; radialTaper: [number, number]; verticalTaper: [number, number];
}
export interface VolumeRecipe {
  schema: 'cssearth-volume-recipe@1';
  grid: { path: string; dimensions: Vector3;
    encoding: 'sqrt-density-unorm8' | 'linear-density-unorm8'; bounds: Bounds3;
    acquisition?: { path: string }; };
  material: { emission: DensityChannel[]; absorption: DensityChannel[]; radialEmission?: RadialEmission;
    intensityScale: number; stepScale: number; exposureGain: number;
    /** Shared opacity preserves constant RGB ratios through ordinary source-over; no extinction. */
    emissionTransfer?: 'independent-channels' | 'shared-opacity';
    displayColorMatrix?: DisplayColorMatrix; stepMetric?: 'source' | 'texture'; cylinderSupport?: { axis: Axis; radiusSquared: number }; };
  bake: { sliceCounts: Record<Axis, number>; unitsPerSourceUnit: number; imageWidth: number;
    samplesPerSlab: number; cropTransparent: boolean; opticalWeight: number; imageEncoding?: VolumeImageEncoding; };
  anchors: { id: string; referencePositionM: Vector3 }[];
  provenance: { path: string };
  sky?: { path: string };
}
export function record(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`);
  return value as Record<string, unknown>;
}
export function finite(value: unknown, at: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be finite.`);
  return value;
}
function positive(value: unknown, at: string, integer = false): number {
  const n = finite(value, at);
  if (n <= 0 || (integer && !Number.isInteger(n))) throw new TypeError(`${at} must be positive${integer ? ' integer' : ''}.`);
  return n;
}
export function text(value: unknown, at: string): string {
  if (typeof value !== 'string' || !value) throw new TypeError(`${at} must be a string.`);
  return value;
}
function digest(value: unknown, at: string): string {
  const s = text(value, at); if (!/^[a-f0-9]{64}$/.test(s)) throw new TypeError(`${at} must be SHA256.`); return s;
}
function sourcePath(value: unknown): string {
  const path = text(value, 'source path');
  if (path.startsWith('/') || path.split('/').includes('..') || /[\\\u0000]/.test(path)) throw new TypeError('Source must be contained and relative.');
  return path;
}
export function triple(value: unknown, at: string): Vector3 {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${at} must contain three numbers.`);
  return [finite(value[0], at), finite(value[1], at), finite(value[2], at)];
}
function interval(value: unknown, at: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${at} must be an interval.`);
  const lo = finite(value[0], at), hi = finite(value[1], at);
  if (lo < 0 || hi <= lo) throw new TypeError(`${at} must increase from a nonnegative lower bound.`);
  return [lo, hi];
}
function color(value: unknown): Vector3 {
  const rgb = triple(value, 'color'); if (rgb.some(c => c < 0)) throw new TypeError('Color must be nonnegative.'); return rgb;
}
function displayColorMatrix(value: unknown): DisplayColorMatrix {
  if (!Array.isArray(value) || value.length !== 9) throw new TypeError('displayColorMatrix must contain nine coefficients.');
  const matrix = value.map((entry, index) => {
    const coefficient = finite(entry, `displayColorMatrix coefficient ${index}`);
    if (coefficient < 0) throw new TypeError('displayColorMatrix coefficients must be nonnegative.');
    return coefficient;
  }) as DisplayColorMatrix;
  for (let row = 0; row < 3; row++) {
    if (matrix[row * 3]! + matrix[row * 3 + 1]! + matrix[row * 3 + 2]! > 1)
      throw new TypeError('Each displayColorMatrix row must sum to at most one.');
  }
  return matrix;
}
function channels(value: unknown, at: string): DensityChannel[] {
  if (!Array.isArray(value)) throw new TypeError(`${at} must be an array.`);
  return value.map((entry: unknown) => {
    const c = record(entry, at), channel = finite(c.channel, 'channel');
    if (!Number.isInteger(channel) || channel < 0 || channel > 3) throw new TypeError('Channel must be an RGBA index.');
    return { channel, color: color(c.color), strength: positive(c.strength, 'strength'),
      ...(c.decodedPower === undefined ? {} : { decodedPower: positive(c.decodedPower, 'decodedPower') }) };
  });
}
export function parseVolumeRecipe(value: unknown): VolumeRecipe {
  const r = record(value, 'volume recipe');
  if (r.schema !== 'cssearth-volume-recipe@1') throw new TypeError('Unsupported volume recipe schema.');
  const g = record(r.grid, 'grid'), m = record(r.material, 'material'), b = record(r.bake, 'bake');
  const bounds = record(g.bounds, 'bounds'), min = triple(bounds.min, 'min'), max = triple(bounds.max, 'max');
  if (min.some((n, i) => n >= (max[i] ?? n))) throw new TypeError('Bounds must strictly increase.');
  const dimensions = triple(g.dimensions, 'dimensions');
  if (dimensions.some(n => !Number.isInteger(n) || n < 1)) throw new TypeError('Dimensions must be positive integers.');
  if (g.encoding !== 'sqrt-density-unorm8' && g.encoding !== 'linear-density-unorm8') throw new TypeError('Unsupported density encoding.');
  const counts = record(b.sliceCounts, 'sliceCounts');
  if (typeof b.cropTransparent !== 'boolean') throw new TypeError('cropTransparent must be boolean.');
  const p = record(r.provenance, 'provenance');
  const sky = r.sky === undefined ? undefined : record(r.sky, 'sky recipe');
  if (!Array.isArray(r.anchors)) throw new TypeError('anchors must be an array.');
  const anchors = r.anchors.map((entry: unknown) => {
    const anchor = record(entry, 'anchor'); return { id: text(anchor.id, 'anchor id'), referencePositionM: triple(anchor.referencePositionM, 'anchor position') };
  });
  if (new Set(anchors.map(a => a.id)).size !== anchors.length) throw new TypeError('Anchor IDs must be unique.');
  let radialEmission: RadialEmission | undefined;
  let cylinderSupport: VolumeRecipe['material']['cylinderSupport'];
  if (m.cylinderSupport !== undefined) {
    const support = record(m.cylinderSupport, 'cylinderSupport');
    if (support.axis !== 'x' && support.axis !== 'y' && support.axis !== 'z') throw new TypeError('Invalid cylinder axis.');
    cylinderSupport = { axis: support.axis, radiusSquared: positive(support.radiusSquared, 'radiusSquared') };
  }
  if (m.stepMetric !== undefined && m.stepMetric !== 'source' && m.stepMetric !== 'texture') throw new TypeError('Invalid stepMetric.');
  if (m.emissionTransfer !== undefined && m.emissionTransfer !== 'independent-channels' && m.emissionTransfer !== 'shared-opacity') throw new TypeError('Invalid emissionTransfer.');
  const emission = channels(m.emission, 'emission'), absorption = channels(m.absorption, 'absorption');
  if (m.emissionTransfer === 'shared-opacity' && absorption.length > 0) throw new TypeError('Shared-opacity emission does not support absorption.');
  const acquisition = g.acquisition === undefined ? undefined : record(g.acquisition, 'acquisition');
  let imageEncoding: VolumeImageEncoding | undefined;
  if (b.imageEncoding !== undefined) {
    const encoding = record(b.imageEncoding, 'imageEncoding');
    if (encoding.format !== 'png' && encoding.format !== 'webp') throw new TypeError('Unsupported volume image encoding.');
    const quality = encoding.quality === undefined ? undefined : positive(encoding.quality, 'image quality', true);
    if (quality !== undefined && (encoding.format !== 'webp' || quality > 100)) throw new TypeError('WebP image quality must be at most 100.');
    imageEncoding = { format: encoding.format, ...(quality === undefined ? {} : { quality }) };
  }
  if (m.radialEmission !== undefined) {
    const c = record(m.radialEmission, 'radialEmission');
    radialEmission = { color: color(c.color), strength: positive(c.strength, 'strength'),
      flattening: positive(c.flattening, 'flattening'), radialScale: positive(c.radialScale, 'radialScale'),
      inner: positive(c.inner, 'inner'), exponent: positive(c.exponent, 'exponent'), falloff: positive(c.falloff, 'falloff'),
      radialTaper: interval(c.radialTaper, 'radialTaper'), verticalTaper: interval(c.verticalTaper, 'verticalTaper') };
    if (radialEmission.radialTaper[1] !== 1) throw new TypeError('Abel radial profile support must end at unit radius.');
  }
  return { schema: r.schema, grid: { path: sourcePath(g.path), dimensions, encoding: g.encoding, bounds: { min, max },
    ...(acquisition ? { acquisition: { path: sourcePath(acquisition.path) } } : {}) },
    material: { emission, absorption,
      ...(radialEmission ? { radialEmission } : {}), ...(cylinderSupport ? { cylinderSupport } : {}),
      ...(m.displayColorMatrix === undefined ? {} : { displayColorMatrix: displayColorMatrix(m.displayColorMatrix) }),
      ...(m.emissionTransfer === undefined ? {} : { emissionTransfer: m.emissionTransfer }),
      ...(m.stepMetric ? { stepMetric: m.stepMetric } : {}), intensityScale: positive(m.intensityScale, 'intensityScale'),
      stepScale: positive(m.stepScale, 'stepScale'), exposureGain: positive(m.exposureGain, 'exposureGain') },
    bake: { sliceCounts: { x: positive(counts.x, 'x count', true), y: positive(counts.y, 'y count', true), z: positive(counts.z, 'z count', true) },
      unitsPerSourceUnit: positive(b.unitsPerSourceUnit, 'unitsPerSourceUnit'), imageWidth: positive(b.imageWidth, 'imageWidth', true),
      samplesPerSlab: positive(b.samplesPerSlab, 'samplesPerSlab', true), cropTransparent: b.cropTransparent,
      opticalWeight: positive(b.opticalWeight, 'opticalWeight'), ...(imageEncoding ? { imageEncoding } : {}) }, anchors,
    provenance: { path: sourcePath(p.path) },
    ...(sky ? { sky: { path: sourcePath(sky.path) } } : {}) };
}
