export const COMPILER_STAR_SPRITES_SCHEMA = 'cssearth-compiler-star-sprites@1';
export const COMPILER_BAKE_SCHEMA = 'cssearth-compiler-bake@2';
import type { DensityVolumeFrame } from '../../density-volume.js';
import type { EmissionBounds, EmissionVector3, SkyBounds } from '../emission/coordinates.js';
import { readVolumeLayerPlan, type VolumeLayerPlan } from './volume-layer-plan.js';
import { readLayerOptimizationReport, type LayerOptimizationReport } from './layer-optimization-report.js';
import { readRenderElementBudget, type RenderElementBudget } from './render-element-budget.js';

export const COMPILER_LONGEST_AXIS_SLICES = 512;

export interface CompilerPin { path: string }
export interface CompilerDatasetVolume {
  id: string;
  label: string;
  volume: CompilerPin;
  coverage: { positiveAlphaTexels: number; recoloredTexels: number; outsideImageTexels: number };
}
export interface CompilerStarMaterial { rgb: [number, number, number]; diameterUnits: number; alpha: number }
export interface PreparedCompilerStar {
  id: string;
  /** Centered coordinates in frame.referenceFrame; current preparations use west/north/toward. */
  positionUnits: EmissionVector3;
  rgb: [number, number, number];
  /** Historical fixed-screen markers; newly prepared stars use angular scene units. */
  widthPx?: number;
  /** Equivalent residual-light disk diameter in the scene's arcsecond units. */
  diameterUnits?: number;
  alpha: number;
  /** Optional on historical preparations; new records contain every configured source dataset. */
  materials?: Record<string, CompilerStarMaterial>;
}
export interface CompilerStarSprites {
  schema: typeof COMPILER_STAR_SPRITES_SCHEMA;
  atlas: CompilerPin;
  width: number; height: number; tileSize: number;
  entries: Record<string, { x: number; y: number }>;
  diameterScale: number; alphaScale: number; alphaIntegralPixels: number;
  /** Exact site profile recipe used offline. */
  profile: CompilerPin;
}
export interface CompilerBakeResult {
  schema: typeof COMPILER_BAKE_SCHEMA;
  id: string;
  /** Name of the immutable cloud bank retained during an independently prepared stellar update. */
  volumeId?: string;
  /** Name of the fitted field the scene transports, given by its host. */
  fieldIdentity: string;
  frame: DensityVolumeFrame;
  boundsArcsec: EmissionBounds;
  skyBoundsArcsec: SkyBounds;
  spanArcsec: number;
  sourceImage: { width: 512; height: 512 };
  coordinates: {
    axes: readonly ['west', 'north', 'away'];
    localOriginArcsec: EmissionVector3;
    earthView: 'observer-at-negative-z-looking-away';
  };
  neutral: CompilerPin;
  datasets: CompilerDatasetVolume[];
  stars: PreparedCompilerStar[];
  starSprites?: CompilerStarSprites;
  /** `imageWidth` is the slab raster width in pixels: 512 by default, less for a field that fills every slab. */
  sampling: { sliceCounts: { x: number; y: number; z: number }; imageWidth: number; samplesPerSlab: 4;
    layerPlan?: VolumeLayerPlan; layerOptimization?: LayerOptimizationReport; renderBudget?: RenderElementBudget };
}

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const triple = (v: unknown): v is EmissionVector3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(v);
/** Slab rasters are 512 pixels wide unless a scene saves a smaller width. A cloud that fills its bounds keeps every
 * slab at full size, so its three atlases grow with the square of this width. */
export const COMPILER_IMAGE_WIDTH = 512, COMPILER_MINIMUM_IMAGE_WIDTH = 128;
export const validCompilerImageWidth = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) &&
  v >= COMPILER_MINIMUM_IMAGE_WIDTH && v <= COMPILER_IMAGE_WIDTH;
/** A scene, field or bank is named by its id. */
export const validCompilerName = (v: unknown): v is string => safeId(v) && !/^[a-f0-9]{64}$/.test(v);

export function validCompilerStarSize(value: { widthPx?: unknown; diameterUnits?: unknown }): boolean {
  if (value.diameterUnits !== undefined) return value.widthPx === undefined && finite(value.diameterUnits) && value.diameterUnits > 0 && value.diameterUnits <= 1e8;
  return finite(value.widthPx) && value.widthPx >= .5 && value.widthPx <= 12;
}
export function validCompilerStarMaterials(value: unknown, datasetIds: ReadonlySet<string>): boolean {
  if (value === undefined) return true;
  if (!record(value) || Object.keys(value).length !== datasetIds.size) return false;
  return Object.entries(value).every(([id, material]) => datasetIds.has(id) && record(material) &&
    Object.keys(material).every(key => ['rgb', 'diameterUnits', 'alpha'].includes(key)) &&
    Array.isArray(material.rgb) && material.rgb.length === 3 && material.rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    finite(material.diameterUnits) && validCompilerStarSize(material) && finite(material.alpha) && material.alpha >= 0 && material.alpha <= 1);
}
/** Material transport never owns point positions or conditionally sampled depths. */
export function compilerStarAppearance(star: PreparedCompilerStar, datasetId: string | null): Pick<PreparedCompilerStar, 'rgb' | 'alpha' | 'diameterUnits' | 'widthPx'> {
  return datasetId && star.materials ? star.materials[datasetId]! : star;
}
function pin(v: unknown): v is CompilerPin {
  if (!record(v)) return false;
  return typeof v.path === 'string' && v.path.length > 0 && !v.path.startsWith('/') && !v.path.split('/').includes('..') &&
    !/[\\\u0000-\u0020]/.test(v.path);
}
function bounds3(v: unknown): v is EmissionBounds {
  if (!record(v)) return false;
  const min = v.min, max = v.max;
  return triple(min) && triple(max) && min.every((n, axis) => n < max[axis]!);
}
function bounds2(v: unknown): v is SkyBounds {
  if (!record(v)) return false;
  const min = v.min, max = v.max;
  return Array.isArray(min) && Array.isArray(max) && min.length === 2 && max.length === 2 &&
    min.every((n, axis) => finite(n) && finite(max[axis]) && n < max[axis]!);
}
function same(a: unknown, b: readonly number[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((n, i) => finite(n) && Math.abs(n - b[i]!) < 1e-10);
}

/** Optional only for historical cached scenes; new preparations carry a verified sprite bank. */
export function validCompilerStarSprites(value: unknown, stars: readonly PreparedCompilerStar[]): value is CompilerStarSprites {
  if (!record(value) || value.schema !== COMPILER_STAR_SPRITES_SCHEMA || !pin(value.atlas) || !pin(value.profile) ||
      !Number.isInteger(value.width) || !Number.isInteger(value.height) || !Number.isInteger(value.tileSize) ||
      Number(value.tileSize) < 1 || Number(value.tileSize) > 256 || Number(value.width) > 8192 || Number(value.height) > 8192 ||
      Number(value.width) < Number(value.tileSize) || Number(value.height) < Number(value.tileSize) ||
      Number(value.width) % Number(value.tileSize) !== 0 || Number(value.height) % Number(value.tileSize) !== 0 ||
      !finite(value.diameterScale) || value.diameterScale <= 0 || value.diameterScale > 100 || value.alphaScale !== 1 ||
      !finite(value.alphaIntegralPixels) || value.alphaIntegralPixels <= 0 || value.alphaIntegralPixels > Number(value.tileSize) ** 2 ||
      !record(value.entries) || Object.keys(value.entries).length < 1 || Object.keys(value.entries).length > 45000) return false;
  const tile = Number(value.tileSize), occupied = new Set<string>();
  if (Math.abs(value.diameterScale ** 2 * value.alphaIntegralPixels / tile ** 2 - Math.PI / 4) > 1e-10) return false;
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!/^\d{1,3},\d{1,3},\d{1,3}$/.test(key) || key.split(',').some(n => Number(n) > 255) || !record(entry) ||
        !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || Number(entry.x) < 0 || Number(entry.y) < 0 ||
        Number(entry.x) % tile !== 0 || Number(entry.y) % tile !== 0 || Number(entry.x) + tile > Number(value.width) ||
        Number(entry.y) + tile > Number(value.height)) return false;
    const cell = `${entry.x},${entry.y}`; if (occupied.has(cell)) return false; occupied.add(cell);
  }
  return stars.every(star => [star, ...Object.values(star.materials ?? {})].every(material =>
    record(value.entries) && Object.hasOwn(value.entries, material.rgb.join(','))));
}

/** Strict worker/browser validation; no Node, DOM, or renderer imports. */
export function readCompilerBakeResult(value: unknown): CompilerBakeResult {
  if (record(value) && value.volumeId !== undefined && !validCompilerName(value.volumeId))
    throw new TypeError(`Invalid retained compiler cloud name: ${JSON.stringify(value.volumeId)}.`);
  if (!record(value) || value.schema !== COMPILER_BAKE_SCHEMA || !validCompilerName(value.id) ||
      !validCompilerName(value.fieldIdentity) ||
      !bounds3(value.boundsArcsec) || !bounds2(value.skyBoundsArcsec) || !pin(value.neutral) ||
      !finite(value.spanArcsec) || value.spanArcsec <= 0 || !record(value.sourceImage) ||
      value.sourceImage.width !== 512 || value.sourceImage.height !== 512 || !record(value.frame) ||
      !record(value.coordinates) || !record(value.sampling)) throw new TypeError('Invalid compiler bake result.');
  const bounds = value.boundsArcsec, origin = bounds.min.map((n, i) => (n + bounds.max[i]!) / 2);
  const local = { min: bounds.min.map((n, i) => n - origin[i]!), max: bounds.max.map((n, i) => n - origin[i]!) };
  const frame = value.frame, coordinates = value.coordinates, sampling = value.sampling;
  const counts = sampling.sliceCounts;
  if (!['lab-sky-angular', 'lab-sky-west-north-toward'].includes(String(frame.referenceFrame)) || frame.epochJdTt !== 2451545 || frame.metersPerUnit !== 1 ||
      !same(frame.originM, [0, 0, 0]) || !same(frame.localToReferenceXyzw, [0, 0, 0, 1]) || !bounds3(frame.boundsUnits) ||
      !same(frame.boundsUnits.min, local.min) || !same(frame.boundsUnits.max, local.max) ||
      !Array.isArray(coordinates.axes) || coordinates.axes.join(',') !== 'west,north,away' ||
      !same(coordinates.localOriginArcsec, origin) || coordinates.earthView !== 'observer-at-negative-z-looking-away' ||
      !validCompilerImageWidth(sampling.imageWidth) || sampling.samplesPerSlab !== 4 || !record(counts) ||
      ['x', 'y', 'z'].some(axis => !Number.isInteger(counts[axis]) || Number(counts[axis]) < 1 || Number(counts[axis]) > COMPILER_LONGEST_AXIS_SLICES))
    throw new TypeError('Compiler bake frame or sampling is invalid.');
  if (sampling.layerPlan !== undefined) {
    const plan = readVolumeLayerPlan(sampling.layerPlan);
    if (plan.referenceSamplesPerSlab !== sampling.samplesPerSlab ||
        (['x', 'y', 'z'] as const).some(axis => plan.axes[axis].length !== counts[axis]))
      throw new TypeError('Compiler grouped sampling differs from its retained layer plan.');
    if (sampling.layerOptimization !== undefined) readLayerOptimizationReport(sampling.layerOptimization, plan);
  } else if (sampling.layerOptimization !== undefined) throw new TypeError('Compiler layer optimization report requires its retained plan.');
  const expectedSpan = Math.max(value.skyBoundsArcsec.max[0] - value.skyBoundsArcsec.min[0], value.skyBoundsArcsec.max[1] - value.skyBoundsArcsec.min[1]);
  if (Math.abs(value.spanArcsec - expectedSpan) > 1e-10) throw new TypeError('Compiler source span differs from its sky bounds.');
  if (!Array.isArray(value.datasets) || value.datasets.length < 1 || value.datasets.length > 8 ||
      !Array.isArray(value.stars) || value.stars.length > 5000) throw new TypeError('Compiler bake collections are invalid.');
  if (sampling.renderBudget !== undefined) readRenderElementBudget(sampling.renderBudget, value.stars.length,
    Number(counts.x) + Number(counts.y) + Number(counts.z));
  const datasetIds = new Set<string>();
  for (const item of value.datasets) {
    if (!record(item)) throw new TypeError('Invalid compiler dataset volume.');
    const coverage = item.coverage;
    if (!safeId(item.id) || datasetIds.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || !pin(item.volume) || !record(coverage) ||
        !['positiveAlphaTexels', 'recoloredTexels', 'outsideImageTexels'].every(k => Number.isInteger(coverage[k]) && Number(coverage[k]) >= 0))
      throw new TypeError('Invalid compiler dataset volume.');
    datasetIds.add(item.id);
  }
  const starIds = new Set<string>();
  for (const star of value.stars) {
    if (!record(star) || typeof star.id !== 'string' || !star.id || star.id.length > 128 || starIds.has(star.id) || !triple(star.positionUnits) ||
        !Array.isArray(star.rgb) || star.rgb.length !== 3 || !star.rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ||
        !validCompilerStarSize(star) || !finite(star.alpha) || star.alpha < 0 || star.alpha > 1 || !validCompilerStarMaterials(star.materials, datasetIds))
      throw new TypeError('Invalid prepared compiler star.');
    starIds.add(star.id);
  }
  if (value.starSprites !== undefined && !validCompilerStarSprites(value.starSprites, value.stars as unknown as PreparedCompilerStar[]))
    throw new TypeError('Invalid prepared compiler star sprites.');
  return value as unknown as CompilerBakeResult;
}
