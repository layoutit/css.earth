import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import type { BrowserWindow } from '../browser-types.mts';
import { required } from './navigation-test-values.mts';
import { createChartPixelAlignmentController } from '../chart-pixel-alignment.mts';

test('hidden charts schedule no work; visible charts batch reads, retain corrections, and retire cleanly', () => {
  const calls: string[] = [], frames = new Map<number, FrameRequestCallback>();
  const windowTarget = new EventTarget();
  type Chart = ReturnType<typeof chart>;
  let observe: ((entries: { target: Chart; isIntersecting: boolean; boundingClientRect: { width: number; height: number } }[]) => void) | undefined;
  let disconnected = false, next = 0;
  Object.assign(windowTarget, { devicePixelRatio: 2,
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    IntersectionObserver: class { constructor(callback: NonNullable<typeof observe>) { observe = callback; } observe() {} disconnect() { disconnected = true; } },
  });
  const chart = (id: number) => Object.assign(new EventTarget(), { correction: 0,
    getBoundingClientRect() { calls.push(`read:${id}`); return { top: 10.25 + this.correction }; },
    style: { setProperty(name: string, value: string) { calls.push(`write:${id}`); charts[id].correction = parseFloat(value.split(' ')[1]); },
      removeProperty() { calls.push(`clear:${id}`); } },
  });
  const charts = [chart(0), chart(1)], switcher = new EventTarget();
  const drawer = { querySelectorAll: (selector: string) => selector === '.object-chart' ? charts : [switcher] };
  const controller = createChartPixelAlignmentController(drawer as unknown as HTMLElement, windowTarget as BrowserWindow);
  const visibility = (shown: boolean) => required(observe)(charts.map(target => ({ target, isIntersecting: shown, boundingClientRect: { width: shown ? 300 : 0, height: shown ? 100 : 0 } })));
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(0); };
  visibility(false); charts[0].dispatchEvent(new Event('load')); windowTarget.dispatchEvent(new Event('resize'));
  assert.equal(frames.size, 0); assert.deepEqual(calls, []);
  visibility(true); assert.equal(frames.size, 1); flush();
  assert.deepEqual(calls, ['read:0', 'read:1', 'write:0', 'write:1']);
  calls.length = 0; switcher.dispatchEvent(new Event('chartchange')); flush();
  assert.deepEqual(calls, ['read:0', 'read:1'], 'existing correction is subtracted without resetting styles');
  windowTarget.dispatchEvent(new Event('resize')); visibility(false);
  assert.equal(frames.size, 0);
  controller.destroy(); controller.destroy(); assert.equal(disconnected, true);
  calls.length = 0; visibility(true); windowTarget.dispatchEvent(new Event('resize')); charts[0].dispatchEvent(new Event('load')); flush();
  assert.deepEqual(calls, []); assert.equal(frames.size, 0);
});
