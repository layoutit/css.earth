import { expect, test } from 'vitest';
import { createTouchPinchControls } from './touch-pinch.js';

class Surface extends EventTarget {
  captured = new Set<number>();
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
  pointer(type: string, id: number, x = 100, y = 100, pointerType = 'touch') {
    const event = Object.assign(new Event(type, { cancelable: true }),
      { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
    this.dispatchEvent(event);
    return event;
  }
}
function fixture() {
  const surface = new Surface(), scales: number[] = [], centers: { x: number; y: number }[] = [];
  let starts = 0, ends = 0;
  const controls = createTouchPinchControls({ inputSurface: surface as unknown as HTMLElement,
    onStart() { starts++; }, onEnd() { ends++; },
    onScale(scale, center) { scales.push(scale); centers.push(center); },
    onError(error) { throw error; },
  });
  return { surface, scales, centers, controls, counts: () => ({ starts, ends }) };
}

test('two fingers zoom proportionally; a remaining finger cannot become an accidental drag', () => {
  const f = fixture();
  expect(f.surface.pointer('pointerdown', 1).defaultPrevented).toBe(false);
  expect(f.surface.pointer('pointerdown', 2, 200).defaultPrevented).toBe(true);
  expect(f.counts()).toEqual({ starts: 1, ends: 0 });
  f.surface.pointer('pointermove', 2, 220);
  expect(f.scales).toEqual([1.2]);
  expect(f.centers).toEqual([{ x: 160, y: 100 }]);
  f.surface.pointer('pointerup', 2, 220);
  expect(f.surface.pointer('pointermove', 1, 90).defaultPrevented).toBe(true);
  expect(f.scales).toEqual([1.2]);
  f.surface.pointer('pointerup', 1, 90);
  expect(f.counts()).toEqual({ starts: 1, ends: 1 });
  expect(f.surface.captured.size).toBe(0);
  expect(f.surface.pointer('pointerdown', 3).defaultPrevented).toBe(false);
  f.controls.destroy();
});

test('third fingers rebase without jumps and capture transfer does not cancel a pinch', () => {
  const f = fixture();
  f.surface.pointer('pointerdown', 1);
  f.surface.pointer('pointerdown', 2, 200);
  f.surface.pointer('lostpointercapture', 1);
  f.surface.pointer('pointerdown', 3, 300);
  f.surface.pointer('pointermove', 2, 220);
  expect(f.scales).toEqual([]);
  f.surface.pointer('pointerup', 3, 300);
  f.surface.pointer('pointermove', 2, 244);
  expect(f.scales).toEqual([1.2]);
  f.controls.destroy();
  expect(f.counts()).toEqual({ starts: 1, ends: 1 });
  expect(f.surface.captured.size).toBe(0);
});

test('cancellation, disabled input and teardown release the gesture without another zoom', () => {
  const f = fixture();
  f.surface.pointer('pointerdown', 1);
  f.surface.pointer('pointerdown', 2, 200);
  f.surface.pointer('pointercancel', 1);
  f.surface.pointer('pointermove', 2, 250);
  expect(f.scales).toEqual([]);
  f.controls.update({ drag: false });
  expect(f.surface.captured.size).toBe(0);
  expect(f.counts()).toEqual({ starts: 1, ends: 1 });
  f.surface.pointer('pointerdown', 3);
  f.surface.pointer('pointerdown', 4, 200);
  expect(f.counts().starts).toBe(1);
  f.controls.update({ drag: true, wheel: false });
  expect(f.surface.pointer('pointerdown', 5, 100, 100, 'mouse').defaultPrevented).toBe(false);
  f.surface.pointer('pointerdown', 6);
  f.surface.pointer('pointerdown', 7, 200);
  f.surface.pointer('pointermove', 7, 220);
  expect(f.scales).toEqual([1.2]);
  f.controls.destroy();
  f.surface.pointer('pointerdown', 8);
  f.surface.pointer('pointerdown', 9, 200);
  expect(f.counts()).toEqual({ starts: 2, ends: 2 });
  expect(f.surface.captured.size).toBe(0);
});

test('partial listener construction releases the handlers already registered', () => {
  const surface = new Surface();
  const add = surface.addEventListener.bind(surface);
  surface.addEventListener = (type, listener, options) => {
    if (type === 'pointerup') throw new Error('listener failed');
    add(type, listener, options);
  };
  let starts = 0;
  expect(() => createTouchPinchControls({ inputSurface: surface as unknown as HTMLElement,
    onStart() { starts++; }, onEnd() {}, onScale() {}, onError(error) { throw error; },
  })).toThrow('listener failed');
  surface.pointer('pointerdown', 1); surface.pointer('pointerdown', 2, 200);
  expect(starts).toBe(0);
});
