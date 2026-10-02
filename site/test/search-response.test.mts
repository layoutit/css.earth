import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { handleSearchRequest, renderSearchResponse } from '../server/search-response.mts';
import { createSelectionPresentation } from '../selection-presentation.mts';
import searchRoute from '../server/search-route.mts';
import { createFeatureBrowser } from '../feature-browser.mts';
import { findObjects, handleFindRequest } from '../server/find.mts';
import { readPublicFile, type SearchData } from '../server/search-data.mts';
import { parseFindResponse } from '../search/find-protocol.mts';
import type { CatalogueIndexEntry } from '../search/catalogue-index.mts';

const origin = 'https://preview.example.test';
const index = { schema: 'cssearth-prepared-feature-index@2',
  objects: [{ id: 'moon', name: 'Moon', route: '/moon/', count: 1 }],
  features: [{ objectId: 'moon', id: 'tycho', name: 'Tycho', type: 'Crater', diameterKm: 85,
    searchNames: ['tycho'], searchContext: 'crater' }], places: [] };
const pin = { url: '/features/index.json', count: 1 };
const entry = (kind: 'scene' | 'bank', name: string, classification: string, distanceMeters: number, searchNames: string[] = []): CatalogueIndexEntry => {
  const id = name.toLowerCase();
  return { kind: 'scene', id, name, searchNames, classification, classificationName: classification, systemName: 'solar system',
    route: `/${id}/`, illustration: false, distanceMeters,
    detail: { text: `${distanceMeters} m`, title: 'Observer distance', ariaLabel: `${distanceMeters} m. Observer distance` },
    source: { subject: `object:${id}`, document: `/sources/${id}/`, label: `Sources for ${name}` },
    marker: kind === 'scene' ? { kind: 'scene', id: 'saturn', color: '#fff' } : { kind: 'thumbnail', thumbnail: null } };
};
const entries = [entry('scene', 'Saturn', 'planet', 1), entry('scene', 'Titan', 'satellite', 2), entry('bank', 'M42', 'nebula', 3, ['orion nebula', 'm42'])];
const reads: string[] = [];
const data = (catalogue = entries, read: SearchData['read'] = async path => { reads.push(path); if (path === pin.url) return index; throw new Error(`${path} is not prepared.`); }): SearchData =>
  ({ pin, read, catalogue: async () => catalogue });
const html = `<!doctype html><html><head><style>u { color: red }</style></head><body data-object-shell="saturn"><!--search-shell:start-->
  <form class="object-sidebar-search-card" data-search-object="saturn"><input class="object-sidebar-search" name="q">
    <input type="hidden" name="v" data-search-context disabled></form><input class="object-sheet-handle" type="checkbox">
  <div class="object-drawer-content"><nav class="object-browser" hidden>
    <div id="object-category-results" role="region" aria-label="Search results">
    <ul class="object-list" data-catalogue-list></ul>
    <p class="object-error" data-search-error hidden>Couldn't load search results. <button type="button" data-search-retry>Retry</button></p>
    <p class="object-empty" hidden>No matching results</p>
    <details class="object-feature-results" hidden><summary>Named features <span class="object-panel-heading-count"></span></summary><p class="object-destination-hint"></p>
      <ul><li hidden><a class="object-destination-result"><span class="object-destination-result-name"></span><span class="object-destination-result-context"></span></a></li></ul></details></div>
  </nav><div class="object-selected-content">
    <section class="object-information-panel"><div data-planetary-system>System header</div><div class="body-part">Saturn</div><div data-planetary-system data-system-bodies-slot></div></section></div></div><!--search-shell:end-->
  <main class="object-stage"><u style='color: red;' data-prepared-node="0"></u></main><script type="module" src="/app.js"></script></body></html>`;
const visibleNames = (document: Document) => [...document.querySelectorAll('[data-catalogue-list] .object-item .object-name')].map(element => element.textContent);
const render = async (path: string, search = data(), source = html) => parseHTML(await renderSearchResponse(source, new URL(path, origin), search)).document;

test('native search lists the rows the find function would answer, with the same row markup', async () => {
  const document = await render('/saturn/?q=orion');
  assert.deepEqual(visibleNames(document), ['M42']);
  const row = document.querySelector('[data-catalogue-list] .object-item a');
  assert.equal(row?.getAttribute('href'), '/m42/');
  assert.equal(row?.getAttribute('data-source-subject'), 'object:m42');
  const live = parseFindResponse(await (await handleFindRequest(new Request(`${origin}/.netlify/functions/find?object=saturn&q=orion`), data())).json());
  assert.deepEqual(live.objects.rows.map(result => result.name), visibleNames(document));
});

test('an object catalogue that cannot load fails the request instead of listing nothing', async () => {
  const broken: SearchData = { ...data(), catalogue: async () => { throw new Error('dist/catalogue/index.json is missing'); } };
  await assert.rejects(renderSearchResponse(html, new URL('/saturn/?q=saturn', origin), broken), /index\.json is missing/u);
});

test('native search replaces the selected card, lists the find function\'s matches, and preserves the scene/head bytes', async () => {
  for (const [query, names] of [['saturn', ['Saturn']], ['orion', ['M42']], ['planets', ['Saturn']], ['unknown', []]] as const) {
    const response = await renderSearchResponse(html, new URL(`/?q=${query}`, origin), data());
    const { document } = parseHTML(response);
    assert.deepEqual(visibleNames(document), names);
    assert.equal(document.querySelector<HTMLElement>('.object-selected-content')?.hidden, true);
    assert.equal(document.querySelector<HTMLElement>('.object-browser')?.hidden, false);
    assert.equal(response.slice(0, response.indexOf('<!--search-shell:start-->')), html.slice(0, html.indexOf('<!--search-shell:start-->')));
    assert.equal(response.slice(response.indexOf('<!--search-shell:end-->')), html.slice(html.indexOf('<!--search-shell:end-->')));
    assert.deepEqual(findObjects(entries, query).objects.rows.map(row => row.name), names);
  }
});

test('empty submission browses all objects, keeps the view context, and pills replace the query', async () => {
  const empty = await render('/saturn/?q=&v=saved-view');
  assert.deepEqual(visibleNames(empty), ['Saturn', 'Titan', 'M42']);
  assert.equal(empty.querySelector('input[name=v]')?.getAttribute('value'), 'saved-view');
  assert.equal(empty.querySelector('input[name=v]')?.hasAttribute('disabled'), false);
  const pill = await render('/saturn/?q=old&browse=Planets');
  assert.deepEqual(visibleNames(pill), ['Saturn']);
  assert.equal(pill.querySelector('input[name=q]')?.getAttribute('value'), 'Planets');
});

test('native search lists planets first, then catalogue rows by their meter distances', async () => {
  const farTitan = [entry('scene', 'Titan', 'satellite', 100), ...entries.filter(({ id }) => id !== 'titan')];
  assert.deepEqual(visibleNames(await render('/saturn/?q=', data(farTitan))), ['Saturn', 'M42', 'Titan']);
});

test('features are pinned, rendered into existing rows and have ordinary destination links', async () => {
  reads.length = 0;
  const document = await render('/saturn/?q=tycho');
  assert.deepEqual(reads, ['/features/index.json'], 'the feature index is read from the files beside the function');
  assert.equal(document.querySelector('.object-destination-result')?.getAttribute('href'), '/moon/?feature=tycho');
  assert.equal(document.querySelector('.object-destination-result-name')?.textContent, 'Tycho');
  assert.equal(document.querySelector<HTMLElement>('.object-empty')?.hidden, true);
  const failure = await render('/saturn/?q=tycho', data(entries, async () => { throw new Error('unavailable'); }));
  assert.match(failure.querySelector('.object-destination-hint')?.textContent ?? '', /could not load/);
  assert.equal(failure.querySelector('.object-destination-result')?.hasAttribute('href'), false);
});

test('typed search shows a flat result list, including queries that name a level of the zoom ladder', async () => {
  for (const query of ['t', 'Milky Way']) {
    const document = await render(`/saturn/?q=${encodeURIComponent(query)}`);
    assert.equal(document.querySelector<HTMLElement>('.object-selected-content')?.hidden, true);
    assert.equal(document.querySelectorAll('[data-object-tab]').length, 0);
    assert.equal(document.querySelector('.object-browser')?.getAttribute('aria-label'), 'Search results');
    assert.equal(document.querySelector('#object-category-results')?.getAttribute('aria-labelledby'), null);
    // A name that begins with the query ranks first, as in the live search.
    if (query === 't') assert.deepEqual(visibleNames(document), ['Titan', 'Saturn']);
    // A level is an object: it is found as an ordinary row of the catalogue, here one the fixture adds.
    if (query === 'Milky Way') {
      const found = await render('/saturn/?q=Milky%20Way', data([...entries, entry('scene', 'Milky Way', 'galaxy', 4)]));
      assert.deepEqual(visibleNames(found), ['Milky Way']);
      assert.equal(found.querySelector<HTMLElement>('.object-empty')?.hidden, true);
    }
  }
});

const contextHtml = html
  .replace('</form>', '<a class="object-sidebar-search-clear" href="/saturn/">Clear search</a></form>');

test('the native response shows the card as its subject: the body, or the planetary system of a star that has one', async () => {
  const card = (document: Document) => document.querySelector<HTMLElement>('.object-information-panel')!;
  const mounted = (document: Document) => [...card(document).children].filter(child => child.tagName !== 'TEMPLATE').map(child => child.textContent);
  // A star's system view mounts its system parts; the body view keeps them off the page (detached-sections.ts).
  const system = await render('/trappist-1/?overview=system', data(), contextHtml.replace('data-search-object="saturn"', 'data-search-object="trappist-1"'));
  assert.equal(card(system).dataset.cardSubject, 'planetary-system');
  assert.equal(card(system).dataset.cardView, 'overview');
  assert.deepEqual(mounted(system), ['System header', 'Saturn', '']);
  const body = await render('/saturn/', data(), contextHtml);
  assert.equal(card(body).dataset.cardSubject, 'body');
  assert.deepEqual(mounted(body), ['Saturn']);
  // A system overview is a view of its star's page: on a planet's page the address names the planet.
  const planet = await render('/saturn/?overview=system', data(), contextHtml);
  assert.equal(card(planet).dataset.cardSubject, 'body');
  // The live shell presents the card itself (updateBodyCard), so the shared presentation leaves it alone there.
  const live = parseHTML(contextHtml).document;
  createSelectionPresentation(live).present({ objectId: 'trappist-1', view: 'system' });
  assert.equal(card(live).dataset.cardSubject, undefined);
});

test('named features share the results panel, start collapsed, and disappear when there are no matches', async () => {
  const document = await render('/saturn/?q=tycho');
  const features = document.querySelector<HTMLElement>('#object-category-results > .object-feature-results');
  assert.ok(features);
  assert.equal(features.hidden, false);
  assert.equal(features.hasAttribute('open'), false);
  assert.equal(features.querySelector('.object-panel-heading-count')?.textContent, '(1)');
  const empty = await render('/saturn/?q=unknown');
  assert.equal(empty.querySelector<HTMLElement>('.object-feature-results')?.hidden, true);
  assert.equal(empty.querySelector<HTMLElement>('.object-empty')?.hidden, false);
});

test('live feature results retain their rows and disclosure until the query changes', async () => {
  // The find function answers the browser's query; the real handler answers it from this index.
  const features = async (query: string) => parseFindResponse(await (await handleFindRequest(new Request(`${origin}/.netlify/functions/find?object=saturn&q=${query}`), data())).json()).features;
  const { document } = parseHTML(html);
  const root = document.querySelector<HTMLElement>('.object-feature-results')!;
  const row = root.querySelector('.object-destination-result');
  const browser = createFeatureBrowser({ documentTarget: document, onSelected() {} })!;
  const counts = [browser.present('tycho', await features('tycho'))];
  assert.equal(root.hidden, false);
  assert.equal(root.hasAttribute('open'), false);
  root.setAttribute('open', '');
  counts.push(browser.present('tycho', await features('tycho')));
  assert.equal(root.hasAttribute('open'), true);
  counts.push(browser.present('unknown', await features('unknown')));
  assert.equal(root.hidden, true);
  assert.equal(root.hasAttribute('open'), false);
  assert.equal(root.querySelector('.object-destination-result'), row);
  assert.deepEqual(counts, [1, 1, 0]);
  browser.destroy();
});

test('queries stay text, are bounded, and cannot become executable attributes or scene markup', async () => {
  const query = '\"><img src=x onerror=alert(1)>';
  const document = await render(`/?q=${encodeURIComponent(query)}`);
  assert.equal(document.querySelector('input[name=q]')?.getAttribute('value'), query);
  assert.equal(document.querySelectorAll('img,[onerror]').length, 0);
  const long = await render(`/?q=${'a'.repeat(500)}`);
  assert.equal(long.querySelector('input[name=q]')?.getAttribute('value')?.length, 200);
  await assert.rejects(readPublicFile('//attacker.example/index.json'), /path is invalid/u);
  await assert.rejects(readPublicFile('/features/../../secrets.json'), /path is invalid/u);
});

test('Netlify routing keeps all query parameters, bypasses assets, and never recurses on its function', () => {
  const result = searchRoute(new Request(`${origin}/saturn/?q=titan&dataset=visible&v=view&overview=system`));
  assert.equal(result?.pathname, '/.netlify/functions/search');
  assert.equal(result?.searchParams.get('object'), 'saturn');
  assert.equal(result?.searchParams.get('dataset'), 'visible');
  assert.equal(result?.searchParams.get('v'), 'view');
  assert.equal(searchRoute(new Request(result!)), undefined);
  for (const query of ['overview=system', 'v=view', 'settings=1', 'feature=6152', 'dataset=visible']) {
    assert.equal(searchRoute(new Request(`${origin}/saturn/?${query}`))?.pathname, '/.netlify/functions/search');
  }
  // A catalogue focus's page is routed by its own id; the function renders it on its host scene's page.
  assert.equal(searchRoute(new Request(`${origin}/m42/?dataset=eso-vista`))?.searchParams.get('object'), 'm42');
  for (const path of ['/saturn/', '/scenes/saturn/image.webp?q=text', '/navigation/saturn/?q=text']) assert.equal(searchRoute(new Request(origin + path)), undefined);
  assert.equal(searchRoute(new Request(origin + '/?q=text'))?.searchParams.get('object'), 'earth');
});

test('function fetches only the static page; search responses are not shared-cacheable', async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async input => {
    seen.push(String(input));
    return new Response(html, { headers: { 'content-type': 'text/html', etag: 'static', 'content-length': '123' } });
  };
  const response = await handleSearchRequest(new Request(origin + '/.netlify/functions/search?object=saturn&q=saturn'), data(), fetcher);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  assert.deepEqual(seen, [origin + '/saturn/']);
  assert.equal((await handleSearchRequest(new Request(origin + '/.netlify/functions/search?object=../secrets&q=x'), data(), fetcher)).status, 404);
  assert.equal((await handleSearchRequest(new Request(origin + '/saturn/?q=x', { method: 'POST' }), data(), fetcher)).status, 405);
});

test('an unreadable saved view renders the page as if it were absent', async () => {
  const fetcher: typeof fetch = async () => new Response(html, { headers: { 'content-type': 'text/html' } });
  const body = async (query: string) => {
    const response = await handleSearchRequest(new Request(`${origin}/.netlify/functions/search?object=saturn&${query}`), data(), fetcher);
    assert.equal(response.status, 200, query);
    assert.equal(response.headers.get('location'), null, query);
    return response.text();
  };
  // Not a redirect: Netlify appends the original query to a function redirect whose target has none (a loop on /).
  assert.equal(await body('v=681&q=saturn'), await body('q=saturn'));
  assert.equal(await body('v=not-a-view'), await body(''));
  // Two views are a malformed request, not an old link.
  assert.equal((await handleSearchRequest(new Request(`${origin}/saturn/?v=a&v=b`), data(), fetcher)).status, 400);
});

test('the bodies of one far system list by name, digits as numbers', () => {
  // Each body is a little nearer or farther by its place on its orbit.
  const system = ['TRAPPIST-1h', 'TRAPPIST-1 system', 'TRAPPIST-1b', 'TRAPPIST-10', 'TRAPPIST-1', 'TRAPPIST-1c'].map((name, index) => entry('bank', name, 'exoplanet', 3.85e17 + (5 - index) * 1e9));
  assert.deepEqual(findObjects(system, 'trappist').objects.rows.map(row => row.name),
    ['TRAPPIST-1', 'TRAPPIST-1 system', 'TRAPPIST-1b', 'TRAPPIST-1c', 'TRAPPIST-1h', 'TRAPPIST-10']);
});
