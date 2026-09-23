import { parseHTML } from 'linkedom';
import { record, requiredElement } from './browser-types.mts';
import { OBJECT_CATEGORIES, matchesObjectCategory, objectCategoryCount } from './object-categories.mts';
import { objectSearchLabels, searchObjects, SEARCH_QUERY_LIMIT } from './object-search.mts';
import { parseFeaturePin } from './feature-search.mts';
import { findResults } from './find.mts';
import { renderDatasetResponse } from './dataset-response.mts';
import { renderSourceLink } from './source-link.mts';
import { presentFeatureResults, presentOverviewResults, presentSearchResults } from './search-results-presentation.mts';
import { readCatalogueFragmentUrl } from './catalogue-fragment-loader.mts';
import { overviewScopeFromUrl, withOverviewScope } from './navigation-scope.mts';

export interface SearchPin { url: string; bytes: number; sha256: string; count: number; }
export function parseSearchPin(value: unknown): SearchPin {
  if (!record(value) || typeof value.url !== 'string' || !/^\/(?:features|scenes)\/[a-zA-Z0-9/_-]+\.json$/u.test(value.url)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sha256)
    || typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes <= 0
    || typeof value.count !== 'number' || !Number.isSafeInteger(value.count) || value.count < 0) throw new TypeError('Invalid prepared search index pin.');
  return { url: value.url, sha256: value.sha256, bytes: value.bytes, count: value.count };
}

interface Result { name: string; context: string; label: string; href: string; }
function publishResults(root: HTMLElement, results: readonly Result[], hint: string) {
  root.hidden = false;
  requiredElement(root, '.object-destination-hint').textContent = hint;
  for (const [index, anchor] of [...root.querySelectorAll<HTMLAnchorElement>('.object-destination-result')].entries()) {
    const result = results[index];
    anchor.parentElement!.hidden = !result;
    if (!result) continue;
    anchor.setAttribute('href', result.href);
    anchor.setAttribute('aria-label', result.label);
    requiredElement(anchor, '.object-destination-result-name').textContent = result.name;
    requiredElement(anchor, '.object-destination-result-context').textContent = result.context;
  }
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
  const information = requiredElement<HTMLElement>(document, '.object-information-panel');
  const selectedContent = requiredElement<HTMLElement>(document, '.object-selected-content');
  const context = document.querySelector<HTMLElement>('.object-context') ?? browser;
  const sharedLegacyContext = context === browser;
  const selectedOverview = overviewScopeFromUrl(url);
  const showingContext = Boolean(focusCard || selectedOverview);
  browser.toggleAttribute('hidden', !searching);
  selectedContent.toggleAttribute('hidden', searching);
  selectedContent.toggleAttribute('inert', searching);
  information.toggleAttribute('hidden', showingContext);
  if (!sharedLegacyContext) context.toggleAttribute('hidden', !showingContext);
  if (focusCard) focusCard.removeAttribute('hidden');
  if (searching) requiredElement(document, '.object-sheet-handle').setAttribute('checked', '');
  form.toggleAttribute('data-search-submitted', searching);
  browser.setAttribute('aria-label', searching ? 'Search results' : 'Celestial objects');
  const galaxy = context.querySelector<HTMLElement>('[data-galactic-overview]');
  const system = context.querySelector<HTMLElement>('[data-system-results]');
  if (galaxy) galaxy.toggleAttribute('hidden', selectedOverview !== 'milky-way');
  for (const card of context.querySelectorAll<HTMLElement>('[data-large-scale-overview]')) {
    card.toggleAttribute('hidden', card.dataset.largeScaleOverview !== selectedOverview);
  }
  if (system) system.toggleAttribute('hidden', selectedOverview !== 'system');
  // Legacy/unit fixtures still combine navigation and context in one panel.
  if (sharedLegacyContext && searching) {
    if (galaxy) galaxy.setAttribute('hidden', '');
    for (const card of context.querySelectorAll<HTMLElement>('[data-large-scale-overview]')) card.setAttribute('hidden', '');
    if (system) system.removeAttribute('hidden');
  }
  if (searching) {
    const catalogueLoaded = await ensureCatalogueRows(document, browser, url.origin, fetcher);
    const items = [...browser.querySelectorAll<HTMLElement>('.object-item')];
    const labels = items.map(item => ({ ...objectSearchLabels(item), item }));
    const requestedCategory = url.searchParams.get('category');
    const category = OBJECT_CATEGORIES.some(([id]) => id === requestedCategory) ? requestedCategory! : undefined;
    const result = searchObjects(labels, value || 'all objects', category);
    const selected = !value && category ? category : result.classification ? result.category : 'all';
    const matches = new Set(result.matches.map(match => match.item));
    const classifications = result.matches.map(match => match.classification);
    for (const item of items) {
      item.dataset.objectMatch = String(matches.has(item));
      item.hidden = !matches.has(item) || !matchesObjectCategory(item.dataset.objectClassification, selected);
    }
    const order = items.toSorted((a, b) => selected === 'planet' && (a.dataset.objectClassification === 'planet') !== (b.dataset.objectClassification === 'planet')
      ? a.dataset.objectClassification === 'planet' ? -1 : 1 : Number(a.dataset.objectDistanceM) - Number(b.dataset.objectDistanceM));
    for (const [index, chunk] of [...browser.querySelectorAll<HTMLElement>('.object-chunk')].entries()) {
      const rows = order.slice(index * 16, (index + 1) * 16);
      requiredElement(chunk, '.object-chunk-list').append(...rows);
      const visible = rows.filter(item => !item.hidden).length;
      chunk.hidden = visible === 0;
      chunk.style.containIntrinsicBlockSize = `${Math.max(0, visible * 28 - 8)}px`;
    }
    for (const tab of browser.querySelectorAll<HTMLElement>('[data-object-tab]')) {
      tab.setAttribute('aria-selected', String(tab.dataset.objectTab === selected));
      requiredElement(tab, '.object-tab-count').textContent = `(${objectCategoryCount(classifications, tab.dataset.objectTab)})`;
    }
    presentSearchResults(browser, true, selected);
    const overviewCount = presentOverviewResults(browser, value);
    for (const pill of document.querySelectorAll<HTMLElement>('.object-search-category')) {
      pill.setAttribute('aria-pressed', String(pill.dataset.searchClassification === result.classification));
    }
    const featureRoot = document.querySelector<HTMLElement>('.object-feature-results');
    let detailCount = 0;
    if (result.detailQuery && featureRoot) {
      try {
        const pin = parseFeaturePin(featureRoot.dataset.featureIndex);
        if (pin) {
          const results = await findResults(pin, url.origin, result.detailQuery, objectId, fetcher);
          publishResults(featureRoot, results, '');
          presentFeatureResults(featureRoot, results.length);
          detailCount = results.length;
        }
      } catch {
        publishResults(featureRoot, [], 'Feature names could not load. Submit your search to retry.');
        presentFeatureResults(featureRoot, 0, 'Feature names could not load. Submit your search to retry.');
        detailCount = 1;
      }
    }
    requiredElement<HTMLElement>(browser, '.object-empty').hidden = !catalogueLoaded || items.some(item => !item.hidden) || detailCount + overviewCount > 0;
  }
  browser.dataset.sourceFocus = focusCard?.dataset.preparedFocusId ?? '';
  const overview = selectedOverview ?? '';
  // A system overview is hosted by the route's star, so its credits follow that system.
  renderSourceLink(document, focusCard ? `focus:${focusCard.dataset.preparedFocusId}` : `overview:${overview === 'system' ? `system:${objectId}` : overview}`);
  return html.slice(0, start) + document.body.innerHTML + html.slice(end);
}

/** Netlify's query rewrite and local middleware call this same request handler. */
export async function handleSearchRequest(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const url = new URL(request.url);
  const objectId = url.pathname === '/.netlify/functions/search' ? url.searchParams.get('object')
    : url.pathname === '/' ? 'earth' : /^\/([a-z][a-z0-9-]*)\/$/u.exec(url.pathname)?.[1];
  if (!objectId || !/^[a-z][a-z0-9-]*$/u.test(objectId)) return new Response('Object not found', { status: 404 });
  // No query on this fetch: it retrieves the static page without recursing into search.
  const response = await fetcher(new URL(`/${objectId}/`, url.origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  let html: string;
  try {
    html = await renderDatasetResponse(await response.text(), url, objectId, fetcher);
    html = await renderSearchResponse(html, url, fetcher);
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
