import type { Matrix, Observations, Point } from './model';

export const structureLayers = ['source', 'combined', 'diffuse', 'arcs', 'knots', 'unassigned'] as const;
export const morphologies = ['compact', 'elongated', 'diffuse'] as const;
export const decisions = ['keep', 'unsure', 'reject'] as const;
export type Decision = typeof decisions[number];
export type Morphology = typeof morphologies[number];
export type StructureLayer = typeof structureLayers[number];
export interface StructureImage {
  id: string; label: string; sourceSha256: string; sourceUrl: string; nativeWidth: number; nativeHeight: number; width: number; height: number;
  imageToFrame: Matrix; directory: string; mapSha256: string; credit: string; page: string;
  geometry?: { file: string; sha256: string };
}
export interface StructureCatalogue { frame: Observations['frame']; images: StructureImage[] }
export interface ReviewRegion {
  id: string; scale: number; morphology: Morphology; bounds: { x: number; y: number; width: number; height: number };
  centroid: Point; areaPixels: number; contrast: number; elongation: number; parentId?: string;
  atlas: { index: number; x: number; y: number; width: number; height: number };
}
export interface ReviewMap {
  dimensions: { width: number; height: number };
  panels: { id: StructureLayer; label: string; file: string; description: string }[];
  regions: ReviewRegion[]; atlases: { file: string; width: number; height: number; sha256: string }[];
  metrics: { reconstructionMaxError: number; unassignedFraction: number };
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown, min = 0): value is number => finite(value) && Number.isInteger(value) && value >= min;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const path = (value: unknown): value is string => text(value) && !value.startsWith('/') && !/[\\:?#]/.test(value) && value.split('/').every(part => part !== '..' && part !== '.');
const hash = (value: unknown): value is string => text(value) && /^[a-f0-9]{64}$/.test(value);
const point = (value: unknown): value is Point => Array.isArray(value) && value.length === 2 && value.every(finite);
const matrix = (value: unknown): value is Matrix => Array.isArray(value) && value.length === 6 && value.every(finite) && Math.abs(value[0] * value[3] - value[1] * value[2]) > 1e-12;
const layer = (value: unknown): value is StructureLayer => structureLayers.some(id => id === value);
const morphology = (value: unknown): value is Morphology => morphologies.some(id => id === value);
export const decision = (value: unknown): value is Decision => decisions.some(id => id === value);
export function readStructureCatalogue(value: unknown): StructureCatalogue {
  if (!record(value) || value.schema !== 'cssearth-observation-structures@1' || !record(value.frame) || !Array.isArray(value.images) || !value.images.length) throw new Error('Invalid observation structure catalogue.');
  const f = value.frame;
  if (!integer(f.width, 1) || !integer(f.height, 1) || !point(f.fieldArcminutes) || !f.fieldArcminutes.every(n => n > 0) || !point(f.centerIcrsDegrees) || f.northUp !== true) throw new Error('Invalid structure sky frame.');
  const images = value.images.map((item: unknown): StructureImage => {
    if (!record(item) || !text(item.id) || !text(item.label) || !hash(item.sourceSha256) || !text(item.sourceUrl) || !hash(item.mapSha256) || !path(item.directory) ||
        !integer(item.nativeWidth, 1) || !integer(item.nativeHeight, 1) || !integer(item.width, 1) || !integer(item.height, 1) || !matrix(item.imageToFrame) ||
        !text(item.credit) || !text(item.page) || !item.page.startsWith('https://')) throw new Error('Invalid structure source.');
    let geometry: StructureImage['geometry'];
    if (item.geometry !== undefined) {
      if (!record(item.geometry) || !path(item.geometry.file) || !hash(item.geometry.sha256)) throw new Error('Invalid prepared geometry reference.');
      geometry = { file: item.geometry.file, sha256: item.geometry.sha256 };
    }
    return { id: item.id, label: item.label, sourceSha256: item.sourceSha256, sourceUrl: item.sourceUrl, nativeWidth: item.nativeWidth, nativeHeight: item.nativeHeight,
      width: item.width, height: item.height, imageToFrame: item.imageToFrame, directory: item.directory, mapSha256: item.mapSha256, credit: item.credit, page: item.page,
      ...(geometry === undefined ? {} : { geometry }) };
  });
  if (new Set(images.map(image => image.id)).size !== images.length) throw new Error('Duplicate structure source.');
  return { frame: { width: f.width, height: f.height, fieldArcminutes: f.fieldArcminutes, centerIcrsDegrees: f.centerIcrsDegrees, northUp: true }, images };
}
function bounds(value: unknown): ReviewRegion['bounds'] {
  if (!record(value) || !integer(value.x) || !integer(value.y) || !integer(value.width, 1) || !integer(value.height, 1)) throw new Error('Invalid region bounds.');
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}
export function readReviewMap(value: unknown, image: StructureImage): ReviewMap {
  if (!record(value) || value.schema !== 'cssearth-observation-structure-map@1' || !record(value.dimensions) || value.dimensions.width !== image.width || value.dimensions.height !== image.height ||
      !Array.isArray(value.panels) || !Array.isArray(value.regions) || !Array.isArray(value.atlases) || !record(value.metrics)) throw new Error('Invalid prepared review map.');
  if (value.id !== image.id || !record(value.source) || value.source.sha256 !== image.sourceSha256 || value.source.width !== image.nativeWidth || value.source.height !== image.nativeHeight ||
      value.nativeWidth !== image.nativeWidth || value.nativeHeight !== image.nativeHeight || !matrix(value.imageToFrame) || value.imageToFrame.some((entry, index) => entry !== image.imageToFrame[index])) throw new Error('Prepared map registration or source does not match its catalogue.');
  const panels = value.panels.map((item: unknown) => {
    if (!record(item) || !layer(item.id) || !text(item.label) || !path(item.file) || !text(item.description)) throw new Error('Invalid review image panel.');
    return { id: item.id, label: item.label, file: item.file, description: item.description };
  });
  if (panels.length !== structureLayers.length || new Set(panels.map(panel => panel.id)).size !== structureLayers.length) throw new Error('Incomplete review image panels.');
  const atlases = value.atlases.map((item: unknown) => {
    if (!record(item) || !path(item.file) || !integer(item.width, 1) || !integer(item.height, 1) || !hash(item.sha256)) throw new Error('Invalid prepared support atlas.');
    return { file: item.file, width: item.width, height: item.height, sha256: item.sha256 };
  });
  const regions = value.regions.map((item: unknown): ReviewRegion => {
    if (!record(item) || !text(item.id) || !integer(item.scale) || !morphology(item.morphology) || !point(item.centroid) || !integer(item.areaPixels, 1) ||
        !finite(item.contrast) || item.contrast < 0 || !finite(item.elongation) || item.elongation < 1 || !record(item.atlas) || !integer(item.atlas.index) ||
        (item.parentId !== undefined && !text(item.parentId))) throw new Error('Invalid review region.');
    const b = bounds(item.bounds), a = bounds(item.atlas), atlas = atlases[item.atlas.index];
    if (b.x + b.width > image.width || b.y + b.height > image.height || item.areaPixels > b.width * b.height || !atlas ||
        a.x + a.width > atlas.width || a.y + a.height > atlas.height || a.width !== b.width || a.height !== b.height) throw new Error('Region support lies outside its prepared image.');
    return { id: item.id, scale: item.scale, morphology: item.morphology, bounds: b, centroid: item.centroid, areaPixels: item.areaPixels,
      contrast: item.contrast, elongation: item.elongation, atlas: { ...a, index: item.atlas.index }, ...(item.parentId === undefined ? {} : { parentId: item.parentId }) };
  });
  const ids = new Set(regions.map(region => region.id));
  if (ids.size !== regions.length || regions.some(region => region.parentId && (!ids.has(region.parentId) || region.parentId === region.id))) throw new Error('Invalid region identity or parent.');
  const m = value.metrics;
  if (!finite(m.reconstructionMaxError) || m.reconstructionMaxError < 0 || !finite(m.unassignedFraction) || m.unassignedFraction < 0 || m.unassignedFraction > 1) throw new Error('Invalid review accounting.');
  return { dimensions: { width: image.width, height: image.height }, panels, regions, atlases, metrics: { reconstructionMaxError: m.reconstructionMaxError, unassignedFraction: m.unassignedFraction } };
}
export const reviewStorageKey = (catalogue: string, image: StructureImage) => `nebula-structure-review@1:${catalogue}:${image.id}:${image.sourceSha256}:${image.mapSha256}`;
export function readDecisions(value: unknown): Record<string, Decision> {
  if (!record(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Decision] => decision(entry[1])));
}
