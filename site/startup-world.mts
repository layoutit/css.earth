import { startupFetch } from './startup-requests.mts';

/** The world summary's address: bundled by Vite for the browser, the checked-in file in Node (`world-context-plan.mts`). */
export const WORLD_SUMMARY_SOURCE = new URL('../src/objects/sun/prepared/world-context-summary.json', import.meta.url);

/** The star whose system file holds `id` or its planets (a star's own id), or null when the summary holds them all: the
 * Sun's system, or a star without planets. Read from the summary's list of the bodies it leaves to system files. */
export function worldSystemHost(deferred: readonly { readonly id: string; readonly host: string }[] | undefined, id: string): string | null {
  return deferred?.find(body => body.id === id)?.host ?? (deferred?.some(body => body.host === id) ? id : null);
}

/** What a page read before its application loaded: the world summary, and the page's own system when another file holds it. */
export interface StartupWorld { readonly summary: unknown; readonly system: { readonly id: string; readonly value: unknown } | null }
const KEY = '__cssEarthWorld';
/** The world this page read before its application, or undefined in Node and on a page that did not read one. */
export function startupWorld(): StartupWorld | undefined {
  const value: unknown = typeof window === 'undefined' ? undefined : Reflect.get(window, KEY);
  if (!value || typeof value !== 'object' || !('summary' in value) || !('system' in value)) return undefined;
  const system: unknown = value.system;
  if (system !== null && !(typeof system === 'object' && 'id' in system && typeof system.id === 'string' && 'value' in system)) return undefined;
  return { summary: value.summary, system: system === null ? null : { id: String(system.id), value: system.value } };
}

/** The world a page reads before it imports its application (`ObjectLayout.astro`), so no module waits for it.
 *
 * `world-context-plan.mts` used to wait for the summary with a top-level await, and the router, the registry and the world's
 * code all import it. With the summary slower than those modules, Safari on the iPad ran them before it had finished:
 * constants declared after the wait (`WORLD_OBJECTS`, the navigation map) were undefined and the page failed. With the
 * summary held back 1.2 s that was 8 of 8 cold loads, and one in seven on the live site (2026-10-01). Importing the
 * modules in a different order or through one shared promise changed the odds, never the cause. */
export async function loadStartupWorld(windowTarget: Window): Promise<void> {
  const read = async (url: string | URL, name: string) => {
    const response = await startupFetch(url);
    if (!response.ok) throw new Error(`${name} request ${String(url)} failed: ${response.status}.`);
    return response.json() as Promise<unknown>;
  };
  const summary = await read(WORLD_SUMMARY_SOURCE, 'Prepared world context');
  // A page's own body: the first path segment of its address (`/<id>/`).
  const deferred = (summary as { deferred?: readonly { id: string; host: string }[] } | null)?.deferred;
  const own = worldSystemHost(Array.isArray(deferred) ? deferred : undefined, windowTarget.location.pathname.split('/')[1] ?? '');
  const world: StartupWorld = { summary, system: own ? { id: own, value: await read(`/world/systems/${own}.json`, 'Prepared world system') } : null };
  Reflect.set(windowTarget, KEY, world);
}
