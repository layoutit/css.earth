import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from '../browser-types.mts';
import { createSheetController } from '../shell-sheet.mts';

// Synthetic snap heights for a 690 px sheet: the peek rests 538 px below the open sheet,
// and the half stop rests 253 px below it. The gesture behavior does not depend on the CSS peek size.
const SHELL = `<html><body data-object-shell>
  <header class="explorer-shell-header"><div class="object-search-toolbar"><input class="object-sidebar-search" type="search"></div>
  <div class="object-search-categories"></div></header>
  <aside class="object-sidebar"><div class="object-drawer-content"><input class="object-sheet-handle" type="checkbox"></div></aside>
</body></html>`;
const REST: Readonly<Record<string, number>> = { tucked: 670, peek: 538, half: 253, full: 0 };
const SHEET_TRANSFORM = /^translate\(0, calc\((-?[\d.]+)px - var\(--sheet-rest\)\)\)$/u;

function mountSheet() {
  const { document, window } = parseHTML(SHELL);
  const sheet = document.querySelector<HTMLElement>('.object-sidebar')!;
  const toolbar = document.querySelector<HTMLElement>('.object-search-toolbar')!;
  const categories = document.querySelector<HTMLElement>('.object-search-categories')!;
  const search = document.querySelector<HTMLInputElement>('.object-sidebar-search')!;
  Object.defineProperty(sheet, 'offsetHeight', { value: 690 });
  for (const surface of [sheet, toolbar, categories]) Object.assign(surface, { setPointerCapture() {} });
  const frames: FrameRequestCallback[] = [];
  const mobile = { matches: true, listeners: [] as (() => void)[],
    addEventListener(_type: string, listener: () => void) { this.listeners.push(listener); } };
  const visualViewport = Object.assign(new EventTarget(), { height: 874, offsetTop: 0 });
  // Every forced style read, in order: what the sheet held and which class it wore when the page was restyled.
  const styleReads: { transform: string; classes: string }[] = [];
  Object.assign(window, {
    innerHeight: 874,
    visualViewport,
    matchMedia: () => mobile,
    requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    // Computes the sheet's transform the way shell-layout.css does: its inline offset less the state's rest.
    getComputedStyle(element: HTMLElement) {
      if (element === sheet) styleReads.push({ transform: sheet.style.transform, classes: sheet.className });
      const offset = SHEET_TRANSFORM.exec(element.style.transform);
      const rest = REST[document.body.dataset.sheet ?? 'peek'] ?? 0;
      return {
        transform: offset ? `matrix(1, 0, 0, 1, 0, ${Number(offset[1]) - rest})` : 'none',
        transitionProperty: 'transform',
        getPropertyValue: (name: string) => ({ '--sheet-tucked': '20px', '--sheet-peek': '152px', '--sheet-half': '437px' })[name] ?? '',
      };
    },
    DOMMatrixReadOnly: class { readonly m42: number; constructor(matrix: string) { this.m42 = Number(/(-?[\d.]+)\)$/u.exec(matrix)?.[1]); } },
  });
  const lifetime = createSceneLifetime();
  const controller = createSheetController(document, window as unknown as BrowserWindow, lifetime, () => 'europa:');
  let time = 0;
  const pointer = (type: string, target: EventTarget, clientY: number, elapsed = 16, clientX = 200) => {
    time += elapsed;
    const event = new window.Event(type, { bubbles: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, button: { value: 0 },
      clientX: { value: clientX }, clientY: { value: clientY }, timeStamp: { value: time } });
    target.dispatchEvent(event);
  };
  const runFrames = () => { for (const frame of frames.splice(0)) frame(time); };
  const inline = (element: HTMLElement) => ({ transform: element.style.transform, duration: element.style.getPropertyValue('--sheet-snap-duration') });
  return { document, window, sheet, toolbar, categories, search, mobile, visualViewport, styleReads, controller, lifetime,
    pointer, runFrames, inline, readers: [sheet, toolbar, categories] };
}

test('a drag writes its offset on the sheet and the search riding on it, never on the body', () => {
  const { document, sheet, toolbar, categories, pointer, inline } = mountSheet();
  const body = document.body.getAttribute('style');
  pointer('pointerdown', sheet, 800);
  pointer('pointermove', document, 700);
  assert.ok(sheet.classList.contains('is-dragging'));
  assert.equal(toolbar.style.transform, 'translate3d(0, 438px, 0)');
  assert.equal(categories.style.transform, 'translate3d(0, 438px, 0)');
  // The sheet rests at --sheet-rest, so it moves by the rest of the way.
  assert.equal(sheet.style.transform, 'translate(0, calc(438px - var(--sheet-rest)))');
  pointer('pointermove', document, 650);
  assert.deepEqual(inline(toolbar), { transform: 'translate3d(0, 388px, 0)', duration: '' });
  assert.equal(sheet.style.transform, 'translate(0, calc(388px - var(--sheet-rest)))');
  assert.equal(document.body.getAttribute('style'), body, 'a move writes nothing on the body');
  assert.equal(document.body.style.getPropertyValue('--sheet-offset'), '');
});

test('filter and search swipes tuck and reveal the sheet without stealing horizontal pill swipes', () => {
  const { document, sheet, toolbar, categories, pointer, runFrames } = mountSheet();
  pointer('pointerdown', categories, 400);
  pointer('pointermove', document, 510);
  pointer('pointerup', document, 510, 200);
  assert.equal(document.body.dataset.sheet, 'tucked');
  assert.equal(sheet.querySelector('.object-sheet-handle')?.getAttribute('aria-label'), 'Show information sheet');
  runFrames();

  pointer('pointerdown', categories, 400);
  pointer('pointermove', document, 410, 16, 300);
  pointer('pointerup', document, 410, 200, 300);
  assert.equal(document.body.dataset.sheet, 'tucked', 'horizontal pill swipes do not move the sheet');

  pointer('pointerdown', toolbar, 500);
  pointer('pointermove', document, 390);
  pointer('pointerup', document, 390, 200);
  assert.equal(document.body.dataset.sheet, 'peek');
  runFrames();
});

test('a swipe on the search field reveals the sheet while a tap still opens search', () => {
  const { document, window, categories, search, pointer, runFrames } = mountSheet();
  pointer('pointerdown', categories, 400);
  pointer('pointermove', document, 510);
  pointer('pointerup', document, 510, 200);
  runFrames();
  assert.equal(document.body.dataset.sheet, 'tucked');

  pointer('pointerdown', search, 500);
  search.dispatchEvent(new window.Event('focus'));
  assert.equal(document.body.dataset.sheet, 'tucked', 'focus waits for a possible swipe');
  pointer('pointermove', document, 380);
  pointer('pointerup', document, 380, 200);
  assert.equal(document.body.dataset.sheet, 'peek');
  runFrames();

  pointer('pointerdown', search, 500);
  search.dispatchEvent(new window.Event('focus'));
  pointer('pointerup', document, 500);
  assert.equal(document.body.dataset.sheet, 'full', 'a tap still opens the search sheet');
});

test('a release holds the sheet where the finger left it, then clears the hold on the next frame', () => {
  const { window, document, sheet, toolbar, categories, styleReads, pointer, runFrames, inline, readers } = mountSheet();
  pointer('pointerdown', sheet, 800);
  pointer('pointermove', document, 700);
  pointer('pointermove', document, 650);
  styleReads.length = 0;
  // A pause before the release: no fling, so the nearest stop takes it.
  pointer('pointerup', document, 650, 200);
  assert.equal(document.body.dataset.sheet, 'half');
  // 388 px, 135 px from the half stop over a 538 px peek: 220 + 120 × 0.25 ms.
  for (const rider of [toolbar, categories]) assert.deepEqual(inline(rider), { transform: 'translate3d(0, 388px, 0)', duration: '250ms' });
  assert.deepEqual(inline(sheet), { transform: 'translate(0, calc(388px - var(--sheet-rest)))', duration: '250ms' });
  // WebKit starts no transition when the transition turns on in the same style update as the transform it animates, so
  // the page is restyled holding the sheet untransitioned, then again with the transition on, before the hold clears.
  const held = 'translate(0, calc(388px - var(--sheet-rest)))';
  assert.deepEqual(styleReads.slice(-2), [{ transform: held, classes: 'object-sidebar is-dragging' },
    { transform: held, classes: 'object-sidebar is-settling' }]);
  runFrames();
  for (const reader of readers) assert.deepEqual(inline(reader), { transform: '', duration: '250ms' });
  assert.ok(sheet.classList.contains('is-settling'), 'the snap runs until the sheet\'s own transform ends');
  const inner = new window.Event('transitionend', { bubbles: true });
  Object.defineProperties(inner, { propertyName: { value: 'transform' } });
  toolbar.dispatchEvent(inner);
  assert.ok(sheet.classList.contains('is-settling'), 'only the sheet ends the snap');
  const own = new window.Event('transitionend');
  Object.defineProperties(own, { propertyName: { value: 'transform' } });
  sheet.dispatchEvent(own);
  assert.ok(!sheet.classList.contains('is-settling'));
  for (const reader of readers) assert.deepEqual(inline(reader), { transform: '', duration: '' });
  assert.equal(document.body.style.getPropertyValue('--sheet-offset'), '');
  assert.equal(document.body.style.getPropertyValue('--sheet-snap-duration'), '');
});

test('search opens the whole sheet over the keyboard and leaves no transform behind', () => {
  const { window, document, search, visualViewport, runFrames, inline, readers } = mountSheet();
  search.dispatchEvent(new window.Event('focus'));
  assert.equal(document.body.dataset.sheet, 'full');
  runFrames();
  for (const reader of readers) assert.equal(inline(reader).transform, '');
  // The keyboard covers the bottom of the layout viewport; the sheet gives up that room.
  visualViewport.height = 538;
  visualViewport.dispatchEvent(new Event('resize'));
  assert.equal(document.body.style.getPropertyValue('--sheet-keyboard'), '336px');
  for (const reader of readers) assert.equal(inline(reader).transform, '');
  visualViewport.height = 874;
  visualViewport.dispatchEvent(new Event('resize'));
  assert.equal(document.body.style.getPropertyValue('--sheet-keyboard'), '');
});

test('leaving the phone layout clears a drag or a hold from the sheet and its riders', () => {
  const { document, sheet, mobile, pointer, inline, readers } = mountSheet();
  pointer('pointerdown', sheet, 800);
  pointer('pointermove', document, 700);
  mobile.matches = false;
  for (const listener of mobile.listeners) listener();
  assert.ok(!sheet.classList.contains('is-dragging'));
  for (const reader of readers) assert.deepEqual(inline(reader), { transform: '', duration: '' });
  // A snap caught before its frame clears too.
  mobile.matches = true;
  pointer('pointerdown', sheet, 800);
  pointer('pointermove', document, 700);
  pointer('pointerup', document, 700, 200);
  assert.equal(inline(sheet).duration.endsWith('ms'), true);
  mobile.matches = false;
  for (const listener of mobile.listeners) listener();
  assert.ok(!sheet.classList.contains('is-settling'));
  for (const reader of readers) assert.deepEqual(inline(reader), { transform: '', duration: '' });
});

test('destroy leaves the sheet, its riders and the body as the markup made them', () => {
  const { document, sheet, controller, pointer, inline, readers } = mountSheet();
  pointer('pointerdown', sheet, 800);
  pointer('pointermove', document, 700);
  pointer('pointerup', document, 700, 200);
  controller.destroy();
  for (const reader of readers) assert.deepEqual(inline(reader), { transform: '', duration: '' });
  assert.ok(!sheet.classList.contains('is-dragging') && !sheet.classList.contains('is-settling'));
  assert.equal(document.body.dataset.sheet, undefined);
});
