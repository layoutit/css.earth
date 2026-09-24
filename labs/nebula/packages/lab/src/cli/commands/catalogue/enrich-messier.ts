/** Bounded metadata GETs and file HEADs only. Call after inventory acquisition has stopped. */
import { createHash } from 'node:crypto';
import { readArchiveImage, safeArchiveUrl, type ArchiveImage } from '../../../features/catalogue/types.ts';
import { isRecord as record } from '@cssearth/core';

export interface MetadataLink {
  id: string; url: string; semantics: string; contentType: string; contentLength: number | null;
}
export interface MetadataEvidence {
  stage: 'datalink' | 'mast-preview' | 'science-head' | 'preview-head';
  status: 'resolved' | 'unavailable' | 'error'; requestUrl: string; resolvedUrl?: string;
  retrievedAt: string; httpStatus?: number; responseSha256?: string; responseBytes?: number;
  contentType?: string; contentLength?: number; etag?: string; lastModified?: string;
  links?: MetadataLink[]; previewScope?: 'observation'; note?: string; error?: string;
}
export interface EnrichedArchiveImage extends ArchiveImage {
  metadataOriginal: { publishedId: string; accessUrl: string | null; accessFormat: string | null; estimatedBytes: number | null; previewUrl: string | null };
  metadataEvidence: MetadataEvidence[];
}
type Fetcher = typeof fetch;
const metadataLimit = 2 * 1024 * 1024;
const imageMime = /^image\/(?:jpeg|png|webp|gif)$/i;
const fitsMime = /^(?:application|image)\/(?:x-)?fits(?:;|$)/i;
const did = (image: ArchiveImage) => image.id.replace(/#[a-f0-9]{16}$/, '');

function byteLength(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function decodeXml(value: string): string {
  const decoded = value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (!entity.startsWith('#')) return named[entity.toLowerCase()]!;
    const code = Number.parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10);
    if (!Number.isInteger(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new TypeError('Invalid XML character.');
    return String.fromCodePoint(code);
  });
  if (/&(?:[a-z][\w.-]*|#\w+);/i.test(decoded)) throw new TypeError('Unsupported XML entity.');
  return decoded.trim();
}
function attributes(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(match => [match[1]!.toLowerCase(), decodeXml(match[2] ?? match[3] ?? '')]));
}

/** Only the standard, textual TABLEDATA representation is accepted; no entity resolution. */
export function readDataLink(text: string, publishedId: string): MetadataLink[] {
  if (Buffer.byteLength(text) > metadataLimit || /<!DOCTYPE|<!ENTITY/i.test(text) || !/<(?:\w+:)?VOTABLE\b/i.test(text)) {
    throw new TypeError('Expected bounded VOTable DataLink metadata.');
  }
  for (const info of text.matchAll(/<(?:\w+:)?INFO\b([^>]*)>/gi)) {
    const a = attributes(info[1]!);
    if (a.name?.toUpperCase() === 'QUERY_STATUS' && ['ERROR', 'OVERFLOW'].includes(a.value?.toUpperCase() ?? '')) throw new Error('Incomplete DataLink response.');
  }
  const links: MetadataLink[] = [];
  let matchedTable = false;
  for (const table of text.matchAll(/<(?:\w+:)?TABLE\b[^>]*>([\s\S]*?)<\/(?:\w+:)?TABLE\s*>/gi)) {
    const body = table[1]!, fields = [...body.matchAll(/<(?:\w+:)?FIELD\b([^>]*)>/gi)].map(field => attributes(field[1]!));
    const names = fields.map(field => field.name?.toLowerCase());
    if (!['id', 'access_url', 'semantics', 'content_type'].every(name => names.includes(name))) continue;
    if (new Set(names).size !== names.length) throw new TypeError('Duplicate DataLink columns.');
    const lengthField = fields[names.indexOf('content_length')];
    if (lengthField && lengthField.unit?.toLowerCase() !== 'byte') throw new TypeError('DataLink length unit is not byte.');
    const data = /<(?:\w+:)?TABLEDATA\b[^>]*>([\s\S]*?)<\/(?:\w+:)?TABLEDATA\s*>/i.exec(body);
    if (!data) throw new TypeError('DataLink must use textual TABLEDATA.');
    matchedTable = true;
    for (const row of data[1]!.matchAll(/<(?:\w+:)?TR\b[^>]*>([\s\S]*?)<\/(?:\w+:)?TR\s*>/gi)) {
      const cells = [...row[1]!.matchAll(/<(?:\w+:)?TD\b[^>]*(?:\/>|>([\s\S]*?)<\/(?:\w+:)?TD\s*>)/gi)].map(cell => {
        const value = (cell[1] ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, cdata: string) => cdata.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
        if (/<[^>]*>/.test(value)) throw new TypeError('Unexpected markup in DataLink cell.');
        return decodeXml(value);
      });
      if (cells.length !== names.length) throw new TypeError('Malformed DataLink row.');
      const get = (name: string) => cells[names.indexOf(name)] ?? '';
      if (get('id') !== publishedId) continue;
      if (get('semantics') === '#this' && get('error_message')) throw new Error(`DataLink science access: ${get('error_message').slice(0, 240)}`);
      if (get('error_message') || ['0', 'false'].includes(get('link_authorized').toLowerCase())) continue;
      const url = safeArchiveUrl(get('access_url'));
      if (!url || get('service_def')) continue;
      links.push({ id: publishedId, url, semantics: get('semantics'), contentType: get('content_type'), contentLength: byteLength(get('content_length')) });
    }
  }
  if (!matchedTable) throw new TypeError('No DataLink result table.');
  return links;
}

function secureProviderUrl(value: string): string {
  const url = new URL(value);
  // ESO publishes legacy http DataLinks; the identical documented endpoint supports HTTPS.
  if (url.protocol === 'http:' && ['archive.eso.org', 'irsa.ipac.caltech.edu', 'mast.stsci.edu'].includes(url.hostname)) url.protocol = 'https:';
  return url.href;
}
async function metadataGet(url: string, signal: AbortSignal | undefined, fetcher: Fetcher) {
  const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    headers: { Accept: 'application/json, application/x-votable+xml, application/xml', 'User-Agent': 'cssEarth-NebulaLab-MetadataInventory/1' } });
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !/(?:json|xml)/i.test(type) || (byteLength(response.headers.get('content-length')) ?? 0) > metadataLimit) {
    await response.body?.cancel();
    throw new Error(`Metadata HTTP ${response.status}; expected bounded XML/JSON, received ${type || 'unknown type'}.`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty metadata response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > metadataLimit) throw new Error('Metadata response exceeds 2 MiB.'); chunks.push(part.value); }
  } catch (error) { await reader.cancel(); throw error; }
  const bytes = Buffer.concat(chunks);
  return { text: bytes.toString('utf8'), resolvedUrl: response.url || url, httpStatus: response.status, contentType: type,
    responseBytes: bytes.length, responseSha256: createHash('sha256').update(bytes).digest('hex') };
}
async function head(url: string, stage: 'science-head' | 'preview-head', signal: AbortSignal | undefined, fetcher: Fetcher): Promise<MetadataEvidence> {
  const requestUrl = secureProviderUrl(url), base = { stage, requestUrl, retrievedAt: new Date().toISOString() };
  try {
    const response = await fetcher(requestUrl, { method: 'HEAD', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
    const contentLength = byteLength(response.headers.get('content-length'));
    const mastPlainFile = stage === 'science-head' && new URL(requestUrl).hostname === 'mast.stsci.edu' && contentType === 'text/plain' &&
      /\.fits(?:\.gz)?$/.test(new URL(requestUrl).searchParams.get('uri') ?? '') && response.headers.get('accept-ranges') === 'bytes' &&
      response.headers.has('etag') && contentLength !== null;
    const validType = stage === 'preview-head' ? imageMime.test(contentType) : fitsMime.test(contentType) || mastPlainFile || /^(application\/(octet-stream|gzip|x-gzip)|binary\/octet-stream)$/i.test(contentType);
    return { ...base, status: response.ok && validType ? 'resolved' : 'unavailable', httpStatus: response.status,
      resolvedUrl: response.url || requestUrl, contentType,
      ...(contentLength !== null ? { contentLength } : {}),
      ...(mastPlainFile ? { note: 'MAST serves this ObsCore FITS URI as text/plain. Size is the individual HEAD Content-Length; pixel payload and FITS structure were not downloaded or validated.' } : {}),
      ...(response.headers.get('etag') ? { etag: response.headers.get('etag')! } : {}),
      ...(response.headers.get('last-modified') ? { lastModified: response.headers.get('last-modified')! } : {}) };
  } catch (error) { signal?.throwIfAborted(); return { ...base, status: 'error', error: error instanceof Error ? error.message : String(error) }; }
}
function mastDownloadUrl(value: unknown): string | null {
  const direct = safeArchiveUrl(value); if (direct) return direct;
  if (typeof value !== 'string' || !/^mast:[^\s]+$/.test(value)) return null;
  // A provider-returned data URI is passed unchanged to MAST's documented resolver.
  return `https://mast.stsci.edu/api/v0.1/Download/file?${new URLSearchParams({ uri: value })}`;
}
async function mastPreview(image: ArchiveImage, signal: AbortSignal | undefined, fetcher: Fetcher) {
  const publishedId = did(image), match = /^ivo:\/\/archive\.stsci\.edu\/([^?]+)\?(.+)$/.exec(publishedId);
  if (!match) return null;
  const collection = match[1]!, observation = match[2]!;
  const request = { service: 'Mast.Caom.Filtered', params: { columns: 'obsid,obs_id,obs_collection,jpegURL,dataURL',
    filters: [{ paramName: 'obs_id', values: [observation] }, { paramName: 'obs_collection', values: [collection] }] }, format: 'json', pagesize: 20, page: 1 };
  const url = `https://mast.stsci.edu/api/v0/invoke?${new URLSearchParams({ request: JSON.stringify(request) })}`;
  const base = { stage: 'mast-preview' as const, requestUrl: url, retrievedAt: new Date().toISOString() };
  try {
    const response = await metadataGet(url, signal, fetcher), value: unknown = JSON.parse(response.text);
    if (!record(value) || value.status !== 'COMPLETE' || !Array.isArray(value.data) ||
        (record(value.paging) && Number(value.paging.rowsFiltered) > 20)) throw new TypeError('Incomplete MAST observation metadata.');
    const rows = value.data.filter((row: unknown) => record(row) && row.obs_id === observation && row.obs_collection === collection);
    const previews = rows.flatMap(row => {
      if (!record(row)) return [];
      const preview = mastDownloadUrl(row.jpegURL);
      return preview ? [{ id: publishedId, url: preview, semantics: '#preview', contentType: 'image/jpeg', contentLength: null }] : [];
    });
    const { text: _text, ...receipt } = response;
    return { ...base, ...receipt, status: previews.length === 1 ? 'resolved' as const : 'unavailable' as const, links: previews,
      previewScope: 'observation' as const };
  } catch (error) { signal?.throwIfAborted(); return { ...base, status: 'error' as const, error: error instanceof Error ? error.message : String(error) }; }
}

export async function enrichImageMetadata(image: ArchiveImage, signal?: AbortSignal, fetcher: Fetcher = fetch): Promise<EnrichedArchiveImage> {
  readArchiveImage(image); signal?.throwIfAborted();
  const result: EnrichedArchiveImage = { ...image, metadataOriginal: { publishedId: did(image), accessUrl: image.accessUrl,
    accessFormat: image.accessFormat, estimatedBytes: image.estimatedBytes, previewUrl: image.previewUrl }, metadataEvidence: [] };
  let preview = image.previewUrl;
  if (image.accessUrl && /datalink/i.test(image.accessFormat ?? '')) {
    const url = secureProviderUrl(image.accessUrl), base = { stage: 'datalink' as const, requestUrl: url, retrievedAt: new Date().toISOString() };
    try {
      const response = await metadataGet(url, signal, fetcher), links = readDataLink(response.text, did(image));
      const science = links.filter(link => link.semantics === '#this' && fitsMime.test(link.contentType));
      const previews = links.filter(link => link.semantics === '#preview' && imageMime.test(link.contentType));
      const { text: _text, ...receipt } = response;
      result.metadataEvidence.push({ ...base, ...receipt, status: science.length === 1 ? 'resolved' : 'unavailable', links });
      // Multiple science files are a compound dataset. Never pick an arbitrary member.
      if (science.length === 1) { result.accessUrl = science[0]!.url; result.accessFormat = science[0]!.contentType;
        result.estimatedBytes = science[0]!.contentLength; }
      if (previews.length === 1) preview = previews[0]!.url;
    } catch (error) { signal?.throwIfAborted(); result.metadataEvidence.push({ ...base, status: 'error', error: error instanceof Error ? error.message : String(error) }); }
  } else if (image.provider === 'mast') {
    const receipt = await mastPreview(image, signal, fetcher);
    if (receipt) { result.metadataEvidence.push(receipt); if (receipt.status === 'resolved') preview = receipt.links?.[0]?.url ?? preview; }
  }
  if (result.accessUrl && fitsMime.test(result.accessFormat ?? '')) {
    const receipt = await head(result.accessUrl, 'science-head', signal, fetcher); result.metadataEvidence.push(receipt);
    if (receipt.status === 'resolved' && receipt.contentLength !== undefined) result.estimatedBytes = receipt.contentLength;
  }
  if (preview) {
    const receipt = await head(preview, 'preview-head', signal, fetcher); result.metadataEvidence.push(receipt);
    if (receipt.status === 'resolved') result.previewUrl = receipt.resolvedUrl ?? preview;
  }
  readArchiveImage(result);
  return result;
}

/** At most three per instrument/band/collection, round-robin so one group cannot fill the cap. */
export function selectEnrichmentCandidates(images: ArchiveImage[], maximum = 12): ArchiveImage[] {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 12) throw new RangeError('Select 1–12 representative images.');
  const groups = new Map<string, ArchiveImage[]>();
  const candidates = images.filter(image => image.accessUrl && (fitsMime.test(image.accessFormat ?? '') || /datalink/i.test(image.accessFormat ?? '')) &&
    !/(?:_asn|[-_]mcat|[-_]xd-mcat)\.fits(?:\.gz)?(?:$|[?&])/i.test(decodeURIComponent(image.accessUrl)));
  candidates.sort((a, b) => b.calibrationLevel - a.calibrationLevel || (b.fieldDegrees ?? 0) - (a.fieldDegrees ?? 0) || a.id.localeCompare(b.id));
  for (const image of candidates) {
    const key = JSON.stringify([image.provider, image.collection, image.instrument, image.wavelengthMinMeters, image.wavelengthMaxMeters]);
    const group = groups.get(key) ?? []; if (group.length < 3 && !group.some(previous => previous.id === image.id)) group.push(image); groups.set(key, group);
  }
  const selected: ArchiveImage[] = [];
  for (let rank = 0; rank < 3; rank++) for (const group of groups.values()) {
    if (group[rank]) selected.push(group[rank]!);
    if (selected.length === maximum) return selected;
  }
  return selected;
}
