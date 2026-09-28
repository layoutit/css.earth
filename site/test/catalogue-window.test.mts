import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import type { BrowserWindow } from '../browser/browser-types.mts';
import type { CatalogueRow } from '../catalogue/catalogue-index.mts';
import { createCatalogueWindow } from '../catalogue/catalogue-window.mts';

const entry = (index: number): CatalogueRow => ({
  kind: 'scene', id: `earth-${index}`, name: `Earth ${index}`,
  classificationName: 'planet', route: `/earth-${index}/`, detail: { text: `${index} au`, value: String(index), unit: 'au', title: 'Distance', ariaLabel: `${index} au. Distance` },
  source: { subject: `object:earth-${index}`, document: `/sources/${index}/`, label: `Sources ${index}` },
  marker: { kind: 'scene', id: 'earth', color: '#fff' },
});

test('catalogue window bounds connected rows, reuses them while scrolling, and clears on close', () => {
  const { document, window } = parseHTML('<div id="scroll"><ul id="list"></ul></div>');
  const scroll = document.querySelector<HTMLElement>('#scroll')!;
  const list = document.querySelector<HTMLUListElement>('#list')!;
  Object.defineProperty(scroll, 'clientHeight', { value: 420 });
  Object.defineProperty(list, 'offsetTop', { value: 0 });
  const frames: FrameRequestCallback[] = [];
  Object.assign(window, {
    requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
  });
  const catalogue = createCatalogueWindow({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    list, scrollTarget: scroll });
  catalogue.setRows(100, 0, Array.from({ length: 100 }, (_, index) => entry(index)));
  // 56 px rows (48 px and an 8 px gap): 100 rows less the trailing gap; a 420 px scrollport shows 8, plus 6 above and below.
  assert.equal(list.style.height, '5592px');
  assert.equal(list.querySelectorAll('.object-item').length, 20);
  assert.equal(list.querySelector<HTMLElement>('[data-catalogue-index="0"] .object-name')?.textContent, 'Earth 0');
  assert.equal(list.querySelector('[data-catalogue-index="0"]')?.getAttribute('aria-setsize'), '100');

  scroll.scrollTop = 2800;
  scroll.dispatchEvent(new window.Event('scroll'));
  frames.shift()?.(0);
  const state = catalogue.inspect();
  assert.equal(state.entries, 100);
  assert.ok(state.connectedRows <= 28);
  assert.ok(list.querySelector('[data-catalogue-index="44"]'));
  assert.equal(list.querySelector('[data-catalogue-index="0"]'), null);

  assert.equal(catalogue.focus(70), true);
  assert.ok(list.querySelector('[data-catalogue-index="70"]'));
  assert.ok(scroll.scrollTop > 1400);
  assert.ok(catalogue.inspect().connectedRows <= 28);
  assert.equal(catalogue.focus(100), false);

  scroll.scrollTop = 0;
  catalogue.setRows(2, 0, [entry(90), { ...entry(91), name: 'Earth 90' }]);
  assert.equal(list.querySelector<HTMLElement>('[data-catalogue-index="0"] .object-name')?.textContent, 'Earth 90');
  assert.equal(list.querySelectorAll('.object-item').length, 2);

  catalogue.setSelection({ kind: 'scene', id: 'earth-91' });
  assert.equal(list.querySelector('[data-catalogue-index="1"] a')?.getAttribute('aria-current'), 'page');
  assert.equal(list.querySelector('[data-catalogue-index="1"]')?.getAttribute('aria-setsize'), '2', 'marking the selection keeps the list size');
  assert.equal(list.querySelector('[data-catalogue-index="0"] a')?.getAttribute('aria-current'), null,
    'objects with the same display name must not share selection');
  const focus: CatalogueRow = { ...entry(91), kind: 'prepared-focus', id: 'm42', route: '/sun/?focus=m42',
    source: { subject: 'focus:m42', document: '/sources/m42/', label: 'Sources M42' },
    marker: { kind: 'focus', thumbnail: null } };
  catalogue.setRows(2, 0, [entry(91), focus]);
  catalogue.setSelection({ kind: 'prepared-focus', id: 'm42' });
  assert.equal(list.querySelector('[data-catalogue-index="0"] a')?.getAttribute('aria-current'), null,
    'a prepared focus cannot also select the current scene');
  assert.equal(list.querySelector('[data-catalogue-index="1"] a')?.getAttribute('aria-current'), 'page');
  catalogue.setSelection(null);
  assert.equal(list.querySelectorAll('[aria-current="page"]').length, 0, 'an overview selects no catalogue row');
  catalogue.clear();
  assert.equal(list.querySelectorAll('.object-item').length, 0);
  assert.equal(list.style.height, '0px');
  catalogue.destroy();
});

test('a filter change reads the layout before writing rows, and rows keep their nodes until they show another entry', () => {
  const { document, window } = parseHTML('<div id="scroll"><ul id="list"></ul></div>');
  const scroll = document.querySelector<HTMLElement>('#scroll')!;
  const list = document.querySelector<HTMLUListElement>('#list')!;
  const heightsAtRead: string[] = [];
  Object.defineProperty(scroll, 'clientHeight', { value: 420 });
  Object.defineProperty(list, 'offsetTop', { get() { heightsAtRead.push(list.style.height); return 0; } });
  Object.assign(window, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  const catalogue = createCatalogueWindow({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    list, scrollTarget: scroll });
  catalogue.setRows(100, 0, Array.from({ length: 100 }, (_, index) => entry(index)));
  heightsAtRead.length = 0;
  const entries = Array.from({ length: 50 }, (_, index) => entry(index));
  catalogue.setRows(entries.length, 0, entries);
  assert.deepEqual(heightsAtRead, ['5592px'], 'the one layout read happens before the list is resized');

  const subtitle = () => list.querySelector('[data-catalogue-index="0"] .object-kind');
  const marker = () => list.querySelector('[data-catalogue-index="0"] .object-lens-icon')?.firstElementChild;
  const [kind, icon] = [subtitle(), marker()];
  catalogue.setSelection({ kind: 'scene', id: 'earth-0' });
  catalogue.setRows(entries.length, 0, entries);
  assert.equal(subtitle(), kind, 'selecting or refiltering to the same entry keeps the subtitle nodes');
  assert.equal(marker(), icon);

  catalogue.setRows(entries.length, 0, [{ ...entry(7), classificationName: 'moon' }, ...entries.slice(1)]);
  assert.equal(subtitle(), kind, 'another entry reuses the same subtitle node');
  assert.equal(subtitle()?.textContent, 'Moon · ');
  assert.equal(list.querySelector('[data-catalogue-index="0"] .object-name')?.textContent, 'Earth 7');
});

test('clearing, empty results and subsequent scroll events never measure layout', () => {
  const { document, window } = parseHTML('<div id="scroll"><ul id="list"></ul></div>');
  const scroll = document.querySelector<HTMLElement>('#scroll')!;
  const list = document.querySelector<HTMLUListElement>('#list')!;
  let forbidReads = false;
  const read = (value: number) => { assert.equal(forbidReads, false, 'an empty list must not flush pending layout'); return value; };
  Object.defineProperty(scroll, 'clientHeight', { get: () => read(420) });
  Object.defineProperty(list, 'offsetTop', { get: () => read(0) });
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  Object.assign(window, {
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
  });
  const catalogue = createCatalogueWindow({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    list, scrollTarget: scroll });
  for (const empty of [() => catalogue.clear(), () => catalogue.setRows(0, 0, [])]) {
    forbidReads = false;
    catalogue.setRows(100, 0, Array.from({ length: 100 }, (_, index) => entry(index)));
    scroll.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 1);
    forbidReads = true;
    empty();
    empty();
    assert.equal(frames.size, 0, 'clearing cancels the pending scroll render');
    scroll.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 0, 'a hidden empty catalogue schedules no measurement');
    assert.equal(catalogue.inspect().connectedRows, 0);
    assert.equal(list.style.height, '0px');
  }
  catalogue.destroy();
});

test('keyboard focus measures once before scrolling and materializes the requested row', () => {
  const { document, window } = parseHTML('<div id="scroll"><ul id="list"></ul></div>');
  const scroll = document.querySelector<HTMLElement>('#scroll')!;
  const list = document.querySelector<HTMLUListElement>('#list')!;
  let scrolled = false, topReads = 0, heightReads = 0, scrollTop = 0;
  Object.defineProperty(scroll, 'scrollTop', { get: () => scrollTop, set(value: number) { scrollTop = value; scrolled = true; } });
  Object.defineProperty(scroll, 'clientHeight', { get() { assert.equal(scrolled, false); heightReads++; return 420; } });
  Object.defineProperty(list, 'offsetTop', { get() { assert.equal(scrolled, false); topReads++; return 0; } });
  Object.assign(window, { requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  const catalogue = createCatalogueWindow({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    list, scrollTarget: scroll });
  catalogue.setRows(100, 0, Array.from({ length: 100 }, (_, index) => entry(index)));
  topReads = heightReads = 0;
  assert.equal(catalogue.focus(70), true);
  assert.equal(topReads, 1);
  assert.equal(heightReads, 1);
  assert.equal(scrollTop, 71 * 56 - 420);
  assert.ok(list.querySelector('[data-catalogue-index="70"]'));
  catalogue.destroy();
});

test('rows not received yet are asked for once they scroll into the window, and a no-JavaScript list stays until the first answer', () => {
  const { document, window } = parseHTML('<div id="scroll"><ul id="list"><li class="object-item">Server row</li></ul></div>');
  const scroll = document.querySelector<HTMLElement>('#scroll')!;
  const list = document.querySelector<HTMLUListElement>('#list')!;
  Object.defineProperty(scroll, 'clientHeight', { value: 420 });
  Object.defineProperty(list, 'offsetTop', { value: 0 });
  const frames: FrameRequestCallback[] = [];
  Object.assign(window, { requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} });
  const missing: number[] = [];
  const catalogue = createCatalogueWindow({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    list, scrollTarget: scroll, onMissing: index => missing.push(index) });
  assert.equal(list.textContent, 'Server row');
  catalogue.setRows(100, 0, Array.from({ length: 40 }, (_, index) => entry(index)));
  assert.equal(list.querySelector('.object-item:not([data-catalogue-index])'), null, 'the first answer replaces the server rows');
  assert.equal(list.style.height, '5592px', 'the list is sized for every match');
  assert.deepEqual(missing, []);

  scroll.scrollTop = 45 * 56;
  scroll.dispatchEvent(new window.Event('scroll'));
  frames.shift()?.(0);
  assert.deepEqual(missing, [40], 'the first row not received names its page');
  assert.equal(list.querySelector('[data-catalogue-index="45"]'), null);
  catalogue.addRows(40, Array.from({ length: 40 }, (_, index) => entry(40 + index)));
  frames.shift()?.(0);
  assert.equal(list.querySelector<HTMLElement>('[data-catalogue-index="45"] .object-name')?.textContent, 'Earth 45');
  assert.deepEqual(catalogue.inspect().loaded, 80);
  catalogue.destroy();
});
