import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import type { BrowserWindow } from '../browser-types.mts';
import type { CatalogueIndexEntry } from '../catalogue-index.mts';
import { createCatalogueWindow } from '../catalogue-window.mts';

const entry = (index: number): CatalogueIndexEntry => ({
  kind: 'scene', id: `earth-${index}`, name: `Earth ${index}`, searchNames: [], classification: 'planet',
  classificationName: 'planet', systemName: 'solar system', route: `/earth-${index}/`, illustration: false,
  distanceMeters: index, detail: { text: `${index} au`, value: String(index), unit: 'au', title: 'Distance', ariaLabel: `${index} au. Distance` },
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
  catalogue.setEntries(Array.from({ length: 100 }, (_, index) => entry(index)));
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
  catalogue.setEntries([entry(90), { ...entry(91), name: 'Earth 90' }]);
  assert.equal(list.querySelector<HTMLElement>('[data-catalogue-index="0"] .object-name')?.textContent, 'Earth 90');
  assert.equal(list.querySelectorAll('.object-item').length, 2);

  catalogue.setSelection({ kind: 'scene', id: 'earth-91' });
  assert.equal(list.querySelector('[data-catalogue-index="1"] a')?.getAttribute('aria-current'), 'page');
  assert.equal(list.querySelector('[data-catalogue-index="0"] a')?.getAttribute('aria-current'), null,
    'objects with the same display name must not share selection');
  const focus: CatalogueIndexEntry = { ...entry(91), kind: 'prepared-focus', id: 'm42', route: '/sun/?focus=m42',
    source: { subject: 'focus:m42', document: '/sources/m42/', label: 'Sources M42' },
    marker: { kind: 'focus', thumbnail: null } };
  catalogue.setEntries([entry(91), focus]);
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
