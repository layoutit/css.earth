import { startupFetch } from './startup-requests.mts';
import { readWorldPlace } from './object-entries.mts';

/** The world summary's address: bundled by Vite for the browser, the checked-in file in Node (`world-context-plan.mts`). */
export const WORLD_SUMMARY_SOURCE = new URL('../src/objects/sun/prepared/world-context-summary.json', import.meta.url);

/** The world files a page reads at startup, root first, as the page names them (`ObjectLayout.astro`):
 * `<meta name="cssearth-world-files">`, with `data-row` naming the page's body when it is a plain-dot star whose row its
 * object entry carries. */
export function pageWorldFiles(document: Document | undefined): { readonly files: readonly string[]; readonly row?: string } {
  const meta = document?.querySelector<HTMLMetaElement>('meta[name="cssearth-world-files"]');
  const files = meta?.content.split(' ').filter(Boolean) ?? [];
  return { files, ...(meta?.dataset.row ? { row: meta.dataset.row } : {}) };
}

/** What a page read before its application loaded: the world summary and its startup files, root first. */
export interface StartupWorld { readonly summary: unknown; readonly files: readonly { readonly id: string; readonly value: unknown }[] }
const KEY = '__cssEarthWorld';
/** The world this page read before its application, or undefined in Node and on a page that did not read one. */
export function startupWorld(): StartupWorld | undefined {
  const value: unknown = typeof window === 'undefined' ? undefined : Reflect.get(window, KEY);
  if (!value || typeof value !== 'object' || !('summary' in value) || !('files' in value) || !Array.isArray(value.files)) return undefined;
  const files: unknown[] = value.files;
  if (!files.every(file => typeof file === 'object' && file !== null && 'id' in file && typeof file.id === 'string' && 'value' in file)) return undefined;
  return { summary: value.summary, files: files as StartupWorld['files'] };
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
  // The summary and every file the page names are asked for together: none waits for another.
  const own = pageWorldFiles(windowTarget.document);
  const [summary, row, ...values] = await Promise.all([read(WORLD_SUMMARY_SOURCE, 'Prepared world context'),
    own.row === undefined ? null : readWorldPlace(own.row).then(place => {
      if (place?.row === undefined) throw new TypeError(`/objects/${own.row}/entry.json carries no world row for a plain-dot star.`);
      return place.row;
    }),
    ...own.files.map(id => read(`/world/systems/${id}.json`, 'Prepared world file'))]);
  const world: StartupWorld = { summary, files: [...own.files.map((id, at) => ({ id, value: values[at] })), ...(own.row === undefined ? [] : [{ id: own.row, value: row }])] };
  Reflect.set(windowTarget, KEY, world);
}
