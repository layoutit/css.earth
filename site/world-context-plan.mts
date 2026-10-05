import { parseCompleteWorldContext, parsePreparedWorldIndex, systemObjectId } from '@cssearth/objects';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldSystem } from '@cssearth/objects';
import { WORLD_ANYWHERE_SOURCE, WORLD_SUMMARY_SOURCE, anywhereFiles, pageWorldFiles, startupWorld } from './startup-world.mts';
import { readWorldPlace } from './directory/object-entries.mts';
import type { PreparedWorldContext, PreparedWorldIndex, PreparedWorldSystem } from '@cssearth/objects';
import { startupFetch } from './directory/startup-requests.mts';

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
// That module's import is JSON-attributed, so the Node read can only yield data.
// A host with no file system swaps that one module for its own reader
// (site/build/bundle-cloudflare-worker.mts).
// The main thread reads the summary and the files it needs: every body and camera fact, with each orbit reduced to its parent,
// bounds and size. Only the planner worker projects orbit paths; it reads each orbit centre's binary bank when a frame
// first needs it. The full JSON is build-time only.
//
// The summary holds the frame, camera and sky facts and the Sun. Every other body is in the file of the object it is inside
// (`pages/world/systems/[id].json.ts`, by the object tree). A page reads, at startup, its own object's file and the files of
// the objects it is inside, and every file whose bodies are drawn from anywhere (`pageWorldFiles`); navigation reads the files
// a body it flies to needs from that body's object entry (`loadWorldSystemOf`); the camera reads a system's file as it comes
// near (world-approach.mts). Node tools, tests and the build read the index and every file, so they see the whole world in
// its prepared order.
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
  const { readProjectJson } = await import('./prepared/prepared-world-context-node-source.mts');
  return readProjectJson(import.meta.url, path);
}
async function readPreparedWorldContext(): Promise<unknown> {
  // Node tools, tests and the prerender build read the checked-in file directly.
  if (node) return readNodeJson('src/objects/observable-universe/prepared/world.json');
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
/** The objects with a dot bank of the plain stars inside them (`pages/world/dots/[id].bin.ts`), as the bake names them in
 * the summary: other galaxies, each with its bank in its own package (`plainStarDotBank`). */
export const WORLD_DOT_BANKS: readonly string[] = summary.dotBanks ?? [];

const loaded = new Set<string>(), loading = new Map<string, Promise<unknown>>();
const listeners = new Set<(plan: PreparedWorldContext) => void>();
/** The files read that have places, the systems of their children read on approach (world-approach.mts). */
const placed = new Set<string>();
// The bodies the plan holds, by id, kept with it.
let held = new Map(summary.bodies.map(body => [body.id, body] as const));
/** Adds files to the plan, in the order given: root first, so each file's orbit parents are placed. */
const adopt = (files: readonly { readonly id: string; readonly value: unknown }[]) => {
  const fresh = files.filter(file => !loaded.has(file.id));
  if (!fresh.length) return;
  for (const file of fresh) {
    const system = parsePreparedWorldSystem(file.value, APPLICATION_WORLD_CONTEXT, file.id);
    APPLICATION_WORLD_CONTEXT = extendWorldContext(APPLICATION_WORLD_CONTEXT, [system]);
    loaded.add(file.id);
    if (system.places) placed.add(file.id);
  }
  held = new Map(APPLICATION_WORLD_CONTEXT.bodies.map(body => [body.id, body] as const));
  for (const listener of listeners) listener(APPLICATION_WORLD_CONTEXT);
};
/** Reads files once each, together, and adds them root first. A star's own row (`row`) is a file of one body. */
function loadFiles(ids: readonly string[], row?: { readonly id: string; readonly value: unknown }): Promise<void> {
  const reads = ids.map(id => {
    if (loaded.has(id)) return Promise.resolve({ id, value: null });
    let pending = loading.get(id);
    if (!pending) {
      pending = fetchJson(`/world/systems/${id}.json`).finally(() => loading.delete(id));
      loading.set(id, pending);
    }
    return pending.then(value => ({ id, value }));
  });
  return Promise.all(reads).then(files => adopt([...files.filter(file => !loaded.has(file.id)), ...(row ? [row] : [])]));
}

/** The application's world: the summary, with every file Node reads, or a page's own in the browser. */
export let APPLICATION_WORLD_CONTEXT: PreparedWorldContext = summary;
/** The bake's index of the world, in Node only: the build's endpoints and tools read the world's files from it. */
export let APPLICATION_WORLD_INDEX: PreparedWorldIndex | null = null;
/** The file each body's row is in, in Node only, as the files read say (a plain-dot star with nothing round it is its own). */
export const APPLICATION_WORLD_FILE_OF = new Map<string, string>();
if (node) {
  const index = await readNodeJson('src/objects/observable-universe/prepared/world-index.json');
  APPLICATION_WORLD_INDEX = parsePreparedWorldIndex(index);
  const files = new Map(await Promise.all(APPLICATION_WORLD_INDEX.files.map(async id => [id, await readNodeJson(`src/objects/${id}/prepared/members.json`)] as const)));
  for (const [id, file] of files) for (const body of rowIds(file)) APPLICATION_WORLD_FILE_OF.set(body, id);
  for (const id of Object.keys(APPLICATION_WORLD_INDEX.rows)) APPLICATION_WORLD_FILE_OF.set(id, id);
  APPLICATION_WORLD_CONTEXT = await parseCompleteWorldContext(summary, async id => files.get(id), index);
  held = new Map(APPLICATION_WORLD_CONTEXT.bodies.map(body => [body.id, body] as const));
} else if (startup) {
  adopt(startup.files);
} else {
  // A page that did not read its world before its application reads the files every page reads and those it names here.
  adopt(anywhereFiles(await fetchJson(WORLD_ANYWHERE_SOURCE)));
  const own = pageWorldFiles(globalThis.document);
  await loadFiles(own.files, own.row ? { id: own.row, value: (await readWorldPlace(own.row))?.row } : undefined);
}
/** The body ids of a file as written (`bodies.id`, one column). */
function rowIds(file: unknown): readonly string[] {
  const ids = file && typeof file === 'object' && 'bodies' in file && file.bodies && typeof file.bodies === 'object' && 'id' in file.bodies ? file.bodies.id : undefined;
  return Array.isArray(ids) ? ids.map(String) : [];
}

/** Calls `listener` with the extended plan each time another holder's bodies are added; returns the unsubscribe. */
export function onWorldSystems(listener: (plan: PreparedWorldContext) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
// Bodies asked for whose entries name no file to read: nothing more of the world belongs to them.
const settled = new Set<string>();
/** Whether the plan holds `id` with everything that orbits it: a body's row names its system's members, and one of them
 * missing means its system's file is not read. */
export function worldSystemHeld(id: string): boolean {
  if (node || id === summary.focus.id || loaded.has(systemObjectId(id)) || settled.has(id)) return true;
  const body = held.get(id);
  return body !== undefined && (body.systemView?.memberIds ?? []).every(member => held.has(member));
}
/** Reads the files body `id` needs before navigation flies to it, as its own object entry names them; null when the plan
 * already holds that body and its system, so the caller goes on at once. */
export function loadWorldSystemOf(id: string): Promise<void> | null {
  if (worldSystemHeld(id)) return null;
  return readWorldPlace(id).then(place => {
    if (!place) { settled.add(id); return; }
    return loadFiles(place.files, place.row === undefined ? undefined : { id, value: place.row });
  });
}
/** Whether the file of object `id` is read. */
export const worldHolderRead = (id: string): boolean => node || loaded.has(id);
/** Reads one object's file by its id: a system the camera has come near (world-approach.mts), or a category's. */
export function loadWorldHolder(id: string): Promise<void> {
  return loadFiles([id]);
}
/** The files read that have places, now and as more are read: what the approach reads (world-approach.mts). */
export const worldPlacedFiles = (): readonly string[] => [...placed];
