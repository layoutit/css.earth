import { prepareCoarsePageGeometry, coarsePageSourceLevel, coarsePageFootprint, MERCATOR_LATITUDE_LIMIT } from './coarse-page.mjs';
import { childAddresses, pageKey } from '../page-geometry.mjs';
import { sourceTilesForBounds } from '../worldcover-catalog.mjs';
import { wmtsRow } from '../wmts-page-geometry.mjs';

export const COARSE_PREPARATION_LIMITS = Object.freeze({
  pages: 20330, sourceImages: 65536, sourceBytes: 2 * 1024 ** 3,
  imageBytes: 327680, decodedWindowBytes: 48 * 1024 ** 2,
  outputBytes: 1024 ** 3, minimumFreeBytes: 8 * 1024 ** 3,
});

// A catalog absence is an availability fact, not an opacity estimate from a
// coarse image. Empty geographic regions can stop subdivision without losing
// small source islands that a downsampled overview could have missed.
export function coarseSourceAvailability(page, catalog) {
  const projection = page.geographicProjection;
  if (projection) {
    const interval = (a, b) => [2 * a / projection.side - 1, 2 * b / projection.side - 1];
    const nearest = ([a, b]) => a > 0 ? a : b < 0 ? b : 0;
    const x = nearest(interval(projection.x0, projection.x1));
    const y = nearest(interval(projection.y0, projection.y1));
    if (x * x + y * y >= 1) return { empty: 'outside-prepared-cap' };
  }
  const bounds = { ...page.sourceBounds,
    south: Math.max(-MERCATOR_LATITUDE_LIMIT, page.sourceBounds.south),
    north: Math.min(MERCATOR_LATITUDE_LIMIT, page.sourceBounds.north),
  };
  if (bounds.south >= bounds.north) return { empty: 'outside-provider-projection' };
  const source = sourceTilesForBounds(bounds, catalog);
  return source.available.length ? { bounds, catalogTiles: source.available.map(entry => entry.tile) }
    : { empty: 'outside-pinned-source-inventory', bounds };
}

export function coarseSourceTileKeys(page, zoom, maximumTiles = 192) {
  const n = 2 ** zoom, b = page.sourceBounds, keys = new Set();
  const add = (x, y) => { if (y >= 0 && y < n) keys.add(`${zoom}-${((x % n) + n) % n}-${y}`); };
  const y0 = Math.max(0, Math.floor(wmtsRow(Math.min(MERCATOR_LATITUDE_LIMIT, b.north), zoom)));
  const y1 = Math.min(n, Math.ceil(wmtsRow(Math.max(-MERCATOR_LATITUDE_LIMIT, b.south), zoom)));
  const x0 = Math.floor((b.west + 180) / 360 * n), x1 = Math.ceil((b.east + 180) / 360 * n);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) add(x, y);
  if (keys.size > maximumTiles) {
    // The conservative rectangle can contain unused polar sectors. Only this
    // exceptional case needs the exact union of prepared texel footprints.
    keys.clear();
    for (let y = 0; y < page.height; y++) for (let x = 0; x < page.width; x++) {
      const bounds = coarsePageFootprint(page, zoom, x, y);
      if (!bounds) continue;
      for (let row = Math.floor(bounds.y0 / 256); row <= Math.floor((bounds.y1 - 1e-8) / 256); row++) {
        for (let col = Math.floor(bounds.x0 / 256); col <= Math.floor((bounds.x1 - 1e-8) / 256); col++) add(col, row);
      }
    }
  }
  if (keys.size > maximumTiles) throw new Error(`Coarse page ${page.key} exceeds its decoded source window (${keys.size} tiles).`);
  return [...keys].sort();
}

export function coarseSourceAddress(key, template) {
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(key);
  if (!match) throw new Error('Invalid planned coarse source key.');
  const [zoom, x, y] = match.slice(1).map(Number), n = 2 ** zoom;
  if (!Number.isSafeInteger(n) || zoom > 19 || x >= n || y >= n) throw new Error('Invalid planned coarse source address.');
  return { key, zoom, x, y, url: template.replace('{z}', String(zoom).padStart(2, '0')).replace('{x}', x).replace('{y}', y) };
}

export async function planGlobalCoarse({ scene, catalog, regularLevel = 2, polarLevel = 6,
  cached = [], onProgress = async () => {} }) {
  if (!Number.isInteger(regularLevel) || regularLevel < 0 || regularLevel > 2 ||
      !Number.isInteger(polarLevel) || polarLevel < 0 || polarLevel > 6) throw new Error('Unsupported bounded coarse pyramid.');
  const queue = [], pages = [], sources = new Set(), cachedPages = new Map(cached.map(page => [page.key, page]));
  for (let y = 0; y < 16; y++) for (let x = 0; x < (y === 0 || y === 15 ? 1 : 32); x++) queue.push({ level: 0, x, y });
  const rootCount = queue.length;
  for (let i = 0; i < queue.length; i++) {
    const address = queue[i], key = pageKey(address);
    let record = cachedPages.get(key);
    if (!record) {
      const page = prepareCoarsePageGeometry(address, scene), availability = coarseSourceAvailability(page, catalog);
      const resolution = availability.empty ? { empty: true } : coarsePageSourceLevel(page);
      record = { key, ...address, empty: availability.empty ?? (resolution.empty ? 'no-prepared-sampling-support' : null),
        resolution, tiles: resolution.empty ? [] : coarseSourceTileKeys(page, resolution.zoom),
        catalogTiles: availability.catalogTiles ?? [], bounds: page.sourceBounds };
      // A sampled empty image alone cannot prune finer source islands. Only
      // conclusive geometric/catalog absence ends this preparation subtree.
      record.stop = Boolean(availability.empty);
    }
    const polar = Math.floor(address.y / 2 ** address.level) === 0 || Math.floor(address.y / 2 ** address.level) === 15;
    const children = !record.stop && address.level < (polar ? polarLevel : regularLevel) ? childAddresses(address) : [];
    queue.push(...children);
    pages.push({ ...record, children: children.map(pageKey) });
    for (const key of record.tiles) sources.add(key);
    if (queue.length > COARSE_PREPARATION_LIMITS.pages || sources.size > COARSE_PREPARATION_LIMITS.sourceImages) {
      throw new Error('Global coarse plan exceeds its finite preparation bound.');
    }
    if (pages.length % 64 === 0) { await onProgress({ pages, queued: queue.length, sourceImages: sources.size }); await new Promise(resolve => setImmediate(resolve)); }
  }
  return { rootCount, regularLevel, polarLevel, pages, sourceKeys: [...sources].sort(), limits: COARSE_PREPARATION_LIMITS };
}
