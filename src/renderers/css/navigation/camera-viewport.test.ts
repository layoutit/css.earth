import { fixedCameraOrientation } from '../../../platform/test/camera-orientation-fixture.mts';
import { expect, test, vi } from 'vitest';
import { createCameraViewport } from './camera-viewport.js';
import { createPerspectiveDolly } from './perspective-dolly.js';
import scene from '../../../objects/mercury/prepared/scene.json';

test('prepared FOVs retain independent measurements across switches and resize together', () => {
  let width = 1000, reads = 0, resize!: () => void, refresh!: FrameRequestCallback;
  const remove = vi.fn();
  const view = {
    ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} },
    getComputedStyle: (probe: HTMLElement) => { reads++; return { perspective: `${parseFloat(probe.style.perspective) * width / 100}px` }; },
    requestAnimationFrame: (callback: FrameRequestCallback) => { refresh = callback; return 1; },
    cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {},
  };
  const stage = { ownerDocument: { defaultView: view, createElement: () => ({ style: {}, remove }) }, appendChild() {},
    getBoundingClientRect: () => { reads++; return { x: 0, y: 0, width, height: 800 }; } };
  const viewport = createCameraViewport(stage as unknown as HTMLElement);
  const wide = viewport.read('80cqw'), narrow = viewport.read('120cqw');
  const preparedReads = reads;
  expect(viewport.read('80cqw')).toBe(wide);
  expect(viewport.read('120cqw')).toBe(narrow);
  expect(reads).toBe(preparedReads);
  expect(wide.focalPixels).toBe(800); expect(narrow.focalPixels).toBe(1200);
  width = 700; resize();
  const resizedReads = reads;
  expect(viewport.read('80cqw').focalPixels).toBe(560);
  expect(viewport.read('120cqw').focalPixels).toBe(840);
  expect(reads).toBe(resizedReads);
  viewport.destroy(); expect(remove).toHaveBeenCalledTimes(2);
});

test('one viewport snapshot survives camera mounts and refreshes on layout changes', () => {
  let width = 1200, reads = 0, resize!: () => void;
  const frames = new Map<number, FrameRequestCallback>(), events = new Map<string, () => void>();
  const remove = vi.fn(), disconnect = vi.fn();
  const view = {
    ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; },
    getComputedStyle: () => { reads++; return { perspective: `${width * .8}px` }; },
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(1, callback); return 1; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: (name: string, callback: () => void) => events.set(name, callback),
    removeEventListener: (name: string) => events.delete(name),
  };
  const stage = { ownerDocument: { defaultView: view, createElement: () => ({ style: {}, remove }) },
    appendChild() {}, getBoundingClientRect: () => { reads++; return { x: 0, y: -20, width, height: 800 }; } };
  const viewport = createCameraViewport(stage as unknown as HTMLElement);
  const first = viewport.read(scene.camera.projection.cssPerspective);
  const measured = reads;
  const failRead = () => { throw new Error('Object mount must not measure DOM'); };
  const element = () => ({ style: {}, ownerDocument: { defaultView: { getComputedStyle: failRead } }, getBoundingClientRect: failRead });
  const camera = () => createPerspectiveDolly({ cameraPlan: scene.camera, heliocentric: null, viewport,
    worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0],
      presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 },
      bodyRadiusUnits: 100, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
    stage: element(), cameraElement: element(), skyElement: element(), sceneElement: element(),
  } as unknown as Parameters<typeof createPerspectiveDolly>[0], () => fixedCameraOrientation());
  const a = camera(), b = camera();
  expect(a.state().focal).toBe(960); expect(b.trackball().centerY).toBe(380);
  expect(viewport.read(scene.camera.projection.cssPerspective)).toBe(first);
  expect(reads).toBe(measured);
  const changed = vi.fn(() => b.remeasure()), unsubscribe = viewport.subscribe(changed);
  resize();
  expect(viewport.read(scene.camera.projection.cssPerspective)).toBe(first);
  expect(reads).toBeGreaterThan(measured);
  expect(frames.size).toBe(0);
  expect(changed).not.toHaveBeenCalled();
  width = 900; events.get('resize')!();
  expect(frames.size).toBe(1);
  resize();
  expect(frames.size).toBe(0);
  expect(changed).toHaveBeenCalledOnce(); expect(b.state().focal).toBe(720);
  expect(viewport.read(scene.camera.projection.cssPerspective).bounds.width).toBe(900);
  unsubscribe(); viewport.destroy(); viewport.destroy();
  expect(disconnect).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
  expect(events.size).toBe(0);
});
