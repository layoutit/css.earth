import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createShowcaseController, SHOWCASE_OBJECT_IDS } from '../showcase.mts';
import { requireSceneObject } from '../objects.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';
import type { NavigationIntent } from '../navigation/navigation-request.mts';

const markup = '<html><body><header><button class="object-showcase-action" type="button" aria-pressed="false"><span>Showcase</span></button></header><main></main></body></html>';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Flight = { id: string; intent: NavigationIntent };

function mount(ids: readonly string[], land: (flight: Flight) => Promise<boolean | undefined>, dwellMs = 1) {
  const { document, window } = parseHTML(markup);
  const flights: Flight[] = [];
  let objectId = ids[0]!;
  const controller = createShowcaseController({ documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    navigate: async (id, intent) => { const flight = { id, intent }; flights.push(flight); const landed = await land(flight); if (landed === true) objectId = id; return landed; },
    readObjectId: () => objectId, dwellMs, ids, onError: error => { throw error; } });
  const button = document.querySelector<HTMLElement>('.object-showcase-action')!;
  return { document, window, controller, flights, button, pressed: () => button.getAttribute('aria-pressed') };
}

test('every showcase destination is a registered scene object, listed once', () => {
  assert.equal(new Set(SHOWCASE_OBJECT_IDS).size, SHOWCASE_OBJECT_IDS.length);
  for (const id of SHOWCASE_OBJECT_IDS) requireSceneObject(id);
});

test('the pill tours the showcase at random, never the shown body, with one history entry that later hops replace', async () => {
  const ids = ['earth', 'mars', 'moon', 'jupiter'];
  const { window, controller, flights, button, pressed } = mount(ids, async () => true);
  button.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(pressed(), 'true');
  assert.ok(controller.playing);
  while (flights.length < 9) await wait(2);
  controller.stop();
  assert.equal(pressed(), 'false');
  assert.notEqual(flights[0]!.id, 'earth', 'the tour leaves the shown body');
  for (let index = 1; index < flights.length; index++) assert.notEqual(flights[index]!.id, flights[index - 1]!.id, 'no hop lands where it started');
  assert.ok(flights.every(flight => ids.includes(flight.id)));
  assert.deepEqual(flights[0]!.intent, { kind: 'object', view: 'body', camera: 'frame' }, 'the first hop is a history entry');
  for (const { intent } of flights.slice(1)) assert.deepEqual(intent, { kind: 'object', view: 'body', camera: 'frame', history: 'replace' });
  // Each draw empties the bag before refilling it: the first four hops cover the whole list.
  assert.equal(new Set(flights.slice(0, 4).map(flight => flight.id)).size, 4);
  const stopped = flights.length;
  await wait(6);
  assert.equal(flights.length, stopped, 'a stopped tour flies no further');
  controller.destroy();
});

test('a pointer, a wheel, a key, Back or a hidden tab ends the tour; the pill itself does not', async () => {
  for (const takeover of ['pointerdown', 'wheel', 'keydown', 'popstate', 'visibilitychange'] as const) {
    const { document, window, controller, flights } = mount(['earth', 'mars'], () => new Promise(() => {}));
    controller.start();
    assert.ok(controller.playing);
    assert.equal(flights.length, 1);
    document.querySelector('.object-showcase-action')!.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    assert.ok(controller.playing, `${takeover}: pressing the pill is not a takeover`);
    if (takeover === 'popstate') window.dispatchEvent(new window.Event('popstate'));
    else if (takeover === 'visibilitychange') {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new window.Event('visibilitychange'));
    } else document.querySelector('main')!.dispatchEvent(new window.Event(takeover, { bubbles: true }));
    assert.equal(controller.playing, false, `${takeover} ends the tour`);
    assert.equal(document.querySelector('.object-showcase-action')!.getAttribute('aria-pressed'), 'false');
    controller.destroy();
  }
});

test('a flight that does not land ends the tour, and a hop stopped in flight schedules nothing', async () => {
  const interrupted = mount(['earth', 'mars'], async () => false);
  interrupted.controller.start();
  await wait(2);
  assert.equal(interrupted.controller.playing, false);
  assert.equal(interrupted.flights.length, 1);
  interrupted.controller.destroy();

  let land: ((landed: boolean) => void) | null = null;
  const stopped = mount(['earth', 'mars'], () => new Promise<boolean>(resolve => { land = resolve; }));
  stopped.controller.start();
  stopped.controller.stop();
  land!(true);
  await wait(4);
  assert.equal(stopped.flights.length, 1, 'the landing of a stopped tour flies no further');
  assert.equal(stopped.controller.playing, false);
  stopped.controller.destroy();
});
