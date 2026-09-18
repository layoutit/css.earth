// Offline policy for the installed app. The worker keeps what the visitor has
// already loaded, never downloads ahead of them, and forgets the least recently
// used responses once the byte budget is spent.

export const RUNTIME_CACHE = 'cssearth-runtime-v1';
export const INDEX_CACHE = 'cssearth-runtime-index-v1';
export const INDEX_URL = '/__cssearth-runtime-index__';
export const RUNTIME_BUDGET_BYTES = 512 * 1024 * 1024;
// Leave room for other origins' storage on devices with small quotas.
export const QUOTA_SHARE = 0.5;

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
  if (SEARCH_PARAMETERS.some(name => target.searchParams.has(name))) return { kind: 'network-only' };
  if (isImmutablePath(path) && !target.search) return { kind: 'immutable' };
  return { kind: 'network-first' };
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
    && Number.isFinite(entry.used));
}
