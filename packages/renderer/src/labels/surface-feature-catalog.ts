import { parsePreparedSurfaceFeatureCatalog, type PreparedSurfaceFeaturePlan, type SurfaceFeatureCatalogDescriptor, type ParsedSurfaceFeature as PreparedSurfaceFeature, type ParsedSurfaceFeatureCatalog as PreparedSurfaceFeatureCatalog } from '@cssearth/objects';
import { surfaceFeatureBankIndex } from './surface-feature-banks.js';

export type SurfaceFeatureTransport = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

async function loadCatalogFile(plan: PreparedSurfaceFeaturePlan, objectId: string, descriptor: SurfaceFeatureCatalogDescriptor,
  signal: AbortSignal, transport: SurfaceFeatureTransport): Promise<PreparedSurfaceFeatureCatalog> {
  const response = await transport(descriptor.url, { signal });
  if (!response.ok) throw new Error(`Surface feature catalogue ${objectId} ${descriptor.url} failed: HTTP ${response.status}.`);
  return parsePreparedSurfaceFeatureCatalog(await response.json() as unknown, plan, objectId, descriptor);
}

/** Fetch the default label catalogue. */
export async function loadPreparedSurfaceFeatureCatalog(plan: PreparedSurfaceFeaturePlan, objectId: string, signal: AbortSignal,
  transport: SurfaceFeatureTransport = (url, init) => fetch(url, init)): Promise<PreparedSurfaceFeatureCatalog> {
  return loadCatalogFile(plan, objectId, plan.catalog, signal, transport);
}

/** Resolve and load only the bank that can contain a search-only feature. */
export async function loadPreparedSurfaceFeatureBank(plan: PreparedSurfaceFeaturePlan, objectId: string, id: string, signal: AbortSignal,
  transport: SurfaceFeatureTransport = (url, init) => fetch(url, init)): Promise<PreparedSurfaceFeatureCatalog | null> {
  if (!plan.selection) return null;
  const descriptor = plan.selection.banks[surfaceFeatureBankIndex(id, plan.selection.banks.length)];
  if (!descriptor) throw new TypeError('Surface feature selection bank is missing.');
  return loadCatalogFile(plan, objectId, descriptor, signal, transport);
}

/** Resolve one selected feature without admitting every search-only outline into memory. */
export async function loadPreparedSurfaceFeature(plan: PreparedSurfaceFeaturePlan, objectId: string, id: string, signal: AbortSignal,
  transport: SurfaceFeatureTransport = (url, init) => fetch(url, init), base?: PreparedSurfaceFeatureCatalog): Promise<PreparedSurfaceFeature | null> {
  const catalog = base ?? await loadPreparedSurfaceFeatureCatalog(plan, objectId, signal, transport);
  const resident = catalog.features.find(feature => feature.id === id);
  if (resident) return resident;
  const bank = await loadPreparedSurfaceFeatureBank(plan, objectId, id, signal, transport);
  return bank?.features.find(feature => feature.id === id) ?? null;
}
