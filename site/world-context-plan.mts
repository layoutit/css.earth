import { parseCompleteWorldContext, parsePreparedWorldIndex, systemObjectId } from '@cssearth/objects';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldSystem } from '@cssearth/objects';
import { WORLD_SUMMARY_SOURCE, pageWorldPlace, startupWorld } from './startup-world.mts';
import { readWorldPlace, type WorldPlace } from './object-entries.mts';
import type { PreparedWorldContext, PreparedWorldIndex, PreparedWorldSystem } from '@cssearth/objects';
import { startupFetch } from './startup-requests.mts';

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
// The summary holds the Sun's own system and every body that orbits nothing and the map opens by click. It lists no other
// body. Each other star is a holder: its own file (`pages/world/systems/[id].json.ts`) with the bodies that orbit it. A body
// is found through its holder: the page names its own body's (`pageWorldPlace`), navigation reads the holder of the body it
// flies to from that body's object entry (`loadWorldSystemOf`), and the camera reads the holder of a star it comes near
// (world-approach.mts). Node tools, tests and the build read the bake's index and every holder, so they see the whole
// world in its prepared order.
const source = WORLD_SUMMARY_SOURCE;
/** Orbit banks the planner worker reads on demand, served per centre by the build
 * (`pages/world/orbits/[id].bin.ts`). The main thread sends its validated summary to the worker. */
export const APPLICATION_WORLD_PLANNER_SOURCE = Object.freeze({ orbitBanksUrl: '/world/orbits/' });
const node = source.protocol === 'file:';
// What the page read before it imported this module (`startup-world.mts`). With it the browser reads its world without
// waiting, so nothing that imports this module can run before it has finished. Node, and a page that did not read it,
// wait for the same files here.
const startup = node ? undefined : startupWorld();

async function readNodeJson(path: string): Promise<unknown> {
  const { nodeProjectFileUrl } = await import('./prepared/prepared-world-context-node-source.mts');
  return (await import(/* @vite-ignore */ nodeProjectFileUrl(import.meta.url, path), { with: { type: 'json' } })).default;
}
async function readPreparedWorldContext(): Promise<unknown> {
  // Node tools, tests and the prerender build read the checked-in file directly.
  if (node) return readNodeJson('src/objects/sun/prepared/world-context-summary.json');
  const response = await startupFetch(source);
  if (!response.ok) throw new Error(`Prepared world context request failed: ${response.status}.`);
  return response.json();
}
async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Prepared world system request ${url} failed: ${response.status}.`);
  return response.json();
}

const summary = parsePreparedWorldContextSummary(startup ? startup.summary : await readPreparedWorldContext());
/** The world's own dot banks (`pages/world/dots/[id].bin.ts`), as the bake names them in the summary: the stars drawn as
 * plain dots, near the Sun and in other galaxies, written by the bake as `plainStarDotBanks`. */
export const WORLD_DOT_BANKS: readonly string[] = summary.dotBanks ?? [];

const loaded = new Set<string>(), loading = new Map<string, Promise<void>>();
const listeners = new Set<(plan: PreparedWorldContext) => void>();
// The bodies the plan holds, by id, kept with it.
let held = new Map(summary.bodies.map(body => [body.id, body] as const));
const adopt = (systems: readonly PreparedWorldSystem[]) => {
  const fresh = systems.filter(system => !loaded.has(system.id));
  if (!fresh.length) return;
  APPLICATION_WORLD_CONTEXT = extendWorldContext(APPLICATION_WORLD_CONTEXT, fresh);
  held = new Map(APPLICATION_WORLD_CONTEXT.bodies.map(body => [body.id, body] as const));
  for (const system of fresh) loaded.add(system.id);
  for (const listener of listeners) listener(APPLICATION_WORLD_CONTEXT);
};
const parseSystem = (value: unknown, id: string) => parsePreparedWorldSystem(value, APPLICATION_WORLD_CONTEXT, id);
/** Reads one holder once: its file, or the row a star that is its own holder of one body carries in its object entry. */
function loadHolder({ holder, row }: WorldPlace): Promise<void> {
  if (loaded.has(holder)) return Promise.resolve();
  let pending = loading.get(holder);
  if (!pending) {
    pending = (row === undefined ? fetchJson(`/world/systems/${holder}.json`) : Promise.resolve(row)).then(value => adopt([parseSystem(value, holder)]))
      .finally(() => loading.delete(holder));
    loading.set(holder, pending);
  }
  return pending;
}

/** The application's world: the summary, with every holder Node reads, or a page's own in the browser. */
export let APPLICATION_WORLD_CONTEXT: PreparedWorldContext = summary;
/** The bake's index of the world's bodies, in Node only: the build's endpoints and tools read each body's holder from it. */
export let APPLICATION_WORLD_INDEX: PreparedWorldIndex | null = null;
if (node) {
  const index = await readNodeJson('src/objects/sun/prepared/world-index.json');
  APPLICATION_WORLD_INDEX = parsePreparedWorldIndex(index);
  APPLICATION_WORLD_CONTEXT = await parseCompleteWorldContext(summary, id => readNodeJson(`src/objects/${id}/prepared/members.json`), index);
  held = new Map(APPLICATION_WORLD_CONTEXT.bodies.map(body => [body.id, body] as const));
} else if (startup?.system) {
  adopt([parseSystem(startup.system.value, startup.system.id)]);
} else {
  // A page that did not read its world before its application reads its own body's holder here.
  const place = pageWorldPlace(globalThis.document);
  if (place) await loadHolder(place.row ? { holder: place.holder, row: (await readWorldPlace(place.holder))?.row } : { holder: place.holder });
}

/** Calls `listener` with the extended plan each time another holder's bodies are added; returns the unsubscribe. */
export function onWorldSystems(listener: (plan: PreparedWorldContext) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
// Bodies asked for whose entries name no holder to read: nothing more of the world belongs to them.
const settled = new Set<string>();
/** Whether the plan holds `id` with everything that orbits it: a star's row names its system's members, and one of them
 * missing means its holder's file is not read. */
export function worldSystemHeld(id: string): boolean {
  if (node || id === summary.focus.id || loaded.has(id) || loaded.has(systemObjectId(id)) || settled.has(id)) return true;
  const body = held.get(id);
  return body !== undefined && (body.systemView?.memberIds ?? []).every(member => held.has(member));
}
/** Reads the holder of `id` before navigation flies to it; null when the plan already holds that body and its system, so
 * the caller goes on at once. A body the plan does not hold names its holder in its own object entry. */
export function loadWorldSystemOf(id: string): Promise<void> | null {
  if (worldSystemHeld(id)) return null;
  // A star the plan holds without its planets: its system is their holder (an object of its own, system-address.ts).
  if (held.has(id)) return loadHolder({ holder: systemObjectId(id) });
  return readWorldPlace(id).then(place => {
    if (!place) { settled.add(id); return; }
    return loadHolder(place);
  });
}
/** Whether the holder `id` is read. */
export const worldHolderRead = (id: string): boolean => node || loaded.has(id);
/** Reads a holder by its id (world-approach.mts): the file of a star the camera has come near. */
export function loadWorldHolder(id: string): Promise<void> {
  return loadHolder({ holder: id });
}
