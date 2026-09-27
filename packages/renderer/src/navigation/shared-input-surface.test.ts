import { expect, test, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import { bindInputEvent, retainInputSurface } from './shared-input-surface.js';
import { clearCursor, setBaseCursor } from './cursor-state.js';

test('handoff retains native wheel registration and releases the departed scene callback', () => {
  const surface = parseHTML('<div></div>').document.querySelector('div')!;
  const target = new EventTarget(), add = vi.spyOn(target, 'addEventListener'), remove = vi.spyOn(target, 'removeEventListener');
  const destroy = retainInputSurface(surface), first = vi.fn(), second = vi.fn();
  const releaseFirst = bindInputEvent(surface, 'zoom', target, 'wheel', first, { passive: false });
  target.dispatchEvent(new Event('wheel'));
  releaseFirst(); target.dispatchEvent(new Event('wheel'));
  const releaseSecond = bindInputEvent(surface, 'zoom', target, 'wheel', second, { passive: false });
  releaseFirst(); target.dispatchEvent(new Event('wheel'));
  expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
  expect(add).toHaveBeenCalledTimes(1); expect(remove).not.toHaveBeenCalled();
  releaseSecond(); destroy(); destroy(); target.dispatchEvent(new Event('wheel'));
  expect(second).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1);
});

test('shared leases preserve native stopImmediatePropagation ordering and reject overlapping owners', () => {
  const surface = parseHTML('<div></div>').document.querySelector('div')!;
  const target = new EventTarget(), destroy = retainInputSurface(surface), next = vi.fn();
  const release = bindInputEvent(surface, 'first', target, 'wheel', event => event.stopImmediatePropagation());
  bindInputEvent(surface, 'second', target, 'wheel', next);
  expect(() => bindInputEvent(surface, 'first', target, 'wheel', next)).toThrow(/still leased/);
  target.dispatchEvent(new Event('wheel')); expect(next).not.toHaveBeenCalled();
  release(); target.dispatchEvent(new Event('wheel')); expect(next).toHaveBeenCalledTimes(1);
  destroy();
});

test('scene disposal does not reset a shared cursor; application disposal restores it', () => {
  const surface = parseHTML('<div style="cursor:pointer"></div>').document.querySelector('div')!;
  const destroy = retainInputSurface(surface);
  setBaseCursor(surface, 'crosshair'); clearCursor(surface);
  expect(surface.style.cursor).toBe('crosshair');
  destroy(); expect(surface.style.cursor).toBe('pointer');
  setBaseCursor(surface, 'crosshair'); clearCursor(surface);
  expect(surface.style.cursor).toBe('');
});
