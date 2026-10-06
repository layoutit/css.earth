import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { bindInputEvent, retainInputSurface } from './shared-input-surface.js';
import { clearCursor, setBaseCursor } from './cursor-state.js';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

setFlagsFromString('--expose-gc');
const collect: unknown = runInNewContext('gc');

/** Leases a slot to a scene and releases it, as a departing scene does. The reference tells whether the scene is held. */
function leaseAndRelease(surface: HTMLElement, target: EventTarget): WeakRef<object> {
  const scene = { name: 'departed' };
  bindInputEvent(surface, 'zoom', target, 'wheel', () => { void scene; }, { passive: false })();
  return new WeakRef(scene);
}

test('the native listener does not keep the scene that leased its slot first', async () => {
  const surface = parseHTML('<div></div>').document.querySelector('div')!;
  const target = new EventTarget(), destroy = retainInputSurface(surface);
  const departed = leaseAndRelease(surface, target);
  const release = bindInputEvent(surface, 'zoom', target, 'wheel', () => {}, { passive: false });
  await new Promise(resolve => setTimeout(resolve));
  assert.equal(typeof collect, 'function');
  if (typeof collect === 'function') collect();
  assert.equal(departed.deref(), undefined);
  release(); destroy();
});

test('handoff retains native wheel registration and releases the departed scene callback', () => {
  const surface = parseHTML('<div></div>').document.querySelector('div')!;
  const target = new EventTarget(), add = mock.method(target, 'addEventListener'), remove = mock.method(target, 'removeEventListener');
  const destroy = retainInputSurface(surface), first = mock.fn(() => {}), second = mock.fn(() => {});
  const releaseFirst = bindInputEvent(surface, 'zoom', target, 'wheel', first, { passive: false });
  target.dispatchEvent(new Event('wheel'));
  releaseFirst(); target.dispatchEvent(new Event('wheel'));
  const releaseSecond = bindInputEvent(surface, 'zoom', target, 'wheel', second, { passive: false });
  releaseFirst(); target.dispatchEvent(new Event('wheel'));
  assert.equal(first.mock.callCount(), 1); assert.equal(second.mock.callCount(), 1);
  assert.equal(add.mock.callCount(), 1); assert.equal(remove.mock.callCount(), 0);
  releaseSecond(); destroy(); destroy(); target.dispatchEvent(new Event('wheel'));
  assert.equal(second.mock.callCount(), 1); assert.equal(remove.mock.callCount(), 1);
});

test('shared leases preserve native stopImmediatePropagation ordering and reject overlapping owners', () => {
  const surface = parseHTML('<div></div>').document.querySelector('div')!;
  const target = new EventTarget(), destroy = retainInputSurface(surface), next = mock.fn(() => {});
  const release = bindInputEvent(surface, 'first', target, 'wheel', event => event.stopImmediatePropagation());
  bindInputEvent(surface, 'second', target, 'wheel', next);
  assert.throws(() => bindInputEvent(surface, 'first', target, 'wheel', next), /still leased/);
  target.dispatchEvent(new Event('wheel')); assert.equal(next.mock.callCount(), 0);
  release(); target.dispatchEvent(new Event('wheel')); assert.equal(next.mock.callCount(), 1);
  destroy();
});

test('scene disposal does not reset a shared cursor; application disposal restores it', () => {
  const surface = parseHTML('<div style="cursor:pointer"></div>').document.querySelector('div')!;
  const destroy = retainInputSurface(surface);
  setBaseCursor(surface, 'crosshair'); clearCursor(surface);
  assert.equal(surface.style.cursor, 'crosshair');
  destroy(); assert.equal(surface.style.cursor, 'pointer');
  setBaseCursor(surface, 'crosshair'); clearCursor(surface);
  assert.equal(surface.style.cursor, '');
});
