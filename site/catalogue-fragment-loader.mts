import type { BrowserWindow } from './browser-types.mts';
import { parseCatalogueIndex, type CatalogueIndex } from './catalogue-index.mts';

/**
 * Object pages ship the full catalogue rows empty. The browser loads the compact
 * JSON index; the server/no-JS search (`search-response.mts`) loads the rendered
 * rows. Both are shared files named by path on `#object-category-results`.
 */
export const CATALOGUE_FRAGMENT_URL = '/catalogue-fragment/';
export const CATALOGUE_INDEX_URL = '/catalogue/index.json';

interface DatasetHost { dataset: { catalogueSrc?: string; catalogueIndexSrc?: string }; }

/** Where a page that ships its rows empty fetches them; null for a page or fixture that inlines them. */
export function readCatalogueFragmentUrl(panel: DatasetHost | null | undefined): string | null {
  return panel?.dataset.catalogueSrc || null;
}

export function readCatalogueIndexUrl(panel: DatasetHost | null | undefined): string | null {
  return panel?.dataset.catalogueIndexSrc || null;
}

type FetchPage = (url: string) => Promise<Response>;

/** Fetches the shared catalogue rows and returns the parsed `<ul class="object-list">`,
 * which the caller inserts in place of the empty placeholder list. */
export async function loadCatalogueFragment(url: string, { windowTarget, fetchPage = url => windowTarget.fetch(url) }: {
  windowTarget: BrowserWindow; fetchPage?: FetchPage;
}): Promise<HTMLUListElement> {
  const response = await fetchPage(url);
  if (!response.ok) throw new Error(`Object catalogue request ${url} failed: ${response.status}.`);
  const source = new windowTarget.DOMParser().parseFromString(await response.text(), 'text/html');
  const rows = source.querySelector('ul.object-list');
  if (!(rows instanceof windowTarget.HTMLUListElement)) throw new Error(`Object catalogue content ${url} is missing its list.`);
  return rows;
}

/** Fetch compact catalogue data without parsing or retaining an HTML document. */
export async function loadCatalogueIndex(url: string, { windowTarget, fetchPage = url => windowTarget.fetch(url) }: {
  windowTarget: BrowserWindow; fetchPage?: FetchPage;
}): Promise<CatalogueIndex> {
  const response = await fetchPage(url);
  if (!response.ok) throw new Error(`Object catalogue index request ${url} failed: ${response.status}.`);
  return parseCatalogueIndex(await response.json() as unknown);
}

/** Runs `task` once the browser is idle, or soon after if it never reports one. */
export function scheduleWhenIdle(windowTarget: BrowserWindow, task: () => void): void {
  if (typeof windowTarget.requestIdleCallback === 'function') windowTarget.requestIdleCallback(() => task(), { timeout: 4000 });
  else windowTarget.setTimeout(task, 1500);
}
