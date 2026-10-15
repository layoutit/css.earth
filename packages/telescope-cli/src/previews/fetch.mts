import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';
import { voUrl } from '../vo/network-policy.mts';
import { extractPreview } from './extract.mts';
import { readPreviewFile } from './source.mts';
import { previewVotable } from './votable.mts';
import { ALMA_BYTES, ESO_BYTES, HST_BYTES, METADATA_BYTES, NO_PREVIEW, type PreviewData, type PreviewSource } from './types.mts';

export interface PreviewFetchOptions {
  readonly signal?: AbortSignal; readonly fetch?: typeof globalThis.fetch; readonly runDir: string;
  /** One deadline covers metadata traversal, redirects and the FITS body together. */
  readonly timeoutMs?: number;
}

function untilAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((done, fail) => {
    const abort = () => fail(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { signal.removeEventListener('abort', abort); done(value); }, error => { signal.removeEventListener('abort', abort); fail(error); });
    if (signal.aborted) abort();
  });
}
function https(value: string): string {
  const url = voUrl(value, value);
  if (new URL(url).protocol !== 'https:') throw new Error('Preview requests require HTTPS.');
  return url;
}

function transport(options: PreviewFetchOptions, signal: AbortSignal) {
  const fetcher = options.fetch ?? globalThis.fetch;
  let totalMetadata = 0, metadataRequests = 0;
  const request = async (address: string, maximum: number, init: RequestInit = {}): Promise<Uint8Array> => {
    let url = https(address);
    for (let redirects = 0; ; redirects++) {
      signal.throwIfAborted();
      const response = await untilAbort(fetcher(url, { ...init, redirect: 'manual', signal }), signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        void response.body?.cancel().catch(() => {});
        const location = response.headers.get('location');
        if (!location || redirects >= 4) throw new Error('Preview redirect limit reached.');
        url = https(new URL(location, url).href); continue;
      }
      if (!response.ok) { void response.body?.cancel().catch(() => {}); throw new Error(`Preview archive returned HTTP ${response.status}.`); }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maximum)) {
        void response.body?.cancel().catch(() => {}); throw new Error('Preview exceeds its byte limit.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Preview archive returned an empty body.');
      const chunks: Uint8Array[] = [];
      let size = 0, complete = false;
      try {
        for (;;) {
          const read = await untilAbort(reader.read(), signal);
          if (read.done) { complete = true; break; }
          size += read.value.byteLength;
          if (size > maximum) throw new Error('Preview exceeds its byte limit.');
          chunks.push(read.value);
        }
      } finally { if (!complete) void reader.cancel().catch(() => {}); reader.releaseLock(); }
      signal.throwIfAborted();
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return bytes;
    }
  };
  const metadata = async (url: string, init?: RequestInit): Promise<string> => {
    if (++metadataRequests > 24) throw new Error('Preview metadata request limit reached.');
    const bytes = await request(url, METADATA_BYTES - totalMetadata, init);
    totalMetadata += bytes.byteLength;
    return new TextDecoder().decode(bytes);
  };
  return { request, metadata };
}
type Transport = ReturnType<typeof transport>;

async function mast(api: Transport, service: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const raw: unknown = JSON.parse(await api.metadata('https://mast.stsci.edu/api/v0/invoke', { method: 'POST',
    body: new URLSearchParams({ request: JSON.stringify({ service, format: 'json', pagesize: 500, page: 1, params }) }) }));
  const response = requireRecord(raw);
  if (response.status !== 'COMPLETE' || typeof response.paging === 'object' && response.paging !== null && 'pagesFiltered' in response.paging && Number(response.paging.pagesFiltered) > 1)
    throw new Error('MAST preview query did not complete within its bounds.');
  return requireArray(response.data).map(row => requireRecord(row));
}

type HstResolution = { readonly kind: 'spectrum'; readonly uri: string } | Extract<PreviewData, { kind: 'none' }>;
function hstResolution(value: unknown, obsId: string): HstResolution {
  const data = requireRecord(value);
  if (data.kind === 'none') return { kind: 'none', reason: requireString(data.reason) };
  const uri = requireString(data.uri), filename = uri.split('/').at(-1) ?? '';
  if (data.kind !== 'spectrum' || !uri.startsWith('mast:HST/') || !filename.startsWith(`${obsId}_`) || !/_(x1d|sx1)\.fits$/iu.test(filename))
    throw new Error('Invalid cached preview HST source.');
  return { kind: 'spectrum', uri };
}

async function resolveHst(source: Extract<PreviewSource, { kind: 'hst' }>, api: Transport): Promise<HstResolution> {
  const observations = await mast(api, 'Mast.Caom.Filtered', { columns: 'obsid,obs_id',
    filters: [{ paramName: 'obs_collection', values: ['HST'] }, { paramName: 'obs_id', values: [source.obsId] }] });
  const matches = observations.filter(row => row.obs_id === source.obsId);
  if (matches.length !== 1 || !['string', 'number'].includes(typeof matches[0]!.obsid)) throw new Error('MAST preview observation identity is ambiguous or missing.');
  const products = await mast(api, 'Mast.Caom.Products', { obsid: String(matches[0]!.obsid) });
  const choices = products.filter(row => typeof row.productFilename === 'string' && row.productFilename.startsWith(`${source.obsId}_`) && /_(x1d|sx1)\.fits$/iu.test(row.productFilename)
    && typeof row.size === 'number' && row.size > 0 && row.size <= HST_BYTES && typeof row.dataURI === 'string'
    && row.dataURI.startsWith('mast:HST/') && row.dataURI.endsWith(`/${row.productFilename}`));
  choices.sort((a, b) => String(a.productFilename).localeCompare(String(b.productFilename), 'en'));
  const product = choices[0];
  if (!product) return { kind: 'none', reason: NO_PREVIEW };
  return { kind: 'spectrum', uri: requireString(product.dataURI) };
}

async function hstPreview(source: Extract<PreviewSource, { kind: 'hst' }>, api: Transport, directory: string, signal: AbortSignal): Promise<PreviewData> {
  const path = resolve(directory, `${source.pick}.source.json`), identity = JSON.stringify(source);
  const cached = await readCache(path, identity, 'cssearth-telescope-preview-source@1', value => hstResolution(value, source.obsId), signal);
  const resolved = cached ?? await resolveHst(source, api);
  if (!cached) await writeCache(path, identity, 'cssearth-telescope-preview-source@1', resolved, signal);
  if (resolved.kind === 'none') return resolved;
  const url = new URL('https://mast.stsci.edu/api/v0.1/Download/file'); url.searchParams.set('uri', resolved.uri);
  return extractPreview(await api.request(url.href, HST_BYTES), 'hst', 'spectrum');
}

async function almaPreview(source: Extract<PreviewSource, { kind: 'alma' }>, api: Transport): Promise<PreviewData> {
  const datalink = (id: string) => `https://almascience.org/datalink/sync?ID=${encodeURIComponent(id)}`;
  const root = previewVotable(await api.metadata(datalink(source.member)));
  const products = new Map<string, { id: string; kind: 'cube' | 'image' }>();
  const memberName = `member.${source.member.replace('uid://', 'uid___').replaceAll('/', '_')}.`;
  const collect = (links: ReturnType<typeof previewVotable>) => {
    for (const row of links.rows) {
      if (row.error_message || !row.semantics?.endsWith('#cutout')) continue;
      const descriptor = links.services.find(service => service.id === row.service_def && service.standard === 'ivo://ivoa.net/std/SODA#sync-1.0');
      if (!descriptor) continue;
      const url = new URL(https(descriptor.url)), id = url.searchParams.get('ID');
      if (!id || !id.startsWith(memberName)) continue;
      const afterMember = id.slice(memberName.length);
      // A member also lists its calibrators: bind the target portion, not just the member and spectral window.
      if (!afterMember.startsWith(`${source.target}_sci.`) && !afterMember.startsWith(`${source.target}.`)) continue;
      if (/\.mfs\..*\.pbcor\.fits$/u.test(id)) products.set(id, { id, kind: 'image' });
      if (source.spw !== undefined && new RegExp(`\\.spw${source.spw}\\.cube\\..*\\.pbcor\\.fits$`, 'u').test(id)) products.set(id, { id, kind: 'cube' });
    }
  };
  collect(root);
  const nested = new Set<string>();
  for (const row of root.rows) {
    if (row.error_message || !row.semantics?.endsWith('#this')) continue;
    const descriptor = root.services.find(service => service.id === row.service_def && service.standard.startsWith('ivo://ivoa.net/std/DataLink#links-'));
    if (descriptor) nested.add(https(descriptor.url));
    else if (row.access_url && /\.tar(?:$|[?#])/u.test(row.access_url)) {
      const tar = decodeURIComponent(new URL(https(row.access_url)).pathname.split('/').at(-1) ?? '');
      if (tar) nested.add(datalink(tar));
    }
  }
  // The direct tar row and its service descriptor usually name the same DataLink.
  const seen = new Set<string>();
  for (const url of nested) {
    const id = new URL(url).searchParams.get('ID');
    if (!id || seen.has(id)) continue;
    seen.add(id); collect(previewVotable(await api.metadata(url)));
  }
  const selected = [...products.values()].sort((a, b) => Number(b.kind === 'cube') - Number(a.kind === 'cube') || a.id.localeCompare(b.id, 'en'))[0];
  if (!selected) return { kind: 'none', reason: NO_PREVIEW };
  const url = new URL('https://almascience.eso.org/soda/sync');
  url.searchParams.set('ID', selected.id); url.searchParams.set('CIRCLE', `${source.ra} ${source.dec} 0.0004`);
  return extractPreview(await api.request(url.href, ALMA_BYTES), 'alma', selected.kind);
}

function cachedData(value: unknown): PreviewData {
  const data = requireRecord(value), numbers = (value: unknown) => requireArray(value).map(cell => {
    if (typeof cell !== 'number' || !Number.isFinite(cell)) throw new Error('Invalid cached preview sample.'); return cell;
  });
  if (data.kind === 'none') return { kind: 'none', reason: requireString(data.reason) };
  if (data.kind === 'spectrum') {
    const x = numbers(data.x), y = numbers(data.y);
    if (x.length < 2 || x.length > 90 || x.length !== y.length) throw new Error('Invalid cached preview spectrum.');
    return { kind: 'spectrum', x, y, xunit: requireString(data.xunit), yunit: requireString(data.yunit) };
  }
  if (data.kind === 'image') {
    const grid = requireArray(data.grid).map(numbers);
    if (grid.length !== 30 || grid.some(row => row.length !== 60 || row.some(value => value < 0 || value > 1))) throw new Error('Invalid cached preview image.');
    return { kind: 'image', grid, caption: requireString(data.caption) };
  }
  throw new Error('Invalid cached preview kind.');
}

async function readCache<T>(path: string, identity: string, schema: string, parse: (value: unknown) => T, signal: AbortSignal): Promise<T | undefined> {
  try {
    const saved = requireRecord(JSON.parse(await untilAbort(readPreviewFile(path, 128 * 1024), signal)));
    if (saved.schema === schema && saved.source === identity) return parse(saved.data);
  } catch (error) {
    signal.throwIfAborted();
    if (!hasErrorCode(error, 'ENOENT') && !(error instanceof SyntaxError) && !(error instanceof TypeError) && !(error instanceof Error && /cached preview|Preview record exceeds/u.test(error.message))) throw error;
  }
  return undefined;
}

async function writeCache(path: string, identity: string, schema: string, data: unknown, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.partial`;
  try {
    await writeFile(temporary, `${JSON.stringify({ schema, source: identity, data })}\n`, { flag: 'wx' });
    signal.throwIfAborted(); await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

/** Reads through the data cache first, so a later visit needs neither metadata nor science downloads. Throws on failure/abort. */
export async function fetchPreview(source: PreviewSource, options: PreviewFetchOptions): Promise<PreviewData> {
  if (!Number.isSafeInteger(source.pick) || source.pick < 1) throw new Error('Invalid preview pick.');
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid preview timeout.');
  const deadline = new AbortController(), signal = options.signal ? AbortSignal.any([deadline.signal, options.signal]) : deadline.signal;
  const timer = setTimeout(() => deadline.abort(new Error('Preview request timed out.')), timeoutMs);
  const directory = resolve(options.runDir, 'previews'), path = resolve(directory, `${source.pick}.json`), identity = JSON.stringify(source);
  try {
    signal.throwIfAborted();
    const cached = await readCache(path, identity, 'cssearth-telescope-preview@1', cachedData, signal);
    if (cached) return cached;
    const api = transport(options, signal);
    const data = source.kind === 'none' ? { kind: 'none' as const, reason: source.reason }
      : source.kind === 'hst' ? await hstPreview(source, api, directory, signal) : source.kind === 'alma' ? await almaPreview(source, api)
        : extractPreview(await api.request(source.url, ESO_BYTES), 'eso', source.product, source.instrument);
    signal.throwIfAborted();
    await writeCache(path, identity, 'cssearth-telescope-preview@1', data, signal);
    return data;
  } finally { clearTimeout(timer); }
}
