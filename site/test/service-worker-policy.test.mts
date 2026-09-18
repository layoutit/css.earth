import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { evictionPlan, offlinePageFallback, parseIndex, parseStoreMessage, responseValidator, STORE_MESSAGE, routeRequest, runtimeBudget, RUNTIME_BUDGET_BYTES } from '../service-worker/policy.mts';

const scope = 'https://css.earth/';
const route = (url: string, method = 'GET') => routeRequest({ url, method, scope }).kind;

test('hashed bundles, prepared transports and city pages are served from the cache first', () => {
  assert.equal(route('https://css.earth/_astro/scene-router.B7x2Qf.js'), 'immutable');
  assert.equal(route(`https://css.earth/objects/moon/${'a'.repeat(64)}.json`), 'immutable');
  assert.equal(route(`https://css.earth/scenes/earth/city-page-${'0'.repeat(16)}.webp`), 'immutable');
});

test('named scene files and pages go to the network first and are kept for offline use', () => {
  assert.equal(route('https://css.earth/scenes/moon/moon-crust@2x.webp'), 'network-first');
  assert.equal(route('https://css.earth/moon/'), 'network-first');
  assert.equal(route('https://css.earth/navigation/moon/'), 'network-first');
  assert.equal(route(`https://css.earth/objects/moon/${'a'.repeat(64)}.json?fresh=1`), 'network-first');
});

test('search answers, other origins, writes and function calls are not kept', () => {
  assert.equal(route('https://css.earth/moon/?q=tycho'), 'network-only');
  assert.equal(route('https://css.earth/?dataset=clouds'), 'network-only');
  assert.equal(route('https://www.googletagmanager.com/gtag/js?id=G'), 'bypass');
  assert.equal(route('https://css.earth/moon/', 'POST'), 'bypass');
  assert.equal(route('https://css.earth/.netlify/functions/search?object=moon'), 'bypass');
  // Only page routes go to search; the same names elsewhere are ordinary queries.
  assert.equal(route('https://css.earth/_astro/chunk.js?v=4a1b'), 'network-first');
  assert.equal(route('https://css.earth/sw.js'), 'bypass');
});

test('an offline page with view parameters falls back to the plain page', () => {
  assert.equal(offlinePageFallback('https://css.earth/moon/?q=tycho'), 'https://css.earth/moon/');
  assert.equal(offlinePageFallback('https://css.earth/moon/'), null);
});

test('eviction removes the least recently used responses until the rest fit', () => {
  const entries = [
    { url: 'a', bytes: 40, used: 3 },
    { url: 'b', bytes: 40, used: 1 },
    { url: 'c', bytes: 40, used: 2 },
  ];
  assert.deepEqual(evictionPlan(entries, 120), []);
  assert.deepEqual(evictionPlan(entries, 80), ['b']);
  assert.deepEqual(evictionPlan(entries, 10), ['b', 'c', 'a']);
});

test('stored bytes are identified by entity tag, else by modification time and length', () => {
  assert.equal(responseValidator(new Headers({ etag: 'W/"1-2"', 'last-modified': 'x', 'content-length': '1' })), 'etag:W/"1-2"');
  assert.equal(responseValidator(new Headers({ 'last-modified': 'Fri', 'content-length': '9' })), 'modified:Fri:9');
  assert.equal(responseValidator(new Headers({ 'last-modified': 'Fri' })), undefined);
});

test('the worker only accepts a list of URLs from the page', () => {
  assert.deepEqual(parseStoreMessage({ type: STORE_MESSAGE, urls: ['https://css.earth/moon/'] }), ['https://css.earth/moon/']);
  assert.equal(parseStoreMessage({ type: STORE_MESSAGE, urls: ['a', 1] }), null);
  assert.equal(parseStoreMessage({ type: 'other', urls: [] }), null);
  assert.equal(parseStoreMessage('store'), null);
});

test('the budget never exceeds half the storage quota', () => {
  assert.equal(runtimeBudget(undefined), RUNTIME_BUDGET_BYTES);
  assert.equal(runtimeBudget(200), 100);
  assert.equal(runtimeBudget(Number.MAX_SAFE_INTEGER), RUNTIME_BUDGET_BYTES);
});

test('a damaged index is discarded entry by entry', () => {
  assert.deepEqual(parseIndex({}), []);
  assert.deepEqual(parseIndex([{ url: 'a', bytes: 1, used: 2 }, { url: 1 }, { url: 'b', bytes: -1, used: 0 }]), [{ url: 'a', bytes: 1, used: 2 }]);
});

test('the manifest names icons that exist and the layout links it', async () => {
  const manifest: unknown = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.ok(typeof manifest === 'object' && manifest !== null && 'icons' in manifest && Array.isArray(manifest.icons));
  const purposes = new Set<string>();
  for (const icon of manifest.icons as unknown[]) {
    assert.ok(typeof icon === 'object' && icon !== null && 'src' in icon && typeof icon.src === 'string' && 'purpose' in icon && typeof icon.purpose === 'string');
    await readFile(`public${icon.src}`);
    purposes.add(icon.purpose);
  }
  assert.deepEqual([...purposes].sort(), ['any', 'maskable']);
  const layout = await readFile('site/layouts/PlanetLayout.astro', 'utf8');
  assert.match(layout, /rel="manifest" href="\/manifest\.webmanifest"/u);
  assert.match(layout, /rel="apple-touch-icon" href="\/app-icons\/apple-touch-icon\.png"/u);
});
