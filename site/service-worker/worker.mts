/// <reference lib="webworker" />
import {
  CACHE_PREFIX, evictionPlan, INDEX_CACHE, isNetworkDown, networkDownUntil, INDEX_URL, isStorableRoute, offlinePageFallback, parseIndex, parsePutMessage,
  parseUrlsMessage, responseValidator, routeRequest, RUNTIME_CACHE, runtimeBudget, STORE_MESSAGE, TOUCH_MESSAGE,
  type IndexEntry, type PutMessage,
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

async function put({ url, body, headers }: PutMessage) {
  if (!isStorableRoute(routeRequest({ url, method: 'GET', scope: self.registration.scope }))) return;
  const responseHeaders = new Headers(headers);
  try {
    await (await caches.open(RUNTIME_CACHE)).put(url, new Response(body, { status: 200, headers: responseHeaders }));
  } catch {
    // Storage is full or refused: drop the copies rather than keep a partial
    // set that would fail offline anyway. The next visit starts again.
    await Promise.all([caches.delete(RUNTIME_CACHE), caches.delete(INDEX_CACHE)]);
    index = new Map();
    return;
  }
  (await loadIndex()).set(url, { url, bytes: body.byteLength, used: Date.now(), validator: responseValidator(responseHeaders) });
  scheduleIndexWrite();
  await requestTrim();
}

async function markUsed(urls: readonly string[]) {
  const entries = await loadIndex();
  const now = Date.now();
  for (const url of urls) { const entry = entries.get(url); if (entry) entry.used = now; }
  scheduleIndexWrite();
}

// Answers which of the page's files are worth sending and what version of
// each is already stored, so the page only reads and sends changed files.
async function known(urls: readonly string[]): Promise<Record<string, string | null>> {
  const entries = await loadIndex();
  const answer: Record<string, string | null> = {};
  for (const url of urls) {
    if (!isStorableRoute(routeRequest({ url, method: 'GET', scope: self.registration.scope }))) continue;
    answer[url] = entries.get(url)?.validator ?? null;
  }
  return answer;
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

self.addEventListener('install', () => { void self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && !OWNED_CACHES.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const [port] = event.ports;
  const ask = parseUrlsMessage(event.data, STORE_MESSAGE);
  if (ask && port) { event.waitUntil(known(ask).then(answer => port.postMessage(answer))); return; }
  const used = parseUrlsMessage(event.data, TOUCH_MESSAGE);
  if (used) { event.waitUntil(markUsed(used)); return; }
  const message = parsePutMessage(event.data);
  if (message) event.waitUntil(put(message));
});

// Streaming responses through the worker costs about half a second per scene
// load, even without copying them. So online subresources skip it entirely;
// only page loads, one request each, always get the stored fallback. A failed
// request marks the network as down for a short window, because
// navigator.onLine can still report a connection that no longer answers.
// While it is down, stored files answer first; afterwards the network is tried
// first again, so a returning connection is never ignored.
let downUntil = 0;

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    downUntil = 0;
    return response;
  } catch {
    downUntil = networkDownUntil(Date.now());
    return offlineAnswer(request);
  }
}

async function storedFirst(request: Request): Promise<Response> {
  const hit = await cached(request.url);
  return hit ?? networkFirst(request);
}

self.addEventListener('fetch', event => {
  if (event.request.headers.has('range')) return;
  const { request } = event;
  const navigation = request.mode === 'navigate';
  const down = isNetworkDown(downUntil, Date.now());
  if (!navigation && !down && self.navigator.onLine) return;
  const route = routeRequest({ url: request.url, method: request.method, scope: self.registration.scope });
  if (route.kind === 'bypass') return;
  event.respondWith(!navigation && down ? storedFirst(request) : networkFirst(request));
});
