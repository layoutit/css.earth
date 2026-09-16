import { createHash } from 'node:crypto';
import { fetchTap, tapUrl, type TapRequestConfig } from './tap.ts';
import { readArchiveImage, safeArchiveUrl, type ArchiveImage, type ArchiveProvider, type ArchiveQuery, type ArchiveTarget } from './model.ts';


const columns = 'obs_id,obs_publisher_did,obs_collection,target_name,calib_level,s_ra,s_dec,s_fov,s_region,s_resolution,s_xel1,s_xel2,em_min,em_max,t_exptime,access_url,access_format,access_estsize,instrument_name,facility_name';
export function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}
function positive(value: unknown): number | null { const number = numberValue(value); return number !== null && number > 0 ? number : null; }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() && value !== 'NULL' ? value.trim() : null; }
export function queryWhere(provider: ArchiveProvider, object: ArchiveTarget, radius: number) {
  const ra = object.raDegrees, dec = object.decDegrees;
  const common = "dataproduct_type='image' AND calib_level>=2 AND access_url IS NOT NULL";
  if (provider !== 'mast') {
    return `${common} AND INTERSECTS(s_region,CIRCLE('ICRS',${ra},${dec},${radius}))=1`;
  }
  // Indexed numeric bounds avoid MAST's currently slow/unsupported spatial predicates.
  const lowDec = Math.max(-90, dec - radius), highDec = Math.min(90, dec + radius);
  const halfRA = Math.min(180, radius / Math.cos(Math.max(Math.abs(lowDec), Math.abs(highDec)) * Math.PI / 180));
  let longitude = '';
  if (halfRA < 180) {
    const low = (ra - halfRA + 360) % 360, high = (ra + halfRA) % 360;
    longitude = low < high ? ` AND s_ra>=${low} AND s_ra<=${high}` : ` AND (s_ra>=${low} OR s_ra<=${high})`;
  }
  return `${common} AND access_format LIKE '%fits%' AND s_dec>=${lowDec} AND s_dec<=${highDec}${longitude}`;
}
export function imageFromRow(provider: ArchiveProvider, row: Record<string, unknown>, queryUrl: string): ArchiveImage {
  const accessUrl = safeArchiveUrl(row.access_url), nativeId = stringValue(row.obs_publisher_did) ?? stringValue(row.obs_id);
  if (!nativeId) throw new TypeError('Archive image has no published identity.');
  // A MAST observation DID can own multiple files; a file URI is part of identity.
  const id = `${nativeId}#${createHash('sha256').update(accessUrl ?? '').digest('hex').slice(0,16)}`;
  const size = positive(row.access_estsize), format = stringValue(row.access_format);
  let previewUrl: string | null = null, sourceUrl = accessUrl ?? queryUrl;
  if (provider === 'eso') {
    const id = nativeId.split('?').at(-1);
    if (id?.startsWith('ADP.')) sourceUrl = `https://archive.eso.org/dataset/${encodeURIComponent(id)}`;
  }
  if (provider === 'mast' && accessUrl) {
    const uri = new URL(accessUrl).searchParams.get('uri');
    // No invented preview path: thumbnail URLs are resolved from DataLink/metadata later.
    if (uri) sourceUrl = `https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html?searchQuery=${encodeURIComponent(JSON.stringify({ service: 'CAOM', inputText: stringValue(row.obs_id) ?? nativeId }))}`;
  }
  if (format?.startsWith('image/') && !format.includes('fits')) previewUrl = accessUrl;
  return readArchiveImage({ id, provider, collection: stringValue(row.obs_collection) ?? 'Unknown collection',
    title: stringValue(row.target_name) ?? stringValue(row.obs_id) ?? nativeId,
    instrument: stringValue(row.instrument_name) ?? 'Unknown instrument', facility: stringValue(row.facility_name) ?? '',
    calibrationLevel: numberValue(row.calib_level), raDegrees: numberValue(row.s_ra), decDegrees: numberValue(row.s_dec),
    fieldDegrees: positive(row.s_fov), footprint: stringValue(row.s_region), resolutionArcsec: positive(row.s_resolution),
    width: positive(row.s_xel1), height: positive(row.s_xel2), wavelengthMinMeters: positive(row.em_min), wavelengthMaxMeters: positive(row.em_max),
    exposureSeconds: positive(row.t_exptime),
    // MAST ObsCore labels this kbyte, but current HST responses contain bytes (verified by HEAD).
    // Do not extrapolate that mismatch to other files: only per-file HEAD gives a trustworthy size.
    estimatedBytes: provider === 'mast' || size === null ? null : size * 1000,
    accessUrl, accessFormat: format, sourceUrl, previewUrl });
}
export interface ArchiveDiscoveryConfig { endpoint: string; radiusDegrees: number; transport: TapRequestConfig }
export function pendingQuery(provider: ArchiveProvider, config: ArchiveDiscoveryConfig): ArchiveQuery {
  return { provider, status: 'pending', queriedAt: null, endpoint: config.endpoint, query: '', radiusDegrees: config.radiusDegrees,
    matchedCount: null, matchedEstimatedBytes: null, matchedUnknownSizeCount: null, images: [] };
}
export async function inventoryQuery(provider: ArchiveProvider, object: ArchiveTarget, maxRecords: number, config: ArchiveDiscoveryConfig, signal?: AbortSignal): Promise<ArchiveQuery> {
  const base = pendingQuery(provider, config), where = queryWhere(provider, object, config.radiusDegrees);
  const query = `SELECT TOP ${maxRecords + 1} ${columns} FROM ivoa.ObsCore WHERE ${where}`;
  base.query = query; base.queriedAt = new Date().toISOString();
  try {
    const result = await fetchTap(base.endpoint, query, maxRecords + 1, config.transport, signal);
    const unique = new Map<string, ArchiveImage>();
    for (const row of result.rows) { const image = imageFromRow(provider, row, result.url); unique.set(image.id, image); }
    const capped = result.overflow || result.rows.length > maxRecords;
    base.images = [...unique.values()].slice(0, maxRecords);
    base.responseSha256 = createHash('sha256').update(result.bytes).digest('hex');
    base.status = capped ? 'truncated' : 'complete';
    base.matchedCount = capped ? null : base.images.length;
    base.matchedUnknownSizeCount = capped ? null : base.images.filter(i => i.estimatedBytes === null).length;
    base.matchedEstimatedBytes = capped ? null : base.images.reduce((sum, i) => sum + (i.estimatedBytes ?? 0), 0);
    return base;
  } catch (error) {
    signal?.throwIfAborted();
    return { ...base, status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}
export function metadataQueryUrl(query: ArchiveQuery): string { return tapUrl(query.endpoint, query.query, 2001).href; }
