import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createDestinationBrowser } from '../destination-browser.mts';
import { createFeatureBrowser } from '../feature-browser.mts';
import { selectSceneFeature } from '../scene/scene-feature.mts';
import type { SceneSession } from '../scene/scene-session.mts';
import type { NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import { handleFindRequest } from '../find.mts';

// Named features and cities are searched by the find function; the page sends its query and gets rows back, and never
// downloads the cross-body index (3.3 MB) or Earth's places catalogue (14.8 MB).
const catalog = JSON.stringify({ schema: 'cssearth-prepared-destinations@1', places: [
  { id: 3435910, name: 'Buenos Aires', names: ['buenos aires', 'capital federal'], context: 'Buenos Aires F.D., Argentina', searchContext: 'buenos aires argentina ar', coverage: 'overview', camera: { controlPitch: 1, controlYaw: 2, zoom: 3 } },
  { id: 1691490, name: 'Rosario', names: ['rosario'], context: 'Calabarzon, Philippines', searchContext: 'calabarzon philippines ph', coverage: 'overview', camera: { controlPitch: 1, controlYaw: 2, zoom: 3 } },
  { id: 3838583, name: 'Rosario', names: ['rosario', 'rosario de santa fe'], context: 'Santa Fe, Argentina', searchContext: 'santa fe argentina ar', coverage: 'overview', camera: { controlPitch: 1, controlYaw: 2, zoom: 3 } }] });
const index = JSON.stringify({ schema: 'cssearth-prepared-feature-index@2',
  objects: [{ id: 'earth', name: 'Earth', route: '/earth/', count: 1 }, { id: 'mars', name: 'Mars', route: '/mars/', count: 1 }],
  features: [
    { objectId: 'mars', id: '1', name: 'Buenos Crater', type: 'Crater', diameterKm: 12, searchNames: ['buenos crater'], searchContext: 'crater' },
    { objectId: 'earth', id: '2', name: 'Rosario', type: 'City', diameterKm: 0, searchNames: ['rosario'], searchContext: 'city' }],
  places: [{ objectId: 'earth', type: 'City', url: '/scenes/earth/earth-places.json', assetUrl: '/scenes/earth/earth-places.json', count: 3, duplicates: [['3838583', '2']] }] });
const pin = { url: '/features/index.json', count: 2 };
const files = async (input: string | URL | Request) => new Response(String(input).endsWith('earth-places.json') ? catalog : index);
const find = (query: string) => handleFindRequest(new Request(`https://site.test/.netlify/functions/find?${query}`), pin, files);

test('from Mars, a city is found by any of its names and links to Earth', async () => {
  const { results } = await (await find('object=mars&q=capital%20federal')).json();
  assert.deepEqual(results, [{ objectId: 'earth', id: 'city-3435910', name: 'Buenos Aires', context: 'City · Buenos Aires F.D., Argentina · Earth',
    label: 'Buenos Aires, Buenos Aires F.D., Argentina · Earth', href: '/earth/?feature=city-3435910' }]);
});

test('a place a named feature already carries is listed once, as the feature, found by the place\'s names too', async () => {
  const { results } = await (await find('object=earth&q=rosario')).json();
  assert.deepEqual(results.map((result: { id: string }) => result.id), ['2', 'city-1691490']);
  const { results: alternate } = await (await find('object=mars&q=rosario%20de%20santa%20fe')).json();
  assert.deepEqual(alternate.map((result: { id: string }) => result.id), ['2']);
});

test('a place is opened by its id; malformed requests are refused', async () => {
  const { place } = await (await find('object=earth&place=1691490')).json();
  assert.equal(place.name, 'Rosario');
  assert.equal((await find('object=earth&place=1')).status, 404);
  assert.equal((await find('object=earth&place=x1')).status, 400);
  assert.equal((await find('object=earth')).status, 400);
  assert.equal((await find('q=rosario')).status, 400);
});

test('keystrokes queued before a frame send one request, for the newest text', async context => {
  const { document, window } = parseHTML(`<body data-object-shell="mars"><section class="object-feature-results" hidden data-feature-index='${JSON.stringify(pin)}'>
    <p class="object-destination-hint"></p><ul class="object-destination-list">${'<li hidden><a class="object-destination-result"><span class="object-destination-result-name"></span><span class="object-destination-result-context"></span></a></li>'.repeat(3)}</ul></section></body>`);
  const frames: (() => void)[] = [];
  Object.assign(window, { requestAnimationFrame: (callback: () => void) => frames.push(callback) });
  const requests: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => { requests.push(new URL(String(input)).searchParams.get('q') ?? ''); return handleFindRequest(new Request(String(input)), pin, files); });
  const browser = createFeatureBrowser({ documentTarget: document, objectId: 'mars', onSelected() {}, onResults() {} })!;
  const searches = ['b', 'bu', 'buenos'].map(value => browser.search(value));
  await new Promise(resolve => setTimeout(resolve, 0));
  for (const frame of frames.splice(0)) frame();
  await Promise.all(searches);
  assert.deepEqual(requests, ['buenos']);
  const shown = [...document.querySelectorAll('li')].filter(row => !row.hidden).map(row => row.querySelector('.object-destination-result-name')?.textContent);
  assert.deepEqual(shown, ['Buenos Crater', 'Buenos Aires']);
});

test('feature rows leave selection to the ordinary navigation link handler', async context => {
  const { document, window } = parseHTML(`<body data-object-shell="mars"><section class="object-feature-results" hidden data-feature-index='${JSON.stringify(pin)}'>
    <p class="object-destination-hint"></p><ul><li hidden><a class="object-destination-result"><span class="object-destination-result-name"></span><span class="object-destination-result-context"></span></a></li></ul></section></body>`);
  const frames: (() => void)[] = [];
  Object.assign(window, { requestAnimationFrame: (callback: () => void) => frames.push(callback) });
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => handleFindRequest(new Request(String(input)), pin, files));
  const selected: string[] = [];
  const browser = createFeatureBrowser({ documentTarget: document, objectId: 'mars', onSelected(result) { selected.push(result.id); }, onResults() {} })!;
  const searching = browser.search('buenos');
  await new Promise(resolve => setTimeout(resolve, 0));
  for (const frame of frames.splice(0)) frame();
  await searching;
  const button = document.querySelector<HTMLAnchorElement>('.object-destination-result')!;
  const click = new window.Event('click', { bubbles: true, cancelable: true });
  Object.defineProperty(click, 'button', { value: 0 });
  button.dispatchEvent(click);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(selected, ['1']);
  assert.equal(click.defaultPrevented, false);
  assert.equal(button.getAttribute('href'), '/mars/?feature=1');
});

test('a city opens from its id with one small request, and the Back label names the bound body', async context => {
  const { document } = parseHTML(`<body><section class="object-destination-panel" hidden><button class="object-destination-back">← Back to Mars</button>
    <h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section></body>`);
  const requested: string[] = [];
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => { requested.push(new URL(String(input)).search); return handleFindRequest(new Request(String(input)), pin, files); });
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
  context.mock.method(globalThis, 'fetch', async (input: string | URL) => handleFindRequest(new Request(String(input)), pin, files));
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
