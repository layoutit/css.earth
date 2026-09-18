// Offline policy for the installed app. The worker keeps what the visitor has
// already loaded, never downloads ahead of them, and forgets the least recently
// used responses once the byte budget is spent.

export const CACHE_PREFIX = 'cssearth-';
export const RUNTIME_CACHE = 'cssearth-runtime-v1';
export const INDEX_CACHE = 'cssearth-runtime-index-v1';
export const INDEX_URL = '/__cssearth-runtime-index__';
export const RUNTIME_BUDGET_BYTES = 512 * 1024 * 1024;
// Leave room for other origins' storage on devices with small quotas.
export const QUOTA_SHARE = 0.5;
export const STORE_CONCURRENCY = 4;
export const STORE_MESSAGE = 'cssearth-store';
export const PUT_MESSAGE = 'cssearth-put';
export const TOUCH_MESSAGE = 'cssearth-touch';
const STORE_BATCH_LIMIT = 2000;

// Query parameters that route a page through the search function. Offline, the
// same page without them is the best available answer.
const SEARCH_PARAMETERS = ['q', 'dataset', 'settings', 'feature', 'v', 'focus', 'focusLens'];

export type RequestRoute =
  | { kind: 'bypass' }
  | { kind: 'immutable' }
  | { kind: 'network-first' }
  | { kind: 'network-only' };

export interface RouteInput {
  url: string;
  method: string;
  scope: string;
}

export function routeRequest({ url, method, scope }: RouteInput): RequestRoute {
  if (method !== 'GET') return { kind: 'bypass' };
  const target = new URL(url);
  const origin = new URL(scope).origin;
  if (target.origin !== origin) return { kind: 'bypass' };
  const path = target.pathname;
  if (path === '/sw.js' || path.startsWith('/.netlify/') || path.startsWith('/@') || path.startsWith('/node_modules/')) {
    return { kind: 'bypass' };
  }
  // Search answers are computed per request; only the plain page is kept.
  if (isPagePath(path) && SEARCH_PARAMETERS.some(name => target.searchParams.has(name))) return { kind: 'network-only' };
  if (isImmutablePath(path) && !target.search) return { kind: 'immutable' };
  return { kind: 'network-first' };
}

// The page routes netlify/edge-functions/search-route.ts sends to search.
export function isPagePath(path: string): boolean {
  return path === '/' || /^\/[a-z][a-z0-9-]*\/?$/u.test(path);
}

// Bundler output and prepared transports carry their content hash in the name,
// so a stored copy can never be stale.
export function isImmutablePath(path: string): boolean {
  return /^\/_astro\/[^/]+$/u.test(path)
    || /^\/objects\/[a-z][a-z0-9-]*\/[0-9a-f]{64}\.json$/u.test(path)
    || /^\/scenes\/[a-z][a-z0-9-]*\/[a-z0-9-]+-[0-9a-f]{16}\.webp$/u.test(path);
}

// A page opened offline falls back to its stored copy without view parameters.
export function offlinePageFallback(url: string): string | null {
  const target = new URL(url);
  if (!target.search && !target.hash) return null;
  return `${target.origin}${target.pathname}`;
}

export interface IndexEntry {
  url: string;
  bytes: number;
  used: number;
  validator?: string;
}

// The entity tag, or failing that the modification time, identifies the bytes
// already stored, so an unchanged response is never read or written again.
export function responseValidator(headers: { get(name: string): string | null }): string | undefined {
  const etag = headers.get('etag');
  if (etag) return `etag:${etag}`;
  const modified = headers.get('last-modified');
  const length = headers.get('content-length');
  return modified && length ? `modified:${modified}:${length}` : undefined;
}

export function runtimeBudget(quota: number | undefined): number {
  if (quota === undefined || !Number.isFinite(quota) || quota <= 0) return RUNTIME_BUDGET_BYTES;
  return Math.min(RUNTIME_BUDGET_BYTES, Math.floor(quota * QUOTA_SHARE));
}

// Least recently used entries go first until the rest fit the budget.
export function evictionPlan(entries: readonly IndexEntry[], budget: number): string[] {
  let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= budget) return [];
  const evicted: string[] = [];
  for (const entry of [...entries].sort((a, b) => a.used - b.used)) {
    if (total <= budget) break;
    evicted.push(entry.url);
    total -= entry.bytes;
  }
  return evicted;
}

export function parseIndex(value: unknown): IndexEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is IndexEntry => typeof entry === 'object' && entry !== null
    && typeof entry.url === 'string'
    && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0
    && Number.isFinite(entry.used)
    && (entry.validator === undefined || typeof entry.validator === 'string'));
}

// Pages send the same-origin files they loaded (to ask which the worker
// already holds, or to mark them used); anything else is ignored.
export function parseUrlsMessage(value: unknown, type: string): string[] | null {
  if (typeof value !== 'object' || value === null || !('type' in value) || value.type !== type) return null;
  if (!('urls' in value) || !Array.isArray(value.urls) || value.urls.length > STORE_BATCH_LIMIT) return null;
  const urls = value.urls.filter((url): url is string => typeof url === 'string');
  return urls.length === value.urls.length ? urls : null;
}

export interface PutMessage {
  url: string;
  body: ArrayBuffer;
  headers: [string, string][];
}

// The page hands over the bytes it read from its own HTTP cache.
export function parsePutMessage(value: unknown): PutMessage | null {
  if (typeof value !== 'object' || value === null || !('type' in value) || value.type !== PUT_MESSAGE) return null;
  if (!('url' in value) || typeof value.url !== 'string') return null;
  if (!('body' in value) || !(value.body instanceof ArrayBuffer)) return null;
  if (!('headers' in value) || !Array.isArray(value.headers)) return null;
  const headers = value.headers.filter((pair): pair is [string, string] => Array.isArray(pair) && pair.length === 2
    && typeof pair[0] === 'string' && typeof pair[1] === 'string');
  if (headers.length !== value.headers.length) return null;
  return { url: value.url, body: value.body, headers };
}

// Stored bodies are the decoded bytes the page read, so transport headers
// (content-encoding, content-length, transfer-encoding) would describe bytes
// that are not there. No engine tested refused such a copy, but only headers
// that describe the content itself are kept.
const STORED_HEADERS = new Set(['content-type', 'etag', 'last-modified', 'content-language']);

export function storedHeaders(headers: Iterable<[string, string]>): [string, string][] {
  return [...headers].filter(([name]) => STORED_HEADERS.has(name.toLowerCase()));
}

export function isStorableRoute(route: RequestRoute): boolean {
  return route.kind === 'immutable' || route.kind === 'network-first';
}

// Firefox sends every request of a controlled page to the worker, even one
// whose fetch handler does nothing; on a Moon load (about 600 requests) that
// delayed data-ready by 0.9 s in Firefox 155, while Chrome and Safari paid under
// 0.1 s. Firefox browser tabs therefore stay uncontrolled; an installed app
// still gets offline copies.
export function shouldRegisterServiceWorker(userAgent: string, standalone: boolean): boolean {
  return standalone || !/\bFirefox\//u.test(userAgent);
}

// How long a failed request keeps the worker serving stored files first. The
// window restarts on every failure and ends early on any success, so a visitor
// whose connection returns sees fresh files within this time without reloading.
export const NETWORK_DOWN_WINDOW_MS = 10_000;

export function networkDownUntil(now: number): number {
  return now + NETWORK_DOWN_WINDOW_MS;
}

export function isNetworkDown(downUntil: number, now: number): boolean {
  return now < downUntil;
}
