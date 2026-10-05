import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createShowcaseController } from './showcase.mts';
import type { BrowserWindow } from './browser/browser-types.mts';

const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('an empty or single-current destination list stops immediately without navigating', () => {
  for (const ids of [[], ['earth']]) {
    const { document, window } = parseHTML('<button class="object-showcase-action" aria-pressed="false"></button>');
    const flights: string[] = [];
    const controller = createShowcaseController({ documentTarget: document, windowTarget: window as unknown as BrowserWindow, ids,
      navigate: async id => { flights.push(id); return true; }, readObjectId: () => 'earth', onError: error => { throw error; } });
    controller.start(); assert.equal(controller.playing, false); assert.deepEqual(flights, []);
    assert.equal(document.querySelector('button')!.getAttribute('aria-pressed'), 'false'); controller.destroy();
  }
});

test('navigation failure reports its original error only while the generation still owns the tour', async () => {
  for (const stopBeforeReject of [false, true]) {
    const { document, window } = parseHTML('<button class="object-showcase-action" aria-pressed="false"></button>');
    const errors: unknown[] = [], failure = new Error('offline flight'); let reject!: (error: unknown) => void;
    const controller = createShowcaseController({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
      ids: ['earth', 'mars'], random: () => 0, readObjectId: () => 'earth',
      navigate: () => new Promise((_resolve, fail) => { reject = fail; }), onError: error => errors.push(error) });
    controller.start(); controller.start();
    if (stopBeforeReject) controller.stop();
    reject(failure); await settle();
    assert.equal(controller.playing, false); assert.deepEqual(errors, stopBeforeReject ? [] : [failure]);
    assert.equal(document.querySelector('button')!.getAttribute('aria-pressed'), 'false'); controller.destroy();
  }
});

test('the button stops a live tour and visible visibility changes leave it running', () => {
  const { document, window } = parseHTML('<button class="object-showcase-action" aria-pressed="false"></button>');
  const controller = createShowcaseController({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    ids: ['earth', 'mars'], random: () => 0, readObjectId: () => 'earth', navigate: () => new Promise(() => {}), onError: error => { throw error; } });
  const button = document.querySelector('button')!;
  button.dispatchEvent(new window.Event('click')); assert.equal(controller.playing, true);
  Object.defineProperty(document, 'visibilityState', { value: 'visible' }); document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(controller.playing, true); button.dispatchEvent(new window.Event('click')); assert.equal(controller.playing, false); controller.destroy();
});

test('landed tours turn extended objects by 15 degrees, dwell 7000 ms and replace subsequent history', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, window } = parseHTML('<button class="object-showcase-action"><span></span></button><main></main>');
  let current = 'earth';
  const flights: unknown[] = [], turns: { degrees: number; durationMilliseconds: number; signal: AbortSignal }[] = [];
  const controller = createShowcaseController({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    ids: ['earth', 'm31', 'mars'], random: () => 0, readObjectId: () => current,
    navigate: async (id, intent) => { flights.push([id, intent]); current = id; return true; },
    isExtended: id => id === 'm31', turn: value => turns.push(value), onError: error => { throw error; } });
  controller.start(); await settle();
  assert.deepEqual(flights, [['m31', { kind: 'object', view: 'body', camera: 'frame' }]]);
  assert.equal(turns[0]?.degrees, 15); assert.equal(turns[0]?.durationMilliseconds, 7000);
  assert.equal(turns[0]?.signal.aborted, false);
  document.querySelector('span')!.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  assert.equal(controller.playing, true, 'the slideshow button does not surrender the tour');
  t.mock.timers.tick(6999); await settle(); assert.equal(flights.length, 1);
  t.mock.timers.tick(1); await settle();
  assert.deepEqual(flights[1], ['mars', { kind: 'object', view: 'body', camera: 'frame', history: 'replace' }]);
  assert.equal(turns[1]?.degrees, 60); assert.equal(turns[1]?.durationMilliseconds, 7000);
  document.querySelector('main')!.dispatchEvent(new window.Event('wheel', { bubbles: true }));
  assert.equal(controller.playing, false); assert.equal(turns[0]?.signal.aborted, true);
  t.mock.timers.tick(7000); await settle(); assert.equal(flights.length, 2); controller.destroy();
});

test('a navigation resolving without landing stops without turning or starting a dwell', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { document, window } = parseHTML('<button class="object-showcase-action"></button>');
  const turns: unknown[] = []; let flights = 0;
  const controller = createShowcaseController({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    ids: ['earth', 'mars'], readObjectId: () => 'earth', navigate: async () => { flights++; return false; },
    turn: value => turns.push(value), onError: error => { throw error; } });
  controller.start(); await settle(); t.mock.timers.tick(14000); await settle();
  assert.equal(controller.playing, false); assert.equal(flights, 1); assert.deepEqual(turns, []); controller.destroy();
});
