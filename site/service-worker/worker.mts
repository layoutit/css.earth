/// <reference lib="webworker" />
import {
  evictionPlan, INDEX_CACHE, INDEX_URL, offlinePageFallback, parseIndex, routeRequest,
  RUNTIME_CACHE, runtimeBudget, type IndexEntry,
} from './policy.mts';

declare const self: ServiceWorkerGlobalScope;

const OWNED_CACHES = new Set([RUNTIME_CACHE, INDEX_CACHE]);
const INDEX_WRITE_DELAY_MS = 2000;

let index: Map<string, IndexEntry> | null = null;
let indexWrite: ReturnType<typeof setTimeout> | null = null;
let trimming: Promise<void> | null = null;

async function loadIndex(): Promise<Map<string, IndexEntry>> {
  if (index) return index;
  const stored = await (await caches.open(INDEX_CACHE)).match(INDEX_URL);
  let entries: IndexEntry[] = [];
  try { entries = parseIndex(stored ? await stored.json() : []); } catch { entries = []; }
  // Rebuild entries the index lost when the worker stopped before a write.
  const runtime = await caches.open(RUNTIME_CACHE);
  const known = new Map(entries.map(entry => [entry.url, entry]));
  for (const request of await runtime.keys()) {
    if (!known.has(request.url)) known.set(request.url, { url: request.url, bytes: 0, used: 0 });
  }
  index ??= known;
  return index;
}

function scheduleIndexWrite() {
  if (indexWrite !== null) return;
  indexWrite = setTimeout(() => {
    indexWrite = null;
    if (!index) return;
    const body = JSON.stringify([...index.values()]);
    void caches.open(INDEX_CACHE).then(cache => cache.put(INDEX_URL, new Response(body, {
      headers: { 'content-type': 'application/json' },
    })));
  }, INDEX_WRITE_DELAY_MS);
}

async function touch(url: string) {
  const entries = await loadIndex();
  const entry = entries.get(url);
  if (!entry) return;
  entry.used = Date.now();
  scheduleIndexWrite();
}

async function trim() {
  const entries = await loadIndex();
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const evicted = evictionPlan([...entries.values()], runtimeBudget(estimate?.quota));
  if (!evicted.length) return;
  const runtime = await caches.open(RUNTIME_CACHE);
  await Promise.all(evicted.map(url => runtime.delete(url)));
  for (const url of evicted) entries.delete(url);
  scheduleIndexWrite();
}

function requestTrim(): Promise<void> {
  trimming ??= trim().finally(() => { trimming = null; });
  return trimming;
}

async function store(request: Request, response: Response) {
  // Partial, redirected and error responses would replay the wrong bytes offline.
  if (response.status !== 200 || response.type !== 'basic' || response.redirected) return;
  const body = await response.arrayBuffer();
  const copy = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  await (await caches.open(RUNTIME_CACHE)).put(request.url, copy);
  (await loadIndex()).set(request.url, { url: request.url, bytes: body.byteLength, used: Date.now() });
  scheduleIndexWrite();
  await requestTrim();
}

async function cached(url: string): Promise<Response | undefined> {
  const response = await (await caches.open(RUNTIME_CACHE)).match(url);
  if (response) await touch(url);
  return response;
}

async function offlineAnswer(request: Request): Promise<Response> {
  const exact = await cached(request.url);
  if (exact) return exact;
  const fallback = request.mode === 'navigate' ? offlinePageFallback(request.url) : null;
  const page = fallback ? await cached(fallback) : undefined;
  return page ?? Response.error();
}

async function networkFirst(event: FetchEvent, keep: boolean): Promise<Response> {
  try {
    const response = await fetch(event.request);
    if (keep) event.waitUntil(store(event.request, response.clone()));
    return response;
  } catch {
    return offlineAnswer(event.request);
  }
}

async function cacheFirst(event: FetchEvent): Promise<Response> {
  const hit = await cached(event.request.url);
  if (hit) return hit;
  return networkFirst(event, true);
}

self.addEventListener('install', () => { void self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('cssearth-') && !OWNED_CACHES.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  // Range requests and background fetches keep their native behaviour.
  if (event.request.headers.has('range')) return;
  const route = routeRequest({ url: event.request.url, method: event.request.method, scope: self.registration.scope });
  if (route.kind === 'bypass') return;
  if (route.kind === 'immutable') event.respondWith(cacheFirst(event));
  else event.respondWith(networkFirst(event, route.kind === 'network-first'));
});
