import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { handleSearchRequest, renderSearchResponse, parseSearchPin } from '../search-response.mts';
import { objectSearchLabels, searchObjects } from '../object-search.mts';
import { matchesObjectCategory } from '../object-categories.mts';
import searchRoute from '../../netlify/edge-functions/search-route.ts';
import { createFeatureBrowser } from '../feature-browser.mts';
import { handleFindRequest } from '../find.mts';

const origin = 'https://preview.example.test';
const index = JSON.stringify({ schema: 'cssearth-prepared-feature-index@2',
  objects: [{ id: 'moon', name: 'Moon', route: '/moon/', count: 1 }],
  features: [{ objectId: 'moon', id: 'tycho', name: 'Tycho', type: 'Crater', diameterKm: 85,
    searchNames: ['tycho'], searchContext: 'crater' }], places: [] });
const pin = { url: '/features/index.json', bytes: Buffer.byteLength(index), sha256: createHash('sha256').update(index).digest('hex'), count: 1 };
const row = (name: string, classification: string, aliases: string[] = []) => `<li class="object-item" data-object-name="${name.toLowerCase()}"
  data-object-classification="${classification}" data-object-classification-name="${classification}" data-object-system-name="solar system"
  data-object-distance-au="1" data-object-search-names='${JSON.stringify(aliases)}'><a href="/${name.toLowerCase()}/">${name}</a></li>`;
const html = `<!doctype html><html><head><style>u { color: red }</style></head><body data-object-shell="saturn"><!--search-shell:start-->
  <form class="object-sidebar-search-card" data-search-object="saturn"><input class="object-sidebar-search" name="q">
    <input type="hidden" name="v" data-search-context disabled></form><input class="object-sheet-handle" type="checkbox">
  <div class="object-drawer-content"><nav class="object-browser" hidden>
    <div data-galactic-overview hidden>Milky Way</div><div data-system-results><section class="object-selected-panel">Solar System introduction</section>
    <div data-object-navigation-tree></div>
    <div class="object-tabs">${['all', 'planet', 'satellite', 'nebula'].map(category => `<button data-object-tab="${category}"><span class="object-tab-count"></span></button>`).join('')}</div>
    <div id="object-category-results"><ul><li data-search-overview="milky way" hidden><a href="/sun/?overview=milky-way">Milky Way</a></li><li class="object-chunk"><ul class="object-chunk-list">
    ${row('Saturn', 'planet')}${row('Titan', 'satellite')}${row('M42', 'nebula', ['orion nebula', 'm42'])}
    </ul></li></ul><p class="object-empty" hidden>No matching results</p>
    <details class="object-feature-results" data-feature-index='${JSON.stringify(pin)}' hidden><summary>Named features <span class="object-panel-heading-count"></span></summary><p class="object-destination-hint"></p>
      <ul><li hidden><a class="object-destination-result"><span class="object-destination-result-name"></span><span class="object-destination-result-context"></span></a></li></ul></details></div></div>
  </nav><div class="object-selected-content"><section class="object-information-panel">Saturn</section></div></div><!--search-shell:end-->
  <main class="object-stage"><u style='color: red;' data-prepared-node="0"></u></main><script type="module" src="/app.js"></script></body></html>`;
// The one shared, content-addressed catalogue fragment (`dist/catalogue/<sha>.html`):
// the same rows a page used to inline, minus the div they lived in.
const catalogueRowsHtml = `<ul class="object-list"><li data-search-overview="milky way" hidden><a href="/sun/?overview=milky-way">Milky Way</a></li>` +
  `<li class="object-chunk"><ul class="object-chunk-list">${row('Saturn', 'planet')}${row('Titan', 'satellite')}${row('M42', 'nebula', ['orion nebula', 'm42'])}</ul></li></ul>`;
const cataloguePin = { url: `/catalogue/${createHash('sha256').update(catalogueRowsHtml).digest('hex')}.html`,
  sha256: createHash('sha256').update(catalogueRowsHtml).digest('hex'), bytes: Buffer.byteLength(catalogueRowsHtml) };
// A production page: the rows ship empty, referencing the fragment above instead of inlining it.
const htmlNoCatalogue = html
  .replace('<div id="object-category-results">',
    `<div id="object-category-results" data-catalogue-src="${cataloguePin.url}" data-catalogue-sha256="${cataloguePin.sha256}" data-catalogue-bytes="${cataloguePin.bytes}">`)
  .replace(/<ul>.*?<\/ul>(?=<p class="object-empty")/su,
    '<ul class="object-list" data-catalogue-list></ul><p class="object-loading" data-catalogue-loading>Loading celestial objects…</p>' +
    '<p class="object-error" data-catalogue-error hidden>Couldn\'t load the object list. <button type="button" data-catalogue-retry>Retry</button></p>');
assert.ok(htmlNoCatalogue.includes('data-catalogue-list'), 'fixture setup must strip the inline rows');
assert.ok(!htmlNoCatalogue.includes('object-item'), 'fixture setup must strip every inline row');
const fetchIndex: typeof fetch = async input => {
  assert.equal(String(input), `${origin}/features/index.json`);
  return new Response(index);
};
const visibleNames = (document: Document) => [...document.querySelectorAll('.object-item:not([hidden]) a')].map(element => element.textContent);
const fetchIndexAndCatalogue: typeof fetch = async input => {
  const url = String(input);
  if (url === `${origin}${cataloguePin.url}`) return new Response(catalogueRowsHtml);
  return fetchIndex(input);
};

test('a page that ships its catalogue empty has it fetched and merged before matching', async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async input => { seen.push(String(input)); return fetchIndexAndCatalogue(input); };
  const document = parseHTML(await renderSearchResponse(htmlNoCatalogue, new URL('/saturn/?q=saturn', origin), fetcher)).document;
  assert.deepEqual(visibleNames(document), ['Saturn']);
  assert.equal(document.querySelectorAll('.object-item').length, 3);
  assert.equal(document.querySelector<HTMLElement>('[data-catalogue-loading]')?.hidden, true);
  assert.ok(seen.includes(`${origin}${cataloguePin.url}`), 'the catalogue fragment was fetched');
  // Re-rendering the merged document needs no second fetch: the rows are already there.
  const again = await renderSearchResponse(await renderSearchResponse(htmlNoCatalogue, new URL('/saturn/?q=titan', origin), fetcher), new URL('/saturn/?q=titan', origin), fetchIndex);
  assert.deepEqual(visibleNames(parseHTML(again).document), ['Titan']);
});

test('a merged catalogue fragment degrades to an empty list plus a message on a byte or hash drift, instead of failing the request', async () => {
  const wrongBytes: typeof fetch = async input => String(input) === `${origin}${cataloguePin.url}` ? new Response(`${catalogueRowsHtml}<!-- extra -->`) : fetchIndex(input);
  const bytesDoc = parseHTML(await renderSearchResponse(htmlNoCatalogue, new URL('/saturn/?q=saturn', origin), wrongBytes)).document;
  assert.equal(bytesDoc.querySelectorAll('.object-item').length, 0);
  assert.equal(bytesDoc.querySelector<HTMLElement>('[data-catalogue-error]')?.hidden, false);
  assert.equal(bytesDoc.querySelector<HTMLElement>('[data-catalogue-loading]')?.hidden, true);
  assert.equal(bytesDoc.querySelector<HTMLElement>('.object-empty')?.hidden, true);

  const wrongHash: typeof fetch = async input => String(input) === `${origin}${cataloguePin.url}` ? new Response('x'.repeat(catalogueRowsHtml.length)) : fetchIndex(input);
  const hashDoc = parseHTML(await renderSearchResponse(htmlNoCatalogue, new URL('/saturn/?q=saturn', origin), wrongHash)).document;
  assert.equal(hashDoc.querySelector<HTMLElement>('[data-catalogue-error]')?.hidden, false);
  assert.equal(hashDoc.querySelector<HTMLElement>('.object-empty')?.hidden, true);
});

test('a page that already inlines its catalogue never fetches the fragment', async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async input => { seen.push(String(input)); return fetchIndex(input); };
  await renderSearchResponse(html, new URL('/saturn/?q=saturn', origin), fetcher);
  assert.deepEqual(seen, [`${origin}/features/index.json`]);
});

test('native search replaces the selected card, retains every row, and preserves the scene/head bytes', async () => {
  for (const [query, names] of [['saturn', ['Saturn']], ['orion', ['M42']], ['planets', ['Saturn']], ['unknown', []]] as const) {
    const response = await renderSearchResponse(html, new URL(`/?q=${query}`, origin), fetchIndex);
    const { document } = parseHTML(response);
    assert.deepEqual(visibleNames(document), names);
    assert.equal(document.querySelectorAll('.object-item').length, 3);
    assert.equal(document.querySelector<HTMLElement>('.object-selected-content')?.hidden, true);
    assert.equal(document.querySelector<HTMLElement>('.object-browser')?.hidden, false);
    assert.equal(response.slice(0, response.indexOf('<!--search-shell:start-->')), html.slice(0, html.indexOf('<!--search-shell:start-->')));
    assert.equal(response.slice(response.indexOf('<!--search-shell:end-->')), html.slice(html.indexOf('<!--search-shell:end-->')));
    const items = [...document.querySelectorAll<HTMLElement>('.object-item')].map(objectSearchLabels);
    const result = searchObjects(items, query);
    assert.deepEqual(result.matches.filter(item => matchesObjectCategory(item.classification, result.category)).map(item => item.name), names.map(name => name.toLowerCase()));
  }
});

test('empty submission browses all objects, categories retain the query, pills replace it', async () => {
  const empty = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=', origin), fetchIndex)).document;
  assert.deepEqual(visibleNames(empty), ['Saturn', 'Titan', 'M42']);
  const category = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=&category=satellite&v=saved-view', origin), fetchIndex)).document;
  assert.deepEqual(visibleNames(category), ['Titan']);
  assert.equal(category.querySelector('input[name=v]')?.getAttribute('value'), 'saved-view');
  assert.equal(category.querySelector('input[name=v]')?.hasAttribute('disabled'), false);
  const pill = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=old&browse=Planets', origin), fetchIndex)).document;
  assert.deepEqual(visibleNames(pill), ['Saturn']);
  assert.equal(pill.querySelector('input[name=q]')?.getAttribute('value'), 'Planets');
});

test('features are pinned, rendered into existing rows and have ordinary destination links', async () => {
  const document = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=tycho', origin), fetchIndex)).document;
  assert.equal(document.querySelector('.object-destination-result')?.getAttribute('href'), '/moon/?feature=tycho');
  assert.equal(document.querySelector('.object-destination-result-name')?.textContent, 'Tycho');
  assert.equal(document.querySelector<HTMLElement>('.object-empty')?.hidden, true);
  const corrupt: typeof fetch = async () => new Response(index.replace('Tycho', 'Tych0'));
  const failure = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=tycho', origin), corrupt)).document;
  assert.match(failure.querySelector('.object-destination-hint')?.textContent ?? '', /could not load/);
  assert.equal(failure.querySelector('.object-destination-result')?.hasAttribute('href'), false);
});

test('typed search shows a flat result list without the navigation tree, including queries that name an overview', async () => {
  for (const query of ['t', 'Milky Way']) {
    const document = parseHTML(await renderSearchResponse(html, new URL(`/saturn/?q=${encodeURIComponent(query)}`, origin), fetchIndex)).document;
    assert.equal(document.querySelector<HTMLElement>('[data-galactic-overview]')?.hidden, true);
    assert.equal(document.querySelector<HTMLElement>('[data-system-results] > .object-selected-panel')?.hidden, true);
    assert.equal(document.querySelector<HTMLElement>('.object-tabs')?.hidden, true);
    assert.equal(document.querySelector<HTMLElement>('[data-object-navigation-tree]')?.hidden, true);
    assert.equal(document.querySelector('.object-browser')?.getAttribute('aria-label'), 'Search results');
    assert.equal(document.querySelector('#object-category-results')?.getAttribute('aria-labelledby'), null);
    if (query === 't') assert.deepEqual(visibleNames(document), ['Saturn', 'Titan']);
    assert.equal(document.querySelector<HTMLElement>('[data-search-overview]')?.hidden, query !== 'Milky Way');
    if (query === 'Milky Way') assert.equal(document.querySelector<HTMLElement>('.object-empty')?.hidden, true);
  }
});

// The shipped shell keeps navigation and the selected context in separate panels,
// so a URL that names both a focus and an overview can show two cards at once.
const contextHtml = html
  .replace('</form>', '<a class="object-sidebar-search-clear" href="/saturn/">Clear search</a></form>')
  .replace('</nav>', `</nav><div class="object-context" hidden>
  <div data-prepared-focus-card data-prepared-focus-id="m42" hidden>Orion Nebula</div>
  <div data-galactic-overview hidden>Milky Way</div>
  <div data-system-results hidden><section class="object-selected-panel">Solar System introduction</section></div>
  </div>`);

test('a URL that names both a focus and an overview resolves to the focus alone', async () => {
  const card = (query: string) => renderSearchResponse(contextHtml, new URL(`/saturn/${query}`, origin), fetchIndex)
    .then(response => parseHTML(response).document);
  const overview = await card('?overview=system');
  assert.equal(overview.querySelector<HTMLElement>('.object-context [data-system-results]')?.hidden, false);
  assert.equal(overview.querySelector<HTMLElement>('.object-context')?.hidden, false);
  for (const query of ['?overview=system&focus=m42', '?focus=m42&overview=system']) {
    const both = await card(query);
    assert.equal(both.querySelector<HTMLElement>('[data-prepared-focus-card]')?.hidden, false, query);
    assert.equal(both.querySelector<HTMLElement>('.object-context [data-system-results]')?.hidden, true, query);
    assert.equal(both.querySelector<HTMLElement>('.object-context [data-galactic-overview]')?.hidden, true, query);
    // Clearing a search keeps the view context, normalized the same way.
    const clear = new URL(both.querySelector('.object-sidebar-search-clear')?.getAttribute('href') ?? '/', origin);
    assert.equal(clear.searchParams.get('focus'), 'm42', query);
    assert.equal(clear.searchParams.has('overview'), false, query);
  }
});

test('named features share the results panel, start collapsed, and disappear when there are no matches', async () => {
  const document = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=tycho', origin), fetchIndex)).document;
  const features = document.querySelector<HTMLElement>('#object-category-results > .object-feature-results');
  assert.ok(features);
  assert.equal(features.hidden, false);
  assert.equal(features.hasAttribute('open'), false);
  assert.equal(features.querySelector('.object-panel-heading-count')?.textContent, '(1)');
  const empty = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=unknown', origin), fetchIndex)).document;
  assert.equal(empty.querySelector<HTMLElement>('.object-feature-results')?.hidden, true);
  assert.equal(empty.querySelector<HTMLElement>('.object-empty')?.hidden, false);
});

test('live feature results retain their rows and disclosure until the query changes', async context => {
  // The browser asks the find API; the real handler answers it from this index.
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => handleFindRequest(new Request(String(input)), pin, async () => new Response(index)));
  const { document } = parseHTML(html);
  const root = document.querySelector<HTMLElement>('.object-feature-results')!;
  const row = root.querySelector('.object-destination-result');
  const counts: number[] = [];
  const browser = createFeatureBrowser({ documentTarget: document, objectId: 'saturn', onSelected() {}, onResults: count => counts.push(count) })!;
  await browser.search('tycho');
  assert.equal(root.hidden, false);
  assert.equal(root.hasAttribute('open'), false);
  root.setAttribute('open', '');
  await browser.search('tycho');
  assert.equal(root.hasAttribute('open'), true);
  await browser.search('unknown');
  assert.equal(root.hidden, true);
  assert.equal(root.hasAttribute('open'), false);
  assert.equal(root.querySelector('.object-destination-result'), row);
  assert.deepEqual(counts, [1, 1, 0]);
  browser.destroy();
});

test('queries stay text, are bounded, and cannot become executable attributes or scene markup', async () => {
  const query = '\"><img src=x onerror=alert(1)>';
  const document = parseHTML(await renderSearchResponse(html, new URL(`/?q=${encodeURIComponent(query)}`, origin), fetchIndex)).document;
  assert.equal(document.querySelector('input[name=q]')?.getAttribute('value'), query);
  assert.equal(document.querySelectorAll('img,[onerror]').length, 0);
  const long = parseHTML(await renderSearchResponse(html, new URL(`/?q=${'a'.repeat(500)}`, origin), fetchIndex)).document;
  assert.equal(long.querySelector('input[name=q]')?.getAttribute('value')?.length, 200);
  assert.throws(() => parseSearchPin({ ...pin, url: '//attacker.example/index.json' }));
});

test('Netlify routing keeps all query parameters, bypasses assets, and never recurses on its function', () => {
  const result = searchRoute(new Request(`${origin}/saturn/?q=titan&category=satellite&v=view&overview=system`));
  assert.equal(result?.pathname, '/.netlify/functions/search');
  assert.equal(result?.searchParams.get('object'), 'saturn');
  assert.equal(result?.searchParams.get('category'), 'satellite');
  assert.equal(result?.searchParams.get('v'), 'view');
  assert.equal(searchRoute(new Request(result!)), undefined);
  for (const query of ['v=view', 'settings=1', 'feature=6152', 'focus=m42', 'focusLens=visible']) {
    assert.equal(searchRoute(new Request(`${origin}/saturn/?${query}`))?.pathname, '/.netlify/functions/search');
  }
  for (const path of ['/saturn/', '/scenes/saturn/image.webp?q=text', '/navigation/saturn/?q=text']) assert.equal(searchRoute(new Request(origin + path)), undefined);
  assert.equal(searchRoute(new Request(origin + '/?q=text'))?.searchParams.get('object'), 'earth');
});

test('function fetches only the static page and pinned indexes; search responses are not shared-cacheable', async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async input => {
    seen.push(String(input));
    return String(input).endsWith('/saturn/') ? new Response(html, { headers: { 'content-type': 'text/html', etag: 'static', 'content-length': '123' } }) : fetchIndex(input);
  };
  const response = await handleSearchRequest(new Request(origin + '/.netlify/functions/search?object=saturn&q=saturn'), fetcher);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  assert.deepEqual(seen, [origin + '/saturn/', origin + '/features/index.json']);
  assert.equal((await handleSearchRequest(new Request(origin + '/.netlify/functions/search?object=../secrets&q=x'), fetcher)).status, 404);
  assert.equal((await handleSearchRequest(new Request(origin + '/saturn/?q=x', { method: 'POST' }), fetcher)).status, 405);
});
