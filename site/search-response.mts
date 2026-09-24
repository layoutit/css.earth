import { parseHTML } from 'linkedom';
import { requiredElement } from './browser-types.mts';
import { isRecord } from '@cssearth/core';
import { matchesObjectCategory } from './object-categories.mts';
import { objectSearchLabels, searchObjects, SEARCH_QUERY_LIMIT } from './object-search.mts';
import { parseFeaturePin } from './feature-search.mts';
import { findResults } from './find.mts';
import { renderDatasetResponse, UnreadableSavedView } from './dataset-response.mts';
import { createSelectionPresentation } from './selection-presentation.mts';
import { selectionTargetFromUrl } from './scene/scene-selection.mts';
import { SCENE_OBJECTS } from './objects.mts';
import { presentFeatureResults, presentOverviewResults, createSearchPresentation, createCatalogueRows } from './search-results-presentation.mts';
import { readCatalogueFragmentUrl } from './catalogue-fragment-loader.mts';
import { objectIdAtPath } from './root-object.mts';
import { overviewScopeFromUrl, withOverviewScope } from './navigation/navigation-scope.mts';

export interface SearchPin { url: string; count: number; }
export function parseSearchPin(value: unknown): SearchPin {
  if (!isRecord(value) || typeof value.url !== 'string' || !/^\/(?:features|scenes)\/[a-zA-Z0-9/_-]+\.json$/u.test(value.url)
    || typeof value.count !== 'number' || !Number.isSafeInteger(value.count) || value.count < 0) throw new TypeError('Invalid prepared search index pin.');
  return { url: value.url, count: value.count };
}

/** A no-JS search reads the object rows straight from this document, but a page
 * ships them empty and names the shared catalogue fragment instead
 * (`catalogue-fragment-loader.mts`). Fetch and splice it in before matching,
 * the one no-JS reader of that markup. Returns false, instead of throwing, when
 * the fragment could not be loaded: the page still renders, with an empty object
 * list and a clear message, the way a failed feature index degrades below. */
async function ensureCatalogueRows(document: Document, browser: HTMLElement, origin: string, fetcher: typeof fetch): Promise<boolean> {
  const resultsPanel = requiredElement<HTMLElement>(browser, '#object-category-results');
  if (resultsPanel.querySelector('.object-item')) return true;
  const url = readCatalogueFragmentUrl(resultsPanel);
  if (!url) return true;
  try {
    const response = await fetcher(new URL(url, origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Object catalogue fragment ${url} failed: ${response.status}.`);
    const fragment = parseHTML(await response.text()).document;
    const rows = fragment.querySelector('ul.object-list');
    if (!rows) throw new Error('Object catalogue fragment content is missing its list.');
    requiredElement(resultsPanel, '[data-catalogue-list]').replaceWith(document.importNode(rows, true));
    const loading = resultsPanel.querySelector<HTMLElement>('[data-catalogue-loading]');
    if (loading) loading.hidden = true;
    return true;
  } catch {
    const loading = resultsPanel.querySelector<HTMLElement>('[data-catalogue-loading]');
    if (loading) loading.hidden = true;
    const error = resultsPanel.querySelector<HTMLElement>('[data-catalogue-error]');
    if (error) error.hidden = false;
    return false;
  }
}

/** Modify only the shared shell. Everything outside these boundaries, including
 * the authenticated scene, head, styles and application scripts, passes through byte for byte. */
export async function renderSearchResponse(html: string, url: URL, fetcher: typeof fetch = fetch): Promise<string> {
  const startMarker = '<!--search-shell:start-->', endMarker = '<!--search-shell:end-->';
  const start = html.indexOf(startMarker) + startMarker.length, end = html.indexOf(endMarker);
  if (start < startMarker.length || end < start) throw new Error('Prepared search shell is missing.');
  const { document } = parseHTML(`<html><body>${html.slice(start, end)}</body></html>`);
  const form = requiredElement<HTMLFormElement>(document, '.object-sidebar-search-card');
  const objectId = form.dataset.searchObject;
  if (!objectId || !/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new Error('Prepared search object is invalid.');
  const search = requiredElement<HTMLInputElement>(form, '.object-sidebar-search');
  const focusCard = document.querySelector<HTMLElement>('[data-prepared-focus-card][data-prepared-focus-id]');
  const value = (url.searchParams.get('browse') ?? url.searchParams.get('q') ?? (focusCard ? search.getAttribute('value') : '') ?? '').slice(0, SEARCH_QUERY_LIMIT).trim();
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
  for (const name of ['v', 'overview', 'focus', 'focusLens', 'dataset', 'feature', 'settings', ...[...document.querySelectorAll<HTMLInputElement>('.object-settings input[form][name]')].map(input => input.name)]) {
    const value = url.searchParams.get(name);
    if (value) clear.searchParams.set(name, value.slice(0, 2048));
  }
  // Clearing the search keeps the view context, normalized the way the router resolves it.
  withOverviewScope(clear, overviewScopeFromUrl(url));
  document.querySelector('.object-sidebar-search-clear')?.setAttribute('href', clear.pathname + clear.search);
  const browser = requiredElement<HTMLElement>(document, '.object-browser');
  const presentation = createSearchPresentation(document);
  presentation.present(searching, searching);
  if (searching) requiredElement(document, '.object-sheet-handle').setAttribute('checked', '');
  form.toggleAttribute('data-search-submitted', searching);
  if (searching) {
    const catalogueLoaded = await ensureCatalogueRows(document, browser, url.origin, fetcher);
    const rows = createCatalogueRows(browser);
    const items = rows.items;
    const labels = items.map(item => ({ ...objectSearchLabels(item), item }));
    const requestedCategory = url.searchParams.get('category');
    // Retain old category-only URLs; live search is driven solely by its query.
    const category = ['all', 'planet', 'satellite', 'nebula', 'galaxy', 'galaxy-cluster', 'asteroid'].includes(requestedCategory ?? '') ? requestedCategory : null;
    const result = searchObjects(labels, value || 'all objects');
    const selected = !value && category ? category : result.classification === 'planet' || result.classification === 'dwarf-planet' || result.classification === 'exoplanet' ? 'planet' : 'all';
    const matches = new Set(result.matches.map(match => match.item));
    for (const item of items) {
      item.hidden = !matches.has(item) || !matchesObjectCategory(item.dataset.objectClassification, selected);
    }
    const order = items.toSorted((a, b) => selected === 'planet' && (a.dataset.objectClassification === 'planet') !== (b.dataset.objectClassification === 'planet')
      ? a.dataset.objectClassification === 'planet' ? -1 : 1 : Number(a.dataset.objectDistanceM) - Number(b.dataset.objectDistanceM));
    rows.order(order);
    rows.refresh();
    const overviewCount = presentOverviewResults(browser, value);
    presentation.markCategory(result.classification);
    const featureRoot = document.querySelector<HTMLElement>('.object-feature-results');
    let detailCount = 0;
    if (result.detailQuery && featureRoot) {
      try {
        const pin = parseFeaturePin(featureRoot.dataset.featureIndex);
        if (pin) {
          const results = await findResults(pin, url.origin, result.detailQuery, objectId, fetcher);
          detailCount = presentFeatureResults(featureRoot, results);
        }
      } catch {
        presentFeatureResults(featureRoot, [], 'Feature names could not load. Submit your search to retry.');
        detailCount = 1;
      }
    }
    presentation.setEmptyHidden(items.some(item => !item.hidden) || detailCount + overviewCount > 0, catalogueLoaded);
  }
  createSelectionPresentation(document).present(selectionTargetFromUrl(url, objectId, SCENE_OBJECTS));
  return html.slice(0, start) + document.body.innerHTML + html.slice(end);
}

/** Netlify's query rewrite and local middleware call this same request handler. */
export async function handleSearchRequest(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const objectId = url.pathname === '/.netlify/functions/search' ? url.searchParams.get('object')
    : objectIdAtPath(url.pathname);
  if (!objectId || !/^[a-z][a-z0-9-]*$/u.test(objectId)) return new Response('Object not found', { status: 404 });
  // No query on this fetch: it retrieves the static page without recursing into search.
  const response = await fetcher(new URL(`/${objectId}/`, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const page = await response.text();
  const render = async (target: URL) => renderSearchResponse(await renderDatasetResponse(page, target, objectId, fetcher), target, fetcher);
  let html: string;
  try {
    try { html = await render(url); }
    catch (error) {
      if (!(error instanceof UnreadableSavedView)) throw error;
      // An unreadable shared view (an older format, a damaged copy) renders the page as if it were absent; the browser
      // reports and ignores the same value, and its next camera change rewrites it. Not a redirect: Netlify appends
      // the original query to a function redirect whose target has none, which looped on the root page.
      const withoutView = new URL(url);
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
