import { sectionElements } from '@cssearth/renderer';
import { parseHTML } from 'linkedom';
import { requiredElement, requiredSection } from '../browser/browser-types.mts';
import { SEARCH_QUERY_LIMIT } from '../search/object-search.mts';
import { findObjects, findResults } from './find.mts';
import type { SearchData } from './search-data.mts';
import { renderCatalogueRows } from '../search/catalogue-window.mts';
import { renderDatasetResponse, UnreadableSavedView } from '../dataset-response.mts';
import { createSelectionPresentation } from '../selection-presentation.mts';
import { selectionTargetFromUrl } from '../scene/scene-selection.mts';
import { WORLD_OBJECTS } from '../world-objects.mts';
import { presentFeatureResults, createSearchPresentation } from '../search/search-results-presentation.mts';
import { objectIdAtPath } from '../root-object.mts';
import { overviewScopeFromUrl, withOverviewScope } from '../navigation/navigation-scope.mts';

/** Modify only the shared shell. Everything outside these boundaries, including
 * the authenticated scene, head, styles and application scripts, passes through byte for byte. */
export async function renderSearchResponse(html: string, url: URL, data: SearchData): Promise<string> {
  const startMarker = '<!--search-shell:start-->', endMarker = '<!--search-shell:end-->';
  const start = html.indexOf(startMarker) + startMarker.length, end = html.indexOf(endMarker);
  if (start < startMarker.length || end < start) throw new Error('Prepared search shell is missing.');
  const { document } = parseHTML(`<html><body>${html.slice(start, end)}</body></html>`);
  const form = requiredElement<HTMLFormElement>(document, '.object-sidebar-search-card');
  const objectId = form.dataset.searchObject;
  if (!objectId || !/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new Error('Prepared search object is invalid.');
  const search = requiredElement<HTMLInputElement>(form, '.object-sidebar-search');
  const value = (url.searchParams.get('browse') ?? url.searchParams.get('q') ?? '').slice(0, SEARCH_QUERY_LIMIT).trim();
  const searching = url.searchParams.has('q');
  search.setAttribute('value', value);
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-search-context], input[data-view-context]')) {
    const value = url.searchParams.get(input.name);
    input.toggleAttribute('disabled', !value);
    input.setAttribute('value', value?.slice(0, 2048) ?? '');
  }
  // Native searches and dataset submits carry the same declared object settings.
  if (url.searchParams.get('settings') === '1') {
    const names = ['settings', ...[...document.querySelectorAll<HTMLInputElement>('.object-settings input[form][name]')].map(input => input.name)];
    for (const form of document.querySelectorAll<HTMLFormElement>('[data-dataset-form], .object-sidebar-search-card')) {
      for (const name of new Set(names)) {
        const value = url.searchParams.get(name);
        if (value === null) continue;
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = name; input.value = value;
        input.dataset.currentSetting = '';
        form.append(input);
      }
    }
  }
  const clear = new URL(`/${objectId}/`, url.origin);
  for (const name of ['v', 'overview', 'dataset', 'feature', 'settings', ...[...document.querySelectorAll<HTMLInputElement>('.object-settings input[form][name]')].map(input => input.name)]) {
    const value = url.searchParams.get(name);
    if (value) clear.searchParams.set(name, value.slice(0, 2048));
  }
  // Clearing the search keeps the view context, normalized the way the router resolves it.
  withOverviewScope(clear, overviewScopeFromUrl(url) !== null);
  document.querySelector('.object-sidebar-search-clear')?.setAttribute('href', clear.pathname + clear.search);
  const browser = requiredSection(document, '.object-browser');
  const presentation = createSearchPresentation(document);
  presentation.present(searching, searching);
  if (searching) requiredElement(document, '.object-sheet-handle').setAttribute('checked', '');
  form.toggleAttribute('data-search-submitted', searching);
  if (searching) {
    // The same matcher and order as the find function; with no JavaScript the page lists every match at once.
    const found = findObjects(await data.catalogue(), value || 'all objects', { pageRows: Infinity });
    renderCatalogueRows(document, requiredElement<HTMLUListElement>(browser, '[data-catalogue-list]'), found.objects.rows);
    presentation.markCategory(found.classification);
    const featureRoot = browser.querySelector<HTMLElement>('.object-feature-results');
    let detailCount = 0;
    if (found.detailQuery && featureRoot && data.pin) {
      try {
        detailCount = presentFeatureResults(featureRoot, await findResults(data.pin, found.detailQuery, objectId, data.read));
      } catch {
        presentFeatureResults(featureRoot, [], 'Feature names could not load. Submit your search to retry.');
        detailCount = 1;
      }
    }
    presentation.setEmptyHidden(found.objects.total + detailCount > 0);
  }
  createSelectionPresentation(document, { card: true }).present(selectionTargetFromUrl(url, objectId, WORLD_OBJECTS));
  return html.slice(0, start) + document.body.innerHTML + html.slice(end);
}

/** Netlify's query rewrite and local middleware call this same request handler. */
export async function handleSearchRequest(request: Request, data: SearchData, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const objectId = url.pathname === '/.netlify/functions/search' ? url.searchParams.get('object')
    : objectIdAtPath(url.pathname);
  if (!objectId || !/^[a-z0-9][a-z0-9_.+-]*$/u.test(objectId)) return new Response('Object not found', { status: 404 });
  // No query on this fetch: it retrieves the static page without recursing into search.
  const response = await fetcher(new URL(`/${objectId}/`, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const page = await response.text();
  // The page's own address: a level's page is named by its path, which the rewrite to the function drops.
  const address = new URL(url);
  if (address.pathname === '/.netlify/functions/search') { address.pathname = `/${objectId}/`; address.searchParams.delete('object'); }
  const render = async (target: URL) => renderSearchResponse(await renderDatasetResponse(page, target, objectId, fetcher), target, data);
  let html: string;
  try {
    try { html = await render(address); }
    catch (error) {
      if (!(error instanceof UnreadableSavedView)) throw error;
      // An unreadable shared view (an older format, a damaged copy) renders the page as if it were absent; the browser
      // reports and ignores the same value, and its next camera change rewrites it. Not a redirect: Netlify appends
      // the original query to a function redirect whose target has none, which looped on the root page.
      const withoutView = new URL(address);
      withoutView.searchParams.delete('v');
      html = await render(withoutView);
    }
  } catch (error) {
    if (error instanceof RangeError) return new Response(error.message, { status: 400 });
    throw error;
  }
  const headers = new Headers(response.headers);
  for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified', 'expires']) headers.delete(name);
  headers.set('cache-control', 'private, no-store');
  headers.set('netlify-cdn-cache-control', 'no-store');
  headers.set('cdn-cache-control', 'no-store');
  headers.set('x-robots-tag', 'noindex, follow');
  return new Response(request.method === 'HEAD' ? null : html, { headers });
}
