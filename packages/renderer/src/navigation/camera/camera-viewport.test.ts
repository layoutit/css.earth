import { fixedCameraOrientation } from '../../../test/camera-orientation-fixture.mts';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createCameraViewport } from './camera-viewport.js';
import { createPerspectiveDolly } from './perspective-dolly.js';
import scene from '../../../../../src/objects/mercury/prepared/scene.json' with { type: 'json' };

test('prepared FOVs retain independent measurements across switches and resize together', () => {
  let width = 1000, reads = 0, resize!: () => void, refresh!: FrameRequestCallback;
  const remove = mock.fn(() => {});
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
  assert.equal(viewport.read('80cqw'), wide);
  assert.equal(viewport.read('120cqw'), narrow);
  assert.equal(reads, preparedReads);
  assert.equal(wide.focalPixels, 800); assert.equal(narrow.focalPixels, 1200);
  width = 700; resize();
  const resizedReads = reads;
  assert.equal(viewport.read('80cqw').focalPixels, 560);
  assert.equal(viewport.read('120cqw').focalPixels, 840);
  assert.equal(reads, resizedReads);
  viewport.destroy(); assert.equal(remove.mock.callCount(), 2);
});

test('one viewport snapshot survives camera mounts and refreshes on layout changes', () => {
  let width = 1200, reads = 0, resize!: () => void;
  const frames = new Map<number, FrameRequestCallback>(), events = new Map<string, () => void>();
  const remove = mock.fn(() => {}), disconnect = mock.fn(() => {});
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
  assert.equal(a.state().focal, 960); assert.equal(b.trackball().centerY, 380);
  assert.equal(viewport.read(scene.camera.projection.cssPerspective), first);
  assert.equal(reads, measured);
  const changed = mock.fn(() => b.remeasure()), unsubscribe = viewport.subscribe(changed);
  resize();
  assert.equal(viewport.read(scene.camera.projection.cssPerspective), first);
  assert.ok(reads > measured);
  assert.equal(frames.size, 0);
  assert.equal(changed.mock.callCount(), 0);
  width = 900; events.get('resize')!();
  assert.equal(frames.size, 1);
  resize();
  assert.equal(frames.size, 0);
  assert.equal(changed.mock.callCount(), 1); assert.equal(b.state().focal, 720);
  assert.equal(viewport.read(scene.camera.projection.cssPerspective).bounds.width, 900);
  unsubscribe(); viewport.destroy(); viewport.destroy();
  assert.equal(disconnect.mock.callCount(), 1); assert.equal(remove.mock.callCount(), 1);
  assert.equal(events.size, 0);
});
