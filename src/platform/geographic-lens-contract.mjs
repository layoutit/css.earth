// Finite shell and renderer capacities, independent of the number of datasets.
export const GEOGRAPHIC_LENS_CAPACITY = 8;
export const GEOGRAPHIC_LEGEND_CAPACITY = 16;
export const GEOGRAPHIC_PACKAGE_BYTE_LIMIT = 256 * 1024;

const finiteMatrix = value => typeof value === "string" && value.split(",").length === 16 && value.split(",").every(n => n.trim() && Number.isFinite(Number(n)));
const hash = value => /^[a-f0-9]{64}$/u.test(value ?? "");
const text = value => typeof value === "string" && value.length > 0 && value.length <= 2048;
const https = value => { try { return new URL(value).protocol === "https:"; } catch { return false; } };

export function requireGeographicLensReference(value, assetPath) {
  const ref = value?.package;
  if (!text(value?.id) || !text(value.label) || !value.thumbnailUrl?.startsWith(assetPath) ||
      !ref?.url?.startsWith(assetPath) || ref.url.includes("..") || ref.url.includes("?") ||
      !ref.url.endsWith(`-${ref.sha256?.slice(0, 16)}.json`) || !hash(ref.sha256) ||
      !Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > GEOGRAPHIC_PACKAGE_BYTE_LIMIT) {
    throw new Error("Invalid geographic lens package reference.");
  }
  return value;
}

export function requireGeographicLensPackage(value, descriptor, entityId, capacity) {
  const p = value?.pages, source = value?.source, legend = value?.legend;
  if (value?.schema !== "cssearth-geographic-lens@1" || value.id !== descriptor.id ||
      !value.entityIds?.includes(entityId) || !text(value.baseLensId) || !text(value.qualification) ||
      !source || !text(source.publisher) || !Number.isInteger(source.year) || !text(source.units) ||
      !https(source.url) || !https(source.licenseUrl) || !text(source.license) || !hash(source.sha256) ||
      legend?.kind !== "categories" || !Array.isArray(legend.items) || !legend.items.length ||
      legend.items.length > GEOGRAPHIC_LEGEND_CAPACITY || legend.items.some(item => !text(item.label) ||
        !/^rgb\((?:\d{1,3},){2}\d{1,3}\)$/u.test(item.color) || item.color.match(/\d+/gu).some(n => +n > 255))) {
    throw new Error("Incompatible geographic lens content or source identity.");
  }
  if (p?.schema !== "cssearth-prepared-map-pages@1" || p.assetPath !== capacity.assetPath ||
      p.assetOrigin !== capacity.assetOrigin || p.rasterScale !== capacity.rasterScale ||
      p.poolSize !== capacity.poolSize || !Number.isSafeInteger(p.maximumDecodedBytes) ||
      p.maximumDecodedBytes < capacity.decodedPageBytes * 2 || p.maximumDecodedBytes > capacity.maximumDecodedBytes ||
      p.decodedPageBytes !== capacity.decodedPageBytes || !Number.isSafeInteger(p.maximumConcurrentLoads) ||
      p.maximumConcurrentLoads < 1 || p.maximumConcurrentLoads > capacity.maximumConcurrentLoads ||
      p.topology !== undefined || !p.index || Object.keys(capacity.index).some(key => p.index[key] !== capacity.index[key]) || p.minimumZoom < 0 ||
      !Number.isFinite(p.minimumZoom) || !Array.isArray(p.roots) || !p.roots.length || p.roots.length > capacity.poolSize / 2 ||
      new Set(p.roots.map(page => page.key)).size !== p.roots.length || p.roots.some(page =>
        !text(page.key) || page.directory !== undefined || page.coverageParts !== undefined ||
        page.imageMatrix !== undefined && !finiteMatrix(page.imageMatrix) || !finiteMatrix(page.frameMatrix) || !finiteMatrix(page.textureMatrix) ||
        !Array.isArray(page.corners) || page.corners.length !== 4 || page.corners.some(v => v.length !== 3 || !v.every(Number.isFinite)) ||
        page.normal?.length !== 3 || !page.normal.every(Number.isFinite) || page.children?.length !== 0 ||
        page.rasterSource !== "prepared-raster@1" || !hash(page.sha256) ||
        !page.url?.startsWith(p.assetPath) || page.url.includes("..") || !page.url.endsWith(`-${page.sha256.slice(0,16)}.webp`) ||
        !Number.isSafeInteger(page.bytes) || page.bytes < 1 || page.bytes > 8 * 1024 * 1024 ||
        !Number.isSafeInteger(page.width) || !Number.isSafeInteger(page.height) || page.width < 1 || page.height < 1 ||
        page.width * page.height * 4 > capacity.decodedPageBytes)) {
    throw new Error("Geographic lens exceeds its prepared renderer capacity.");
  }
  return value;
}
