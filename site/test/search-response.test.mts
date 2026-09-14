import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { handleSearchRequest, renderSearchResponse, parseSearchPin } from '../search-response.mts';
import { objectSearchLabels, searchObjects } from '../object-search.mts';
import { matchesObjectCategory } from '../object-categories.mts';
import searchRoute from '../../netlify/edge-functions/search-route.ts';

const origin = 'https://preview.example.test';
const index = JSON.stringify({ schema: 'cssearth-prepared-feature-index@1',
  objects: [{ id: 'moon', name: 'Moon', route: '/moon/', count: 1 }],
  features: [{ objectId: 'moon', id: 'tycho', name: 'Tycho', type: 'Crater', diameterKm: 85,
    searchNames: ['tycho'], searchContext: 'crater' }] });
const pin = { url: '/features/index.json', bytes: Buffer.byteLength(index), sha256: createHash('sha256').update(index).digest('hex'), count: 1 };
const row = (name: string, classification: string, aliases: string[] = []) => `<li class="planet-object-item" data-object-name="${name.toLowerCase()}"
  data-object-classification="${classification}" data-object-classification-name="${classification}" data-object-system-name="solar system"
  data-object-distance-au="1" data-object-search-names='${JSON.stringify(aliases)}'><a href="/${name.toLowerCase()}/">${name}</a></li>`;
const html = `<!doctype html><html><head><style>u { color: red }</style></head><body data-object-shell="saturn"><!--search-shell:start-->
  <form class="planet-sidebar-search-card" data-search-object="saturn"><input class="planet-sidebar-search" name="q">
    <input type="hidden" name="v" data-search-context disabled></form><input class="planet-sheet-handle" type="checkbox">
  <nav class="planet-object-browser" hidden>
    <div data-galactic-overview hidden>Milky Way</div><div data-solar-system-results><section class="planet-selected-panel"></section></div>
    ${['all', 'planet', 'satellite', 'nebula'].map(category => `<button data-object-tab="${category}"><span class="planet-object-tab-count"></span></button>`).join('')}
    <div id="object-category-results"><ul><li class="planet-object-chunk"><ul class="planet-object-chunk-list">
    ${row('Saturn', 'planet')}${row('Titan', 'satellite')}${row('M42', 'nebula', ['orion nebula', 'm42'])}
    </ul></li></ul></div><p class="planet-object-empty" hidden>No matching objects</p>
    <section class="planet-feature-results" data-feature-index='${JSON.stringify(pin)}' hidden><p class="planet-destination-hint"></p>
      <ul><li hidden><a class="planet-destination-result"><span class="planet-destination-result-name"></span><span class="planet-destination-result-context"></span></a></li></ul></section>
  </nav><section class="planet-information-panel">Saturn</section><!--search-shell:end-->
  <main class="planet-stage"><u style='color: red;' data-prepared-node="0"></u></main><script type="module" src="/app.js"></script></body></html>`;
const fetchIndex: typeof fetch = async input => {
  assert.equal(String(input), `${origin}/features/index.json`);
  return new Response(index);
};
const visibleNames = (document: Document) => [...document.querySelectorAll('.planet-object-item:not([hidden]) a')].map(element => element.textContent);

test('native search uses shared matching, retains every row, and preserves the scene/head bytes', async () => {
  for (const [query, names] of [['saturn', ['Saturn']], ['orion', ['M42']], ['planets', ['Saturn']], ['unknown', []]] as const) {
    const response = await renderSearchResponse(html, new URL(`/?q=${query}`, origin), fetchIndex);
    const { document } = parseHTML(response);
    assert.deepEqual(visibleNames(document), names);
    assert.equal(document.querySelectorAll('.planet-object-item').length, 3);
    assert.equal(document.querySelector<HTMLElement>('.planet-information-panel')?.hidden, true);
    assert.equal(document.querySelector<HTMLElement>('.planet-object-browser')?.hidden, false);
    assert.equal(response.slice(0, response.indexOf('<!--search-shell:start-->')), html.slice(0, html.indexOf('<!--search-shell:start-->')));
    assert.equal(response.slice(response.indexOf('<!--search-shell:end-->')), html.slice(html.indexOf('<!--search-shell:end-->')));
    const items = [...document.querySelectorAll<HTMLElement>('.planet-object-item')].map(objectSearchLabels);
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
  assert.equal(document.querySelector('.planet-destination-result')?.getAttribute('href'), '/moon/?feature=tycho');
  assert.equal(document.querySelector('.planet-destination-result-name')?.textContent, 'Tycho');
  assert.equal(document.querySelector<HTMLElement>('.planet-object-empty')?.hidden, true);
  const corrupt: typeof fetch = async () => new Response(index.replace('Tycho', 'Tych0'));
  const failure = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=tycho', origin), corrupt)).document;
  assert.match(failure.querySelector('.planet-destination-hint')?.textContent ?? '', /could not load/);
  assert.equal(failure.querySelector('.planet-destination-result')?.hasAttribute('href'), false);
});

test('the Milky Way query uses the existing overview card without loading a feature index', async () => {
  const neverFetch: typeof fetch = async () => { throw new Error('Unexpected index request'); };
  const document = parseHTML(await renderSearchResponse(html, new URL('/saturn/?q=Milky+Way', origin), neverFetch)).document;
  assert.equal(document.querySelector<HTMLElement>('[data-galactic-overview]')?.hidden, false);
  assert.equal(document.querySelector<HTMLElement>('[data-solar-system-results]')?.hidden, true);
  assert.equal(document.querySelector('.planet-object-browser')?.getAttribute('aria-label'), 'Milky Way');
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
  const result = searchRoute(new Request(`${origin}/saturn/?q=titan&category=satellite&v=view&overview=solar-system`));
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
