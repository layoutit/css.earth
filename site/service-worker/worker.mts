/// <reference lib="webworker" />
import {
  evictionPlan, INDEX_CACHE, INDEX_URL, offlinePageFallback, parseIndex, parseStoreMessage, responseValidator,
  routeRequest, RUNTIME_CACHE, runtimeBudget, STORE_CONCURRENCY, type IndexEntry,
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

async function store(url: string, response: Response) {
  // Partial, redirected and error responses would replay the wrong bytes offline.
  if (response.status !== 200 || response.type !== 'basic' || response.redirected) return;
  const entries = await loadIndex();
  const validator = responseValidator(response.headers);
  const known = entries.get(url);
  if (validator && known?.validator === validator) {
    await response.body?.cancel();
    known.used = Date.now();
    scheduleIndexWrite();
    return;
  }
  const body = await response.arrayBuffer();
  const copy = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  await (await caches.open(RUNTIME_CACHE)).put(url, copy);
  entries.set(url, { url, bytes: body.byteLength, used: Date.now(), validator });
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

// Copies what the page has just loaded. The browser's HTTP cache usually
// answers, so this rarely touches the network.
async function keep(url: string) {
  const route = routeRequest({ url, method: 'GET', scope: self.registration.scope });
  if (route.kind !== 'immutable' && route.kind !== 'network-first') return;
  if (route.kind === 'immutable' && await cached(url)) return;
  try {
    await store(url, await fetch(url, { cache: 'force-cache', credentials: 'same-origin' }));
  } catch {
    // The copy is best effort; the next visit tries again.
  }
}

async function keepAll(urls: readonly string[]) {
  const queue = [...urls];
  await Promise.all(Array.from({ length: STORE_CONCURRENCY }, async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) await keep(url);
  }));
}

self.addEventListener('install', () => { void self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('cssearth-') && !OWNED_CACHES.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const urls = parseStoreMessage(event.data);
  if (urls) event.waitUntil(keepAll(urls));
});

// Streaming responses through the worker costs about half a second per scene
// load, even without copying them. So online subresources skip it entirely;
// only page loads, one request each, always get the stored fallback. A page
// load that falls back marks the network as down, because navigator.onLine can
// still report a connection that no longer answers.
let networkDown = false;

async function page(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    networkDown = false;
    return response;
  } catch {
    networkDown = true;
    return offlineAnswer(request);
  }
}

self.addEventListener('fetch', event => {
  if (event.request.headers.has('range')) return;
  const { request } = event;
  const navigation = request.mode === 'navigate';
  if (!navigation && !networkDown && self.navigator.onLine) return;
  const route = routeRequest({ url: request.url, method: request.method, scope: self.registration.scope });
  if (route.kind === 'bypass') return;
  event.respondWith(navigation ? page(request) : fetch(request).catch(() => offlineAnswer(request)));
});
