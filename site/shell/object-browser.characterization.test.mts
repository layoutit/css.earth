import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from '../browser/browser-types.mts';
import { createObjectBrowserController } from './object-browser.mts';
import type { FindResponse } from '../search/find-protocol.mts';

function mount(submitted = false, panels = false) {
  const { document, window } = parseHTML(`<html><body data-object-shell="earth">
    <aside class="object-sidebar"><form class="object-sidebar-search-card" ${submitted ? 'data-search-submitted' : ''}>
      <input class="object-sidebar-search"><input data-search-context name="dataset"><input data-dataset-context name="settings">
      <a class="object-sidebar-search-clear"></a><button class="object-search-category" data-search-query="Planets" data-search-classification="planet"></button>
      <button class="object-search-category" data-search-query="Unknown"></button></form></aside>
    <div class="object-drawer-content"><div class="object-selected-content"><section class="object-information-panel"></section>
      ${panels ? '<section class="object-destination-panel" hidden><button class="object-destination-back"></button><h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section>' : ''}</div>
      <section class="object-browser"><div id="object-category-results"><p data-search-empty hidden>Empty</p><p data-search-busy hidden>Busy</p>
      <div data-search-error hidden><button data-search-retry>Retry</button></div><ul data-catalogue-list></ul></div>
      ${panels ? '<details class="object-feature-results"><span class="object-panel-heading-count"></span><p class="object-destination-hint"></p><ul><li><a class="object-destination-result"><span class="object-destination-result-name"></span><span class="object-destination-result-context"></span></a></li></ul></details>' : ''}</section></div>
    <div class="object-stage" data-object-id="mars"></div><div class="object-input-surface"></div></body></html>`);
  const get = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const node = document.querySelector<T>(selector);
    assert.ok(node, selector);
    return node;
  };
  const input = get<HTMLInputElement>('.object-sidebar-search');
  const browser = get('.object-browser'), results = get('#object-category-results');
  let focused: Element | null = null;
  Object.defineProperty(document, 'activeElement', { get: () => focused });
  // linkedom supplies events and DOM, but does not implement focus or layout.
  const focusable = (element: HTMLElement) => {
    element.focus = () => { focused = element; };
    element.blur = () => { if (focused === element) focused = null; };
    element.getClientRects = () => ({ length: 1, item: () => null, [Symbol.iterator]: () => [][Symbol.iterator]() });
  };
  for (const element of document.querySelectorAll<HTMLElement>('input, button, a')) focusable(element);
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const requests: URL[] = [];
  let answer: FindResponse = { objects: { total: 0, offset: 0, rows: [] }, classification: null, features: [] }, failed = false;
  Object.assign(window, {
    location: { href: 'https://css.earth/earth/?dataset=albedo' },
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    async fetch(url: URL) { requests.push(new URL(url)); return { ok: !failed, status: failed ? 503 : 200, json: async () => answer }; },
  });
  const lifetime = createSceneLifetime();
  const categories: (string | null)[] = [], changes: [boolean, boolean][] = [], framed: string[] = [];
  let selected = { objectId: 'earth' }, illustrations = false;
  const controller = createObjectBrowserController(document, window as unknown as BrowserWindow, lifetime, {
    readSelection: () => selected, readObjectId: () => 'fallback', readIllustrationModels: () => illustrations,
    onCategoryChange: value => categories.push(value), onSearchChange: (open, browsing) => changes.push([open, browsing]),
    onFrameCategory: value => framed.push(value),
  });
  const event = (element: Element | Document, type: string, properties: Record<string, unknown> = {}) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    element.dispatchEvent(event);
    return event;
  };
  const settle = async () => {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); }
    await setImmediate();
  };
  return { document, window, get, input, browser, results, controller, lifetime, categories, changes, framed, requests, event, settle, focusable,
    setAnswer(value: FindResponse) { answer = value; }, select(id: string) { selected = { objectId: id }; },
    fail(value: boolean) { failed = value; },
    illustrate(value: boolean) { illustrations = value; } };
}

test('incomplete object browser rejects its shell', () => {
  const { document, window } = parseHTML('<html><body></body></html>');
  const lifetime = createSceneLifetime();
  assert.throws(() => createObjectBrowserController(document, window as unknown as BrowserWindow, lifetime,
    { readSelection: () => ({ objectId: 'earth' }), readObjectId: () => 'earth' }), /Object shell object browser is incomplete\./);
  lifetime.destroy();
});

test('typed searches normalize text, carry the current body, and close without losing the query', async () => {
  const f = mount();
  assert.equal(f.browser.hidden, true);
  assert.equal(f.document.documentElement.dataset.selection, 'object');
  f.input.value = ' MARS ';
  f.event(f.input, 'input');
  assert.deepEqual(f.changes, [[true, false]]);
  assert.equal(f.get<HTMLInputElement>('[name=dataset]').value, 'albedo');
  assert.equal(f.get<HTMLInputElement>('[name=dataset]').disabled, false);
  assert.equal(f.get<HTMLInputElement>('[name=settings]').disabled, true);
  assert.equal(f.results.ariaBusy, 'true');
  assert.equal(f.browser.querySelector<HTMLElement>('[data-search-empty]')?.hidden, true);
  await f.settle();
  assert.equal(f.requests.at(-1)?.searchParams.get('q'), 'mars');
  assert.equal(f.requests.at(-1)?.searchParams.get('object'), 'mars');
  assert.equal(f.get('[data-search-empty]').hidden, false);
  assert.equal(f.results.ariaBusy, 'false');
  f.controller.refreshSelection();
  await f.settle();
  assert.equal(f.requests.length, 1, 'unchanged search does not fetch again');
  f.results.scrollTop = 80;
  f.event(f.results, 'scroll');
  f.event(f.get('.object-input-surface'), 'wheel');
  assert.equal(f.results.scrollTop, 0);
  assert.equal(f.browser.hidden, true);
  assert.equal(f.input.value, ' MARS ');
  f.event(f.input, 'keydown', { key: 'Enter' });
  await f.settle();
  assert.equal(f.browser.hidden, false);
  assert.equal(f.requests.length, 2);
  f.input.value = 'm';
  f.event(f.input, 'input');
  assert.equal(f.browser.hidden, true);
  f.lifetime.destroy();
});

test('category pills publish browsing state and coalesce category notifications', async () => {
  const f = mount();
  const pill = f.get('.object-search-category');
  f.setAnswer({ objects: { total: 0, offset: 0, rows: [] }, classification: 'planet', features: [] });
  f.event(pill, 'click');
  assert.equal(f.input.value, 'Planets');
  assert.equal(pill.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(f.changes, [[true, true]]);
  assert.deepEqual(f.framed, ['planet']);
  await f.settle();
  assert.deepEqual(f.categories, ['planet']);
  // The browser property is reflected by native browsers; linkedom needs that bridge.
  Object.defineProperty(pill, 'ariaPressed', { get: () => pill.getAttribute('aria-pressed') });
  f.event(pill, 'click');
  await f.settle();
  assert.equal(f.input.value, '');
  assert.equal(f.browser.hidden, true);
  assert.deepEqual(f.categories, ['planet', null]);
  f.event(f.get('.object-search-category:not([data-search-classification])'), 'click');
  assert.equal(f.input.value, 'Unknown');
  assert.deepEqual(f.framed, ['planet']);
  f.event(pill, 'keydown', { key: 'x' });
  assert.equal(f.browser.hidden, false);
  f.event(pill, 'keydown', { key: 'Escape' });
  assert.equal(f.browser.hidden, true);
  assert.equal(f.document.activeElement === f.input, true);
  f.lifetime.destroy();
});

test('flight previews restore searches, ignore stale cancellation, and binding preserves newer queries', async () => {
  const f = mount();
  f.input.value = 'mars';
  f.event(f.get('.object-sidebar-search-card'), 'submit');
  await f.settle();
  const restore = f.controller.previewSelection({ objectId: 'mars' });
  assert.equal(f.controller.readSubject().objectId, 'mars');
  assert.equal(f.input.value, '');
  assert.equal(f.browser.hidden, true);
  restore();
  assert.equal(f.controller.readSubject().objectId, 'earth');
  assert.equal(f.input.value, 'mars');
  assert.equal(f.browser.hidden, false);
  await f.settle();
  const stale = f.controller.previewSelection({ objectId: 'venus' });
  const latest = f.controller.previewSelection({ objectId: 'mercury' });
  stale();
  assert.equal(f.controller.readSubject().objectId, 'mercury');
  latest();
  assert.equal(f.controller.readSubject().objectId, 'venus');
  f.select('mars-system');
  f.controller.refreshSelection();
  assert.equal(f.controller.readSubject().objectId, 'mars-system');
  assert.equal(f.document.documentElement.dataset.selection, 'satellite-system');
  f.input.value = 'venus';
  f.event(f.input, 'input');
  await f.settle();
  f.controller.bindObject('mars');
  assert.equal(f.input.value, 'venus');
  assert.equal(f.get('.object-sidebar-search-card').dataset.searchObject, 'mars');
  assert.equal(f.get('.object-sidebar-search-card').getAttribute('action'), '/mars/');
  assert.equal(f.get('.object-sidebar-search-clear').getAttribute('href'), '/mars/');
  await f.settle();
  f.controller.bindObject('not-a-body');
  assert.equal(f.get('.object-sidebar-search-card').getAttribute('action'), '/mars/');
  f.illustrate(true);
  f.controller.refreshIllustrations();
  await f.settle();
  assert.equal(f.requests.at(-1)?.searchParams.get('illustrations'), '1');
  f.controller.destroy();
  assert.equal(f.browser.hidden, true);
  assert.equal(f.browser.querySelector<HTMLElement>('[data-search-empty]')?.hidden, true);
  f.lifetime.destroy();
});

test('keyboard results skip hidden and disabled controls and return focus to the search', async () => {
  const f = mount();
  f.input.value = 'mars';
  f.event(f.input, 'input');
  await f.settle();
  const hidden = f.document.createElement('div');
  hidden.hidden = true;
  hidden.innerHTML = '<a class="object-link">Hidden</a>';
  const disabled = f.document.createElement('button');
  disabled.disabled = true;
  const anchor = f.document.createElement('a');
  anchor.className = 'object-link';
  const next = f.document.createElement('button');
  let clicks = 0;
  anchor.click = () => { clicks++; };
  f.focusable(anchor); f.focusable(next);
  f.browser.append(hidden, disabled, anchor, next);
  f.input.focus();
  assert.equal(f.event(f.input, 'keydown', { key: 'ArrowDown' }).defaultPrevented, true);
  // The error's retry button is hidden, so the first usable row is the anchor.
  assert.equal(f.document.activeElement === anchor, true);
  f.event(f.input, 'keydown', { key: 'Enter' });
  assert.equal(clicks, 1);
  f.event(anchor, 'keydown', { key: 'ArrowDown' });
  assert.equal(f.document.activeElement === next, true);
  let lastFocusCalls = 0;
  const focusLast = next.focus;
  next.focus = () => { lastFocusCalls++; focusLast(); };
  f.event(next, 'keydown', { key: 'ArrowDown' });
  assert.equal(f.document.activeElement === next, true);
  assert.equal(lastFocusCalls, 1, 'the clamped last control receives focus');
  f.event(next, 'keydown', { key: 'ArrowUp' });
  assert.equal(f.document.activeElement === anchor, true);
  f.event(anchor, 'keydown', { key: 'ArrowUp' });
  assert.equal(f.document.activeElement === f.input, true);
  f.event(anchor, 'keydown', { key: 'Escape' });
  assert.equal(f.browser.hidden, true);
  assert.equal(f.document.activeElement === f.input, true);
  f.lifetime.destroy();
});

test('clearing, blank submissions and scene presses close results; outside presses only blur', async () => {
  const f = mount(true);
  f.event(f.get('.object-sidebar-search-card'), 'submit');
  assert.equal(f.browser.hidden, true);
  f.input.value = 'earth';
  f.event(f.input, 'input');
  await f.settle();
  f.input.focus();
  f.event(f.get('.object-sidebar-search-card'), 'pointerdown');
  assert.equal(f.document.activeElement === f.input, true);
  f.event(f.document.body, 'pointerdown');
  assert.equal(f.document.activeElement === null, true);
  assert.equal(f.browser.hidden, false);
  f.event(f.get('.object-sidebar-search-clear'), 'click');
  assert.equal(f.input.value, '');
  assert.equal(f.browser.hidden, true);
  assert.equal(f.document.activeElement === f.input, true);
  f.input.value = 'mars';
  f.event(f.input, 'input');
  f.event(f.input, 'keydown', { key: 'Escape' });
  assert.equal(f.browser.hidden, true);
  f.event(f.input, 'keydown', { key: 'x' });
  f.input.value = 'venus';
  f.event(f.input, 'input');
  f.event(f.get('.object-input-surface'), 'pointerdown');
  assert.equal(f.input.value, 'venus');
  assert.equal(f.browser.hidden, true);
  f.controller.presentDestination(null);
  f.lifetime.destroy();
});

test('feature and destination selection close search and dispose their retained panels', async () => {
  const f = mount(false, true);
  const destination = f.get('.object-destination-panel');
  const feature = f.browser.querySelector<HTMLElement>('.object-destination-result')!;
  f.setAnswer({ objects: { total: 0, offset: 0, rows: [] }, classification: null,
    features: [{ objectId: 'mars', id: 'olympus', name: 'Olympus', context: 'Mars', label: 'Olympus on Mars', href: '/mars/?feature=olympus' }] });
  f.input.value = 'olympus';
  f.event(f.input, 'input');
  await f.settle();
  assert.equal(feature.textContent, 'OlympusMars');
  assert.equal(f.get('[data-search-empty]').hidden, true);
  f.input.focus();
  f.event(feature, 'click', { button: 0 });
  assert.equal(f.browser.hidden, true);
  assert.equal(f.document.activeElement === null, true);
  f.event(f.input, 'keydown', { key: 'Enter' });
  await f.settle();
  f.controller.presentDestination({ name: 'Lima', context: 'Earth', coverage: 'global', bodyName: 'Earth', status: 'Arrived.', flying: false });
  assert.equal(destination.hidden, false);
  assert.equal(destination.querySelector('.object-destination-name')?.textContent, 'Lima');
  assert.equal(f.browser.hidden, true);
  f.select('mars-system');
  f.controller.refreshSelection();
  assert.equal(destination.hidden, true);
  f.controller.bindObject('mars');
  f.controller.destroy();
  f.lifetime.destroy();
  assert.equal(destination.hidden, true);
});

test('body-id fallbacks, retries and an open blank query keep the current search state', async t => {
  const f = mount(false, true);
  t.mock.method(console, 'warn', () => {});
  f.get('.object-stage').remove();
  f.input.value = 'earth';
  f.event(f.input, 'input');
  await f.settle();
  assert.equal(f.requests.at(-1)?.searchParams.get('object'), 'earth');
  delete f.document.body.dataset.objectShell;
  f.fail(true);
  f.input.value = 'other';
  f.event(f.input, 'input');
  await f.settle();
  assert.equal(f.requests.at(-1)?.searchParams.get('object'), 'fallback');
  assert.equal(f.get('[data-search-error]').hidden, false);
  assert.equal(f.get('[data-search-empty]').hidden, true);
  f.fail(false);
  f.event(f.get('[data-search-retry]'), 'click');
  await f.settle();
  assert.equal(f.get('[data-search-error]').hidden, true);
  f.input.value = '';
  f.controller.refreshSelection();
  assert.equal(f.results.hidden, true);
  assert.equal(f.browser.hidden, false, 'refreshing selection with empty input keeps the already-open browser');
  f.lifetime.destroy();
});

test('catalogue arrow keys move between received rows while information-tab arrows are left alone', async () => {
  const f = mount();
  const rows = ['mars', 'earth'].map(id => ({ id, name: id, classificationName: 'planet', route: `/${id}/`,
    detail: { text: '1 au', value: '1', unit: 'au', title: 'Distance', ariaLabel: '1 au. Distance' },
    source: { subject: `object:${id}`, document: `/sources/${id}/`, label: `Sources ${id}` }, marker: { id, color: '#fff', preview: true as const } }));
  f.setAnswer({ objects: { total: 2, offset: 0, rows }, classification: null, features: [] });
  f.input.value = 'planets';
  f.event(f.input, 'input');
  await f.settle();
  const anchors = [...f.results.querySelectorAll<HTMLElement>('[data-catalogue-index] a')];
  assert.equal(anchors.length, 2);
  anchors.forEach(f.focusable);
  anchors[0]!.focus();
  assert.equal(f.event(anchors[0]!, 'keydown', { key: 'ArrowDown' }).defaultPrevented, true);
  assert.equal(f.document.activeElement === anchors[1], true);
  f.event(anchors[1]!, 'keydown', { key: 'ArrowUp' });
  assert.equal(f.document.activeElement === anchors[0], true);
  f.event(anchors[0]!, 'keydown', { key: 'ArrowUp' });
  assert.equal(f.document.activeElement === f.input, true);
  const tab = f.document.createElement('input');
  tab.setAttribute('data-information-tab', '');
  f.browser.append(tab);
  assert.equal(f.event(tab, 'keydown', { key: 'ArrowDown' }).defaultPrevented, false);
  f.lifetime.destroy();
});

test('suggestions open at exactly two characters and stay closed below the boundary', async () => {
  const f = mount();
  for (const [query, open] of [['m', false], ['ma', true]] as const) {
    f.input.value = query; f.event(f.input, 'input'); await f.settle();
    assert.equal(f.browser.hidden, !open);
  }
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0]?.searchParams.get('q'), 'ma');
  f.lifetime.destroy();
});


test('queued category notifications stop at lifetime disposal', async () => {
  const f = mount();
  f.event(f.get('.object-search-category'), 'click');
  assert.deepEqual(f.categories, []);
  f.lifetime.destroy();
  await f.settle();
  assert.deepEqual(f.categories, []);
});

test('binding an open browser without results preserves an unsubmitted replacement query', async () => {
  const f = mount(true);
  assert.equal(f.browser.hidden, false);
  assert.equal(f.results.hidden, true);
  f.input.value = 'venus';
  f.controller.bindObject('mars');
  await f.settle();
  assert.equal(f.input.value, 'venus');
  assert.equal(f.results.hidden, true);
  assert.deepEqual(f.requests, []);
  assert.deepEqual(f.changes, []);
  f.lifetime.destroy();
});
