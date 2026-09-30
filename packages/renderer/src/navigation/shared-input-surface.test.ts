import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { bindInputEvent, retainInputSurface } from './shared-input-surface.js';
import { clearCursor, setBaseCursor } from './cursor-state.js';

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
