import { extendWorldContext, parseCompleteWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldSystem } from '@cssearth/renderer';
import type { PreparedWorldContext, PreparedWorldSystem } from '@cssearth/renderer';

// The application's prepared world context, validated once. Startup, framing and
// every detail mount share this immutable plan. The browser fetches the prepared
// file instead of bundling it as a module, so only the validated plan stays
// resident: a retained JSON module kept a second full copy alive on the heap.
// `source` stays import.meta.url-relative so Vite's static asset analysis bundles
// it for the browser; Node's own read below resolves against the discovered
// project root instead, since neither `process.cwd()` (a workspace-filtered
// script runs elsewhere) nor this module's own bundled URL (Astro's prerender
// moves it into `dist/.prerender/chunks`) reliably sit beside the project root.
// This module is itself part of the browser bundle (reached from every mounted
// object through `application-world-context.mts`), so the Node-only path lookup
// lives in its own module and is reached only through a dynamic import, inside
// the `file:`-only branch: a real browser never takes that branch, but Vite
// still externalizes a *static* `node:` import for the client build and throws
// on first property access, even when the call site itself is unreachable at
// runtime. The dynamic import keeps that module's `node:` imports out of the
// client's static graph; Vite still emits it as a small chunk nothing loads.
// The JSON-attributed import stays here, so the Node read can only yield data.
// The main thread reads the summary: every body and camera fact, with each orbit
// reduced to its parent, bounds and size. Only the planner worker projects orbit
// paths; it reads each orbit centre's binary bank when a frame first needs it. The full JSON is build-time only.
//
// The summary holds the Sun's own system and one point per other system (packages/bake/src/world-context/summary.ts).
// Each other system's bodies are their own file (`pages/world/systems/[id].json.ts`): a page whose body belongs to one reads
// it before startup ends; navigation reads the one it flies to (`loadWorldSystemOf`), and the rest arrive in a few batches
// once the first view is interactive (`streamWorldSystems`). Node tools, tests and the build read every file, so they see
// the whole world in its prepared order.
const source = new URL('../src/objects/sun/prepared/world-context-summary.json', import.meta.url);
/** Orbit banks the planner worker reads on demand, served per centre by the build
 * (`pages/world/orbits/[id].bin.ts`). The main thread sends its validated summary to the worker. */
export const APPLICATION_WORLD_PLANNER_SOURCE = Object.freeze({ orbitBanksUrl: '/world/orbits/' });
/** How many requests the systems a page does not show arrive in, after its first view. */
const SYSTEM_BATCHES = 4;
const node = source.protocol === 'file:';

async function readNodeJson(path: string): Promise<unknown> {
  const { nodeProjectFileUrl } = await import('./prepared/prepared-world-context-node-source.mts');
  return (await import(/* @vite-ignore */ nodeProjectFileUrl(import.meta.url, path), { with: { type: 'json' } })).default;
}
async function readPreparedWorldContext(): Promise<unknown> {
  // Node tools, tests and the prerender build read the checked-in file directly.
  if (node) return readNodeJson('src/objects/sun/prepared/world-context-summary.json');
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Prepared world context request failed: ${response.status}.`);
  return response.json();
}
async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Prepared world system request ${url} failed: ${response.status}.`);
  return response.json();
}

const summary = parsePreparedWorldContextSummary(await readPreparedWorldContext());
/** Each deferred body's star, and every star whose system is its own file, in id order. */
const hostOf = new Map((summary.deferred ?? []).map(body => [body.id, body.host]));
export const WORLD_SYSTEM_HOSTS: readonly string[] = Object.freeze([...new Set(hostOf.values())].sort());
/** The systems batch `index` holds (`pages/world/systems/batch-[index].json.ts`), in id order. */
export function worldSystemBatch(index: number): readonly string[] {
  const size = Math.ceil(WORLD_SYSTEM_HOSTS.length / SYSTEM_BATCHES);
  return WORLD_SYSTEM_HOSTS.slice(index * size, (index + 1) * size);
}
export const WORLD_SYSTEM_BATCH_COUNT = SYSTEM_BATCHES;
/** The star whose system file holds `id`, or null when the summary holds it (the Sun's system, or a star itself). */
export const worldSystemOf = (id: string): string | null => hostOf.get(id) ?? (WORLD_SYSTEM_HOSTS.includes(id) ? id : null);

const loaded = new Set<string>(), loading = new Map<string, Promise<void>>();
const listeners = new Set<(plan: PreparedWorldContext) => void>();
const adopt = (systems: readonly PreparedWorldSystem[], ordered = false) => {
  const fresh = systems.filter(system => !loaded.has(system.id));
  if (!fresh.length) return;
  APPLICATION_WORLD_CONTEXT = extendWorldContext(APPLICATION_WORLD_CONTEXT, fresh, ordered);
  for (const system of fresh) loaded.add(system.id);
  for (const listener of listeners) listener(APPLICATION_WORLD_CONTEXT);
};
const parseSystem = (value: unknown, id: string) => parsePreparedWorldSystem(value, APPLICATION_WORLD_CONTEXT, id);

/** The application's world: the summary, with every system file Node reads, or a page's own system in the browser. */
export let APPLICATION_WORLD_CONTEXT: PreparedWorldContext = summary;
if (node) {
  APPLICATION_WORLD_CONTEXT = await parseCompleteWorldContext(summary, id => readNodeJson(`src/objects/sun/prepared/world-systems/${id}.json`));
  for (const id of WORLD_SYSTEM_HOSTS) loaded.add(id);
} else {
  // A page's own body: the first path segment of its address (`/<id>/`).
  const own = worldSystemOf(globalThis.location?.pathname.split('/')[1] ?? '');
  if (own) adopt([parseSystem(await fetchJson(`/world/systems/${own}.json`), own)], true);
}

/** Calls `listener` with the extended plan each time other systems' bodies are added; returns the unsubscribe. */
export function onWorldSystems(listener: (plan: PreparedWorldContext) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
/** Reads the system that holds `id` before navigation flies to it; null when the plan already holds that body, so the
 * caller goes on at once. */
export function loadWorldSystemOf(id: string): Promise<void> | null {
  const host = worldSystemOf(id);
  if (!host || loaded.has(host)) return null;
  let pending = loading.get(host);
  if (!pending) {
    pending = fetchJson(`/world/systems/${host}.json`).then(value => adopt([parseSystem(value, host)]))
      .finally(() => loading.delete(host));
    loading.set(host, pending);
  }
  return pending;
}
let streaming: Promise<void> | null = null;
/** Reads every system not yet read, in `SYSTEM_BATCHES` requests, each added as it arrives. A failed batch is logged and
 * left: navigation still reads any of its systems on its own. */
export function streamWorldSystems(): Promise<void> {
  streaming ??= Promise.all(Array.from({ length: SYSTEM_BATCHES }, async (_, index) => {
    if (worldSystemBatch(index).every(id => loaded.has(id))) return;
    try {
      const batch = await fetchJson(`/world/systems/batch-${index}.json`);
      if (!Array.isArray(batch)) throw new TypeError(`World system batch ${index} is not a list of systems.`);
      adopt(batch.map((value, at) => parseSystem(value, worldSystemBatch(index)[at] ?? '')));
    } catch (error) { console.error(`World system batch ${index} could not be read; its systems load when navigation reaches them.`, error); }
  })).then(() => undefined);
  return streaming;
}
