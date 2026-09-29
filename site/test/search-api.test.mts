import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from '../browser/browser-types.mts';
import type { CatalogueIndexEntry } from '../search/catalogue-index.mts';
import { createDestinationBrowser } from '../destination-browser.mts';
import { createFeatureBrowser } from '../feature-browser.mts';
import { selectSceneFeature } from '../scene/scene-feature.mts';
import type { SceneSession } from '../scene/scene-session.mts';
import type { NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import { handleFindRequest } from '../server/find.mts';
import type { SearchData } from '../server/search-data.mts';
import { FIND_PAGE_ROWS, parseFindResponse } from '../search/find-protocol.mts';
import { createSearchClient, type SearchOutcome } from '../search/search-client.mts';

// Objects, named features and cities are searched by the find function; the page sends its query and gets rows back,
// and never downloads the object catalogue (2.3 MB), the cross-body index (3.3 MB) or Earth's places catalogue (14.8 MB).
const catalog = { schema: 'cssearth-prepared-destinations@1', places: [
  { id: 3435910, name: 'Buenos Aires', names: ['buenos aires', 'capital federal'], context: 'Buenos Aires F.D., Argentina', searchContext: 'buenos aires argentina ar', coverage: 'overview', camera: { controlPitch: 1, controlYaw: 2, zoom: 3 } },
  { id: 1691490, name: 'Rosario', names: ['rosario'], context: 'Calabarzon, Philippines', searchContext: 'calabarzon philippines ph', coverage: 'overview', camera: { controlPitch: 1, controlYaw: 2, zoom: 3 } },
  { id: 3838583, name: 'Rosario', names: ['rosario', 'rosario de santa fe'], context: 'Santa Fe, Argentina', searchContext: 'santa fe argentina ar', coverage: 'overview', camera: { controlPitch: 1, controlYaw: 2, zoom: 3 } }] };
const index = { schema: 'cssearth-prepared-feature-index@2',
  objects: [{ id: 'earth', name: 'Earth', route: '/earth/', count: 1 }, { id: 'mars', name: 'Mars', route: '/mars/', count: 1 }],
  features: [
    { objectId: 'mars', id: '1', name: 'Buenos Crater', type: 'Crater', diameterKm: 12, searchNames: ['buenos crater'], searchContext: 'crater' },
    { objectId: 'earth', id: '2', name: 'Rosario', type: 'City', diameterKm: 0, searchNames: ['rosario'], searchContext: 'city' }],
  places: [{ objectId: 'earth', type: 'City', url: '/scenes/earth/earth-places.json', assetUrl: 'https://assets.test/earth-places.json', count: 3, duplicates: [['3838583', '2']] }] };
const pin = { url: '/features/index.json', count: 2 };
const entry = (id: string, name: string, classification: string, distanceMeters: number, searchNames: string[] = []): CatalogueIndexEntry => ({
  kind: 'scene', id, name, searchNames, classification, classificationName: classification === 'satellite' ? 'moon' : classification, systemName: 'solar system',
  route: `/${id}/`, illustration: false, distanceMeters,
  detail: { text: `${distanceMeters} au`, value: String(distanceMeters), unit: 'au', title: 'Observer distance', ariaLabel: `${distanceMeters} au. Observer distance` },
  source: { subject: `object:${id}`, document: `/sources/${id}/`, label: `Sources for ${name}` }, marker: { kind: 'scene', id: 'earth', color: '#fff' } });
// Ninety asteroids fill three pages; Europa the moon and 52 Europa the asteroid share a name.
const entries = [entry('europa', 'Europa', 'satellite', 5.2), entry('earth', 'Earth', 'planet', 1), entry('mars', 'Mars', 'planet', 1.5),
  ...Array.from({ length: 90 }, (_, n) => entry(`asteroid-${n}`, n === 0 ? '52 Europa' : `Asteroid ${n}`, 'asteroid', 2 + n / 100))];
const reads: string[] = [];
const data: SearchData = { pin, catalogue: async () => entries,
  read: async path => { reads.push(path); if (path === pin.url) return index; if (path === '/scenes/earth/earth-places.json') return catalog; throw new Error(`${path} is not prepared.`); } };
const find = async (query: string, search = data) => handleFindRequest(new Request(`https://site.test/.netlify/functions/find?${query}`), search);
const answer = async (query: string) => parseFindResponse(await (await find(query)).json());

test('from Mars, a city is found by any of its names and links to Earth, read from the prepared files beside the function', async () => {
  reads.length = 0;
  const { features } = await answer('object=mars&q=capital%20federal');
  assert.deepEqual(features, [{ objectId: 'earth', id: 'city-3435910', name: 'Buenos Aires', context: 'City · Buenos Aires F.D., Argentina · Earth',
    label: 'Buenos Aires, Buenos Aires F.D., Argentina · Earth', href: '/earth/?feature=city-3435910' }]);
  assert.deepEqual(reads, ['/features/index.json', '/scenes/earth/earth-places.json'], 'places are read by their site path, never from the asset bucket');
});

test('a place a named feature already carries is listed once, as the feature, found by the place\'s names too', async () => {
  assert.deepEqual((await answer('object=earth&q=rosario')).features?.map(result => result.id), ['2', 'city-1691490']);
  assert.deepEqual((await answer('object=mars&q=rosario%20de%20santa%20fe')).features?.map(result => result.id), ['2']);
});

test('one answer carries a page of objects, their total and the feature rows; later pages carry objects only', async () => {
  const europa = await answer('object=earth&q=europa');
  assert.deepEqual(europa.objects.rows.map(row => row.name), ['Europa', '52 Europa']);
  assert.equal(europa.objects.total, 2);
  assert.equal(europa.classification, null);
  assert.deepEqual(europa.features, []);
  assert.equal('searchNames' in europa.objects.rows[0]!, false, 'search fields stay on the server');

  const asteroids = await answer('object=earth&q=asteroids');
  assert.equal(asteroids.classification, 'asteroid');
  assert.equal(asteroids.objects.total, 90);
  assert.equal(asteroids.objects.rows.length, FIND_PAGE_ROWS);
  assert.deepEqual(asteroids.features, [], 'a category runs no feature search');
  const last = await answer(`object=earth&q=asteroids&offset=${2 * FIND_PAGE_ROWS}`);
  assert.deepEqual([last.objects.offset, last.objects.rows.length, last.objects.rows[0]?.name], [80, 10, 'Asteroid 80']);

  const planets = await answer('object=earth&q=r');
  assert.deepEqual(planets.objects.rows.slice(0, 2).map(row => row.name), ['Earth', 'Mars'], 'planets come first, then distance');
});

test('objects still answer when the feature data cannot load', async context => {
  context.mock.method(console, 'error', () => {});
  const broken: SearchData = { ...data, read: async () => { throw new Error('missing'); } };
  const result = parseFindResponse(await (await find('object=earth&q=europa', broken)).json());
  assert.equal(result.objects.total, 2);
  assert.equal(result.features, null);
});

test('a place is opened by its id; malformed requests are refused', async () => {
  const { place } = await (await find('object=earth&place=1691490')).json();
  assert.equal(place.name, 'Rosario');
  assert.equal((await find('object=earth&place=1')).status, 404);
  assert.equal((await find('object=earth&place=x1')).status, 400);
  assert.equal((await find('object=earth')).status, 400);
  assert.equal((await find('q=rosario')).status, 400);
  assert.equal((await find('object=earth&q=a&offset=-1')).status, 400);
});

function searchFixture() {
  const { document, window } = parseHTML(`<body data-object-shell="mars"><div id="results"><ul data-catalogue-list></ul>
    <p data-search-error hidden><button data-search-retry>Retry</button></p></div></body>`);
  const frames: (() => void)[] = [];
  Object.assign(window, { requestAnimationFrame: (callback: () => void) => frames.push(callback), cancelAnimationFrame() {} });
  const requests: string[] = [];
  Object.assign(window, { fetch: async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(`${url.searchParams.get('q')}@${url.searchParams.get('offset') ?? 0}`);
    return find(url.search.slice(1));
  } });
  const outcomes: (SearchOutcome | null)[] = [];
  const resultsPanel = document.querySelector<HTMLElement>('#results')!;
  const client = createSearchClient({ documentTarget: document, windowTarget: window as unknown as BrowserWindow, resultsPanel,
    lifetime: createSceneLifetime(), readObjectId: () => 'mars', onResults: outcome => outcomes.push(outcome) });
  const settle = async () => { for (let i = 0; i < 5; i++) { await new Promise(resolve => setTimeout(resolve, 0)); for (const frame of frames.splice(0)) frame(); } };
  const names = () => [...document.querySelectorAll('[data-catalogue-list] .object-name')].map(node => node.textContent);
  return { document, client, requests, outcomes, settle, names, resultsPanel };
}

test('keystrokes queued before a frame send one request, and its answer shows objects and features together', async () => {
  const { client, requests, outcomes, settle, names, resultsPanel } = searchFixture();
  for (const value of ['e', 'eu', 'europa']) void client.search(value, false);
  assert.equal(resultsPanel.ariaBusy, 'true');
  await settle();
  assert.deepEqual(requests, ['europa@0']);
  assert.deepEqual(names(), ['Europa', '52 Europa']);
  assert.deepEqual(outcomes, [{ objects: 2, classification: null, features: [] }]);
  assert.equal(resultsPanel.ariaBusy, 'false');
  assert.equal(client.sources.get('object:europa')?.dataset.sourceDocument, '/sources/europa/', 'a received row brings its source link');

  // The next search keeps these rows on screen until its own answer replaces them.
  void client.search('mars', false);
  assert.deepEqual(names(), ['Europa', '52 Europa']);
  await settle();
  assert.deepEqual(names(), ['Mars']);
  client.clear();
  assert.deepEqual(names(), []);
});

test('a newer search cancels the older request, whose late answer never replaces the newer one', async () => {
  const { document, client, settle, names, resultsPanel } = searchFixture();
  const held = new Map<string, () => void>();
  const window = document.defaultView as unknown as { fetch: (input: string | URL, init?: RequestInit) => Promise<Response> };
  const answerNow = window.fetch;
  const cancelled: string[] = [];
  window.fetch = (input, init?: RequestInit) => new Promise(resolve => {
    const query = new URL(String(input)).searchParams.get('q')!;
    init?.signal?.addEventListener('abort', () => cancelled.push(query));
    held.set(query, () => resolve(answerNow(input)));
  });
  void client.search('mars', false);
  await settle();
  void client.search('europa', false);
  await settle();
  assert.deepEqual(cancelled, ['mars']);
  held.get('europa')!();
  await settle();
  assert.deepEqual(names(), ['Europa', '52 Europa']);
  assert.equal(resultsPanel.ariaBusy, 'false');
  held.get('mars')!();
  await settle();
  assert.deepEqual(names(), ['Europa', '52 Europa']);
});

test('scrolling to rows not received yet asks for the page that holds them, once', async () => {
  const { document, client, requests, settle } = searchFixture();
  void client.search('asteroids', false);
  await settle();
  const scroll = document.querySelector<HTMLElement>('#results')!;
  scroll.scrollTop = 45 * 56;
  scroll.dispatchEvent(new (document.defaultView as unknown as typeof globalThis).Event('scroll'));
  scroll.dispatchEvent(new (document.defaultView as unknown as typeof globalThis).Event('scroll'));
  await settle();
  assert.deepEqual(requests, ['asteroids@0', 'asteroids@40']);
  assert.equal(document.querySelector('[data-catalogue-index="45"] .object-name')?.textContent, 'Asteroid 45');
});

test('a failed search shows its retry line, and retrying asks again', async context => {
  const { document, client, outcomes, settle } = searchFixture();
  context.mock.method(console, 'warn', () => {});
  const window = document.defaultView as unknown as { fetch: unknown };
  const working = window.fetch;
  window.fetch = async () => new Response('', { status: 502 });
  void client.search('europa', false);
  await settle();
  const error = document.querySelector<HTMLElement>('[data-search-error]')!;
  assert.equal(error.hidden, false);
  assert.deepEqual(outcomes, [null]);
  window.fetch = working;
  document.querySelector<HTMLButtonElement>('[data-search-retry]')!.click();
  await settle();
  assert.equal(error.hidden, true);
  assert.equal((outcomes.at(-1) as SearchOutcome | null)?.objects, 2);
});

test('feature rows leave selection to the ordinary navigation link handler', async () => {
  const { document, window } = parseHTML(`<body><details class="object-feature-results" hidden>
    <p class="object-destination-hint"></p><ul><li hidden><a class="object-destination-result"><span class="object-destination-result-name"></span><span class="object-destination-result-context"></span></a></li></ul></details></body>`);
  const selected: string[] = [];
  const browser = createFeatureBrowser({ documentTarget: document, onSelected(result) { selected.push(result.id); } })!;
  assert.equal(browser.present('buenos', (await answer('object=mars&q=buenos')).features), 1);
  const button = document.querySelector<HTMLAnchorElement>('.object-destination-result')!;
  const click = new window.Event('click', { bubbles: true, cancelable: true });
  Object.defineProperty(click, 'button', { value: 0 });
  button.dispatchEvent(click);
  assert.deepEqual(selected, ['1']);
  assert.equal(click.defaultPrevented, false);
  assert.equal(button.getAttribute('href'), '/mars/?feature=1');
  browser.present('buenos x', null);
  assert.equal(document.querySelector('.object-destination-hint')?.textContent, 'Feature names could not load. Change your search to retry.');
});

test('a city opens from its id with one small request, and the Back label names the bound body', async context => {
  const { document } = parseHTML(`<body><section class="object-destination-panel" hidden><button class="object-destination-back">← Back to Mars</button>
    <h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section></body>`);
  const requested: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => { requested.push(new URL(String(input)).search); return handleFindRequest(new Request(String(input)), data); });
  const browser = createDestinationBrowser({ documentTarget: document, onSelected() {}, onReset() {} })!;
  const selected: unknown[] = [];
  const { session, request } = cityFixture(browser, place => { selected.push(place); return Promise.resolve({ completed: true }); });
  await selectSceneFeature(session, request, 'Earth');
  assert.deepEqual(requested, ['?object=earth&place=1691490']);
  assert.equal((selected[0] as { name: string }).name, 'Rosario');
  assert.equal(document.querySelector('.object-destination-name')?.textContent, 'Rosario');
  assert.equal(document.querySelector('.object-destination-back')?.textContent, '← Back to Earth');
  assert.equal(document.querySelector<HTMLElement>('.object-destination-panel')?.hidden, false);
});

test('a rejected city arrival clears busy state and offers a retry', async context => {
  const { document } = parseHTML(`<body><section class="object-destination-panel" hidden><button class="object-destination-back"></button>
    <h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section></body>`);
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => handleFindRequest(new Request(String(input)), data));
  let rejectArrival!: (error: Error) => void;
  const arrival = new Promise<{ completed: boolean }>((_, reject) => { rejectArrival = reject; });
  const browser = createDestinationBrowser({ documentTarget: document, onSelected() {}, onReset() {} })!;
  const { session, request } = cityFixture(browser, () => arrival);
  const selection = selectSceneFeature(session, request, 'Earth');
  const rejected = assert.rejects(selection, /flight failed/);
  await new Promise(resolve => setTimeout(resolve, 0));
  const panel = document.querySelector<HTMLElement>('.object-destination-panel')!;
  assert.equal(panel.ariaBusy, 'true');
  rejectArrival(new Error('flight failed'));
  await rejected;
  assert.equal(panel.ariaBusy, 'false');
  assert.match(document.querySelector('.object-destination-status')?.textContent ?? '', /Flight failed.*retry/);
});

function cityFixture(browser: NonNullable<ReturnType<typeof createDestinationBrowser>>, fly: (place: unknown) => Promise<{ completed: boolean }>) {
  const signal = new AbortController().signal;
  const session = { objectId: 'earth', signal, shell: { presentDestination: browser.present }, mount: {
    datasets: { ids: ['normal'], defaultId: 'normal', current: () => 'normal', select: async () => true },
    destinations: { lensId: 'normal', select: async (place: unknown) => ({ status: 'Earth overview at this location.', arrival: fly(place) }) },
  } } as unknown as SceneSession;
  const request = { feature: 'city-1691490', url: 'https://site.test/earth/?feature=city-1691490', signal } as NavigationRequest;
  return { session, request };
}
