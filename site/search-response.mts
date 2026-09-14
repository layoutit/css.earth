import { parseHTML } from 'linkedom';
import { record, requiredElement } from './browser-types.mts';
import { OBJECT_CATEGORIES, matchesObjectCategory, objectCategoryCount } from './object-categories.mts';
import { objectSearchLabels, searchObjects, SEARCH_QUERY_LIMIT } from './object-search.mts';
import { parseFeatureIndex, parseFeaturePin, matchFeatures, featureResult } from './feature-search.mts';
import { renderDatasetResponse } from './dataset-response.mts';

export interface SearchPin { url: string; bytes: number; sha256: string; count: number; }
export function parseSearchPin(value: unknown): SearchPin {
  if (!record(value) || typeof value.url !== 'string' || !/^\/(?:features|scenes)\/[a-zA-Z0-9/_-]+\.json$/u.test(value.url)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.sha256)
    || typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes <= 0
    || typeof value.count !== 'number' || !Number.isSafeInteger(value.count) || value.count < 0) throw new TypeError('Invalid prepared search index pin.');
  return { url: value.url, sha256: value.sha256, bytes: value.bytes, count: value.count };
}

const indexes = new Map<string, Promise<unknown>>();
async function readIndex(pin: SearchPin, origin: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(new URL(pin.url, origin), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('Prepared search index could not load.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== pin.bytes) throw new Error('Prepared search index size drifted.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== pin.sha256) throw new Error('Prepared search index identity drifted.');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function loadIndex(pin: SearchPin, origin: string, fetcher: typeof fetch): Promise<unknown> {
  // Reuse authenticated data across warm invocations, never query results or DOM.
  // Custom transports (including tests) own their own caching policy.
  if (fetcher !== fetch) return readIndex(pin, origin, fetcher);
  const key = `${origin}${pin.url}:${pin.sha256}:${pin.bytes}:${pin.count}`;
  const cached = indexes.get(key);
  if (cached) return cached;
  if (indexes.size >= 4) indexes.delete(indexes.keys().next().value!);
  const pending = readIndex(pin, origin, fetcher).catch(error => { indexes.delete(key); throw error; });
  indexes.set(key, pending);
  return pending;
}

interface Result { name: string; context: string; label: string; href: string; }
function publishResults(root: HTMLElement, results: readonly Result[], hint: string) {
  root.hidden = false;
  requiredElement(root, '.planet-destination-hint').textContent = hint;
  for (const [index, anchor] of [...root.querySelectorAll<HTMLAnchorElement>('.planet-destination-result')].entries()) {
    const result = results[index];
    anchor.parentElement!.hidden = !result;
    if (!result) continue;
    anchor.setAttribute('href', result.href);
    anchor.setAttribute('aria-label', result.label);
    requiredElement(anchor, '.planet-destination-result-name').textContent = result.name;
    requiredElement(anchor, '.planet-destination-result-context').textContent = result.context;
  }
}

/** Modify only the shared shell. Everything outside these boundaries, including
 * the authenticated scene, head, styles and application scripts, passes through byte for byte. */
export async function renderSearchResponse(html: string, url: URL, fetcher: typeof fetch = fetch): Promise<string> {
  const startMarker = '<!--search-shell:start-->', endMarker = '<!--search-shell:end-->';
  const start = html.indexOf(startMarker) + startMarker.length, end = html.indexOf(endMarker);
  if (start < startMarker.length || end < start) throw new Error('Prepared search shell is missing.');
  const { document } = parseHTML(`<html><body>${html.slice(start, end)}</body></html>`);
  const form = requiredElement<HTMLFormElement>(document, '.planet-sidebar-search-card');
  const objectId = form.dataset.searchObject;
  if (!objectId || !/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new Error('Prepared search object is invalid.');
  const search = requiredElement<HTMLInputElement>(form, '.planet-sidebar-search');
  const value = (url.searchParams.get('browse') ?? url.searchParams.get('q') ?? '').slice(0, SEARCH_QUERY_LIMIT).trim();
  const searching = url.searchParams.has('q');
  search.setAttribute('value', value);
  for (const input of document.querySelectorAll<HTMLInputElement>('[data-search-context], [data-dataset-context]')) {
    const value = url.searchParams.get(input.name);
    input.toggleAttribute('disabled', !value);
    input.setAttribute('value', value?.slice(0, 2048) ?? '');
  }
  const clear = new URL(`/${objectId}/`, url.origin);
  for (const name of ['v', 'overview', 'focus', 'focusLens', 'dataset']) {
    const value = url.searchParams.get(name);
    if (value) clear.searchParams.set(name, value.slice(0, 2048));
  }
  document.querySelector('.planet-sidebar-search-clear')?.setAttribute('href', clear.pathname + clear.search);
  const browser = requiredElement<HTMLElement>(document, '.planet-object-browser');
  const information = requiredElement<HTMLElement>(document, '.planet-information-panel');
  browser.hidden = !searching;
  information.hidden = searching;
  if (searching) requiredElement(document, '.planet-sheet-handle').setAttribute('checked', '');
  form.toggleAttribute('data-search-submitted', searching);
  const galactic = searching && value.toLocaleLowerCase('en') === 'milky way';
  browser.setAttribute('aria-label', galactic ? 'Milky Way' : 'Celestial objects');
  const galaxy = browser.querySelector<HTMLElement>('[data-galactic-overview]');
  const system = browser.querySelector<HTMLElement>('[data-solar-system-results]');
  if (galaxy) galaxy.hidden = !galactic;
  if (system) system.hidden = galactic;
  if (searching && !galactic) {
    const items = [...browser.querySelectorAll<HTMLElement>('.planet-object-item')];
    const labels = items.map(item => ({ ...objectSearchLabels(item), item }));
    const requestedCategory = url.searchParams.get('category');
    const category = OBJECT_CATEGORIES.some(([id]) => id === requestedCategory) ? requestedCategory! : undefined;
    const result = searchObjects(labels, value || 'all objects', category);
    const selected = category ?? result.category;
    const matches = new Set(result.matches.map(match => match.item));
    const classifications = result.matches.map(match => match.classification);
    for (const item of items) {
      item.dataset.objectMatch = String(matches.has(item));
      item.hidden = !matches.has(item) || !matchesObjectCategory(item.dataset.objectClassification, selected);
    }
    const order = items.toSorted((a, b) => selected === 'planet' && (a.dataset.objectClassification === 'planet') !== (b.dataset.objectClassification === 'planet')
      ? a.dataset.objectClassification === 'planet' ? -1 : 1 : Number(a.dataset.objectDistanceAu) - Number(b.dataset.objectDistanceAu));
    for (const [index, chunk] of [...browser.querySelectorAll<HTMLElement>('.planet-object-chunk')].entries()) {
      const rows = order.slice(index * 16, (index + 1) * 16);
      requiredElement(chunk, '.planet-object-chunk-list').append(...rows);
      const visible = rows.filter(item => !item.hidden).length;
      chunk.hidden = visible === 0;
      chunk.style.containIntrinsicBlockSize = `${Math.max(0, visible * 28 - 8)}px`;
    }
    for (const tab of browser.querySelectorAll<HTMLElement>('[data-object-tab]')) {
      tab.setAttribute('aria-selected', String(tab.dataset.objectTab === selected));
      requiredElement(tab, '.planet-object-tab-count').textContent = `(${objectCategoryCount(classifications, tab.dataset.objectTab)})`;
    }
    requiredElement(browser, '#object-category-results').setAttribute('aria-labelledby', `object-tab-${selected}`);
    const heading = browser.querySelector<HTMLElement>('[data-solar-system-results] > .planet-selected-panel');
    if (heading) heading.hidden = selected === 'nebula';
    for (const pill of document.querySelectorAll<HTMLElement>('.planet-search-category')) {
      pill.setAttribute('aria-pressed', String(pill.dataset.searchClassification === result.classification));
    }
    const featureRoot = document.querySelector<HTMLElement>('.planet-feature-results');
    let detailCount = 0;
    if (result.detailQuery && featureRoot) {
      try {
        const pin = parseFeaturePin(featureRoot.dataset.featureIndex);
        if (pin) {
          const index = parseFeatureIndex(await loadIndex(parseSearchPin(pin), url.origin, fetcher), pin);
          const results = matchFeatures(index, result.detailQuery, objectId).map(feature => featureResult(feature, index, objectId));
          publishResults(featureRoot, results, results.length ? 'Named features' : 'No matching named features.');
          detailCount = results.length || 1;
        }
      } catch {
        publishResults(featureRoot, [], 'Feature names could not load. Submit your search to retry.');
        detailCount = 1;
      }
    }
    requiredElement<HTMLElement>(browser, '.planet-object-empty').hidden = items.some(item => !item.hidden) || detailCount > 0;
  }
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
