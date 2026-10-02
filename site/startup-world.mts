import { startupFetch } from './startup-requests.mts';
import { readWorldPlace } from './object-entries.mts';

/** The world summary's address: bundled by Vite for the browser, the checked-in file in Node (`world-context-plan.mts`). */
export const WORLD_SUMMARY_SOURCE = new URL('../src/objects/sun/prepared/world-context-summary.json', import.meta.url);

/** The holder of a page's own body, as the page names it (`ObjectLayout.astro`): `<meta name="cssearth-world-holder">`,
 * absent when the summary holds the body whole. `row` says the body is a star that is its own holder of one body: its row
 * is in its object entry, not a file. */
export function pageWorldPlace(document: Document | undefined): { readonly holder: string; readonly row: boolean } | null {
  const meta = document?.querySelector<HTMLMetaElement>('meta[name="cssearth-world-holder"]');
  return meta?.content ? { holder: meta.content, row: meta.dataset.row !== undefined } : null;
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
  // The summary and the page's own holder are asked for together: the page names its holder, so neither waits for the other.
  const place = pageWorldPlace(windowTarget.document);
  const [summary, value] = await Promise.all([read(WORLD_SUMMARY_SOURCE, 'Prepared world context'),
    !place ? null : place.row ? readWorldPlace(place.holder).then(own => {
      if (own?.row === undefined) throw new TypeError(`/objects/${place.holder}/entry.json carries no world row for a star that is its own holder.`);
      return own.row;
    }) : read(`/world/systems/${place.holder}.json`, 'Prepared world system')]);
  const world: StartupWorld = { summary, system: place ? { id: place.holder, value } : null };
  Reflect.set(windowTarget, KEY, world);
}
