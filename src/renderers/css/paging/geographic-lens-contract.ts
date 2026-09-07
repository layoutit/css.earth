import type { PreparedPagePlan } from './types.js';
import type { GeographicLensReference, GeographicLensContent, GeographicOverview } from './geographic-types.js';
export { GEOGRAPHIC_LENS_CAPACITY } from './geographic-types.js';
import { requireWmtsRasterSource } from "./wmts-raster-source.js";
import { requireGeographicRootReference } from "./geographic-index-contract.js";

// Finite shell and renderer capacities, independent of the number of datasets.
export const GEOGRAPHIC_LEGEND_CAPACITY = 16;
export const GEOGRAPHIC_PACKAGE_BYTE_LIMIT = 256 * 1024;
export const GEOGRAPHIC_OVERVIEW_LIMITS = Object.freeze({ images: 64, decodedBytes: 32 * 1024 * 1024,
  imageBytes: 8 * 1024 * 1024, concurrentLoads: 3 });

const finiteMatrix = (value: unknown) => typeof value === "string" && value.split(",").length === 16 && value.split(",").every(n => n.trim() && Number.isFinite(Number(n)));
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value ?? "");
const text = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 2048;
const https = (value: string) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };

export function requireGeographicLensReference(input: unknown, assetPath: string): GeographicLensReference {
  const value = input as GeographicLensReference | undefined;
  const ref = value?.package;
  if (!value || !text(value.id) || !text(value.label) || !value.thumbnailUrl?.startsWith(assetPath) ||
      !ref?.url?.startsWith(assetPath) || ref.url.includes("..") || ref.url.includes("?") ||
      !ref.url.endsWith(`-${ref.sha256?.slice(0, 16)}.json`) || !hash(ref.sha256) ||
      !Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > GEOGRAPHIC_PACKAGE_BYTE_LIMIT) {
    throw new Error("Invalid geographic lens package reference.");
  }
  return value;
}

export function requireGeographicScope(input: unknown): NonNullable<GeographicLensContent["scope"]> {
  const scope = input as GeographicLensContent["scope"];
  if (!scope || !/^[a-z][a-z0-9-]*$/u.test(scope.objectId ?? "") ||
      Object.keys(scope).some(key => !["objectId", "entityIds"].includes(key)) ||
      (!Array.isArray(scope.entityIds) || !scope.entityIds.length ||
        scope.entityIds.length > 65536 || new Set(scope.entityIds).size !== scope.entityIds.length ||
        scope.entityIds.some(id => typeof id !== "string" || !id.length || id.length > 128))) {
    throw new Error("Invalid prepared geographic scope.");
  }
  return scope;
}

export function geographicScopeIncludes(scope: NonNullable<GeographicLensContent["scope"]>, objectId: string, entityId: string) {
  return scope.objectId === objectId && Array.isArray(scope.entityIds) && scope.entityIds.includes(entityId);
}

export function geographicPackageIncludes(value: GeographicLensContent | null | undefined, objectId: string, entityId: string) {
  return value?.schema === "cssearth-geographic-lens@1" ? value.entityIds?.includes(entityId) === true :
    value?.schema === "cssearth-geographic-lens@2" && value.scope?.objectId === objectId &&
      Array.isArray(value.scope.entityIds) && value.scope.entityIds.includes(entityId);
}

export function requireGeographicLensPackage(input: unknown, descriptor: GeographicLensReference, entityId: string, capacity: PreparedPagePlan, objectId: string): GeographicLensContent {
  const value = input as GeographicLensContent | undefined;
  if (!value || !value.pages) throw new Error('Incompatible geographic lens content or source identity.');
  const p = value.pages, source = value.source, legend = value.legend;
  if (value?.schema === "cssearth-geographic-lens@2") requireGeographicScope(value.scope);
  if (!geographicPackageIncludes(value, objectId, entityId) || value.id !== descriptor.id ||
      !text(value.baseLensId) || !text(value.qualification) ||
      !source || !text(source.publisher) || !Number.isInteger(source.year) || !text(source.units) ||
      !https(source.url) || !https(source.licenseUrl) || !text(source.license) || !hash(source.sha256) ||
      !["categories", "scale"].includes(legend?.kind) ||
      legend.kind === "scale" && (!Array.isArray(legend.labels) || legend.labels.length !== 2 || !legend.labels.every(text)) ||
      !Array.isArray(legend.items) || !legend.items.length ||
      legend.items.length > GEOGRAPHIC_LEGEND_CAPACITY || legend.items.some(item => !text(item.label) ||
        !/^rgb\((?:\d{1,3},){2}\d{1,3}\)$/u.test(item.color) || item.color.match(/\d+/gu)!.some(n => +n > 255))) {
    throw new Error("Incompatible geographic lens content or source identity.");
  }
  if (value.overview !== undefined) requireGeographicOverview(value.overview, p, capacity);
  if (value.schema === "cssearth-geographic-lens@2" && p?.topology === "wmts-quadtree@1") {
    requireIndexedGeographicPages(p, capacity);
    return value;
  }
  if (p?.schema !== "cssearth-prepared-map-pages@1" || p.assetPath !== capacity.assetPath ||
      p.assetOrigin !== capacity.assetOrigin || p.rasterScale !== capacity.rasterScale ||
      p.poolSize !== capacity.poolSize || !Number.isSafeInteger(p.maximumDecodedBytes) ||
      p.maximumDecodedBytes < capacity.decodedPageBytes * 2 || p.maximumDecodedBytes > capacity.maximumDecodedBytes ||
      p.decodedPageBytes !== capacity.decodedPageBytes || !Number.isSafeInteger(p.maximumConcurrentLoads) ||
      p.maximumConcurrentLoads < 1 || p.maximumConcurrentLoads > capacity.maximumConcurrentLoads ||
      p.topology !== undefined || !withinIndexCapacity(p.index, capacity.index) || p.minimumZoom < 0 ||
      !Number.isFinite(p.minimumZoom) || !Array.isArray(p.roots) || !p.roots.length || p.roots.length > capacity.poolSize / 2 ||
      new Set(p.roots.map(page => page.key)).size !== p.roots.length || p.roots.some(page =>
        !text(page.key) || page.directory !== undefined || page.coverageParts !== undefined ||
        page.imageMatrix !== undefined && !finiteMatrix(page.imageMatrix) || !finiteMatrix(page.frameMatrix) || !finiteMatrix(page.textureMatrix) ||
        !Array.isArray(page.corners) || page.corners.length !== 4 || page.corners.some(v => v.length !== 3 || !v.every(Number.isFinite)) ||
        page.normal?.length !== 3 || !page.normal.every(Number.isFinite) || page.children?.length !== 0 ||
        page.rasterSource !== "prepared-raster@1" || !hash(page.sha256) ||
        !page.url?.startsWith(p.assetPath) || page.url.includes("..") || !page.url.endsWith(`-${page.sha256.slice(0,16)}.webp`) ||
        !Number.isSafeInteger(page.bytes) || (page.bytes ?? 0) < 1 || (page.bytes ?? Infinity) > 8 * 1024 * 1024 ||
        !Number.isSafeInteger(page.width) || !Number.isSafeInteger(page.height) || page.width < 1 || page.height < 1 ||
        page.width * page.height * 4 > capacity.decodedPageBytes)) {
    throw new Error("Geographic lens exceeds its prepared renderer capacity.");
  }
  return value;
}

export function requireGeographicOverview(overview: GeographicOverview, plan: PreparedPagePlan, capacity: PreparedPagePlan) {
  const limits = GEOGRAPHIC_OVERVIEW_LIMITS;
  if (overview?.schema !== "cssearth-geographic-overview@1" || !Array.isArray(overview.images) || !overview.images.length ||
      overview.images.length > limits.images || new Set(overview.images.map(item => item.slot)).size !== overview.images.length ||
      overview.images.some(({ slot, image }) => !text(slot) || !hash(image?.sha256) || !image.url?.startsWith(capacity.assetPath) ||
        image.url.includes("..") || !/^\/scenes\/[a-z][a-z0-9-]*\/[a-z0-9-]+-[a-f0-9]{16}\.webp$/u.test(image.url) ||
        !image.url.endsWith(`-${image.sha256.slice(0,16)}.webp`) || !Number.isSafeInteger(image.bytes) || image.bytes < 1 || image.bytes > limits.imageBytes ||
        ![image.width, image.height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 4096))) throw new Error("Invalid prepared geographic overview.");
  const bytes = overview.images.reduce((sum, {image}) => sum + image.width * image.height * 4, 0);
  if (overview.decodedBytes !== bytes || bytes > limits.decodedBytes || bytes + plan.maximumDecodedBytes > capacity.maximumDecodedBytes) {
    throw new Error("Geographic overview exceeds the observation memory capacity.");
  }
  return overview;
}

function withinIndexCapacity(index: PreparedPagePlan["index"], capacity: PreparedPagePlan["index"]) {
  return index && (Object.keys(capacity) as Array<keyof PreparedPagePlan["index"]>).every(key => Number.isSafeInteger(index[key]) && index[key] > 0 && index[key] <= capacity[key]);
}

function requireIndexedGeographicPages(p: PreparedPagePlan, capacity: PreparedPagePlan) {
  if (p.schema !== "cssearth-prepared-map-pages@1" || p.assetPath !== capacity.assetPath || p.assetOrigin !== capacity.assetOrigin ||
      p.geometryOrigin !== capacity.assetOrigin || !/^[a-f0-9]{16}$/u.test(p.geometryVersion ?? "") || !text(p.geometryDataset) || !text(p.dataset) ||
      p.rasterScale !== 8 || !(capacity.rasterScales ?? [capacity.rasterScale]).includes(p.rasterScale) || p.pageTemplate !== "clipped-projective" ||
      p.poolSize !== capacity.poolSize || p.decodedPageBytes !== 256 * 256 * 4 ||
      !Number.isSafeInteger(p.maximumDecodedBytes) || p.maximumDecodedBytes < p.decodedPageBytes * 2 || p.maximumDecodedBytes > capacity.maximumDecodedBytes ||
      !Number.isSafeInteger(p.maximumConcurrentLoads) || p.maximumConcurrentLoads < 1 || p.maximumConcurrentLoads > capacity.maximumConcurrentLoads ||
      !withinIndexCapacity(p.index, capacity.index) || !Array.isArray(p.roots) || p.roots.length ||
      !Number.isFinite(p.minimumZoom) || p.minimumZoom < 0 || !Number.isFinite(p.targetCssPixels) || p.targetCssPixels < 1 ||
      !Number.isInteger(p.levels?.minimum) || !Number.isInteger(p.levels?.maximum) ||
      !p.levels || p.levels.minimum < 0 || p.levels.maximum < p.levels.minimum || p.levels.maximum > 19) {
    throw new Error("Indexed geographic lens exceeds its prepared capacity.");
  }
  requireGeographicRootReference(p.rootDirectory!, p.assetPath);
  requireWmtsRasterSource(p.imageSource);
  if (p.levels.maximum >= p.imageSource!.levels.length) throw new Error("Geographic geometry exceeds its admitted provider levels.");
}
