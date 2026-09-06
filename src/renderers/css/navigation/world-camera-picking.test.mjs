import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { getEventListeners } from 'node:events';
import * as runtimePolicy from '../../../../site/runtime-policy.mjs';
import { runtimeDefinition } from '../../../planets/mercury/runtime/definition.mjs';
import { projectHeliocentricView } from '../solar-system/heliocentric-view.ts';
import { hitsProjectedBody } from './world-camera-hit.ts';
import { bindWorldCameraPicking } from './world-camera-picking.ts';
import { createUnboundedMatrixDragControls } from './camera-input.ts';

afterEach(() => vi.unstubAllGlobals());
const bounds = { x: 0, y: 0, width: 1000, height: 800 };
const project = bodyCenter => projectHeliocentricView(runtimeDefinition.heliocentricView.plan, {
  bodyCenter, distance: Math.hypot(...bodyCenter), rotation: [1,0,0,0,1,0,0,0,1],
  focal: 900, principalOffset: [0,0], viewportWidth: 1000, viewportHeight: 800,
}).body;

function fixture(hitTest = () => false) {
  let now = 0, nextFrame = 0;
  const frames = new Map(), publications = [], window = new EventTarget(), document = new EventTarget();
  Object.assign(window, { requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); } });
  document.defaultView = window;
  document.targets = [];
  document.elementsFromPoint = () => document.targets;
  class Pointer extends Event {
    stopped = false;
    constructor(type, init = {}) {
      super(type, { bubbles: true, cancelable: true });
      const { bubbles, cancelable, ...values } = init;
      Object.assign(this, { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1,
        clientX: 550, clientY: 400, detail: 0 }, values);
      Object.defineProperty(this, 'timeStamp', { value: now });
    }
    stopImmediatePropagation() { this.stopped = true; super.stopImmediatePropagation(); }
    stopPropagation() { this.stopped = true; super.stopPropagation(); }
  }
  class Surface extends EventTarget {
    ownerDocument = document;
    dataset = {};
    style = { removeProperty(name) { delete this[name]; } };
    captured = new Set();
    contains(element) { return element === this || document.targets.includes(element); }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
    dispatchEvent(event) {
      Object.defineProperty(event, 'target', { value: this, configurable: true });
      window.dispatchEvent(event);
      if (!event.stopped) document.dispatchEvent(event);
      if (!event.stopped) return super.dispatchEvent(event);
      return false;
    }
  }
  vi.stubGlobal('HTMLElement', Surface);
  vi.stubGlobal('PointerEvent', Pointer);
  const surface = new Surface(), host = new Surface();
  const controls = createUnboundedMatrixDragControls({ inputSurface: surface, runtimePolicy,
    trackballMetrics: () => ({ centerX: 500, centerY: 400, radius: 250, surfaceRadius: 250, focalLength: 900,
      sceneMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }),
    surfaceFlyToState: () => ({ zoom: 1, minimumZoom: .5, maximumZoom: 4 }), surfaceFlyToHitTest: hitTest,
    rotate: value => publications.push(value) });
  let unbind = bindWorldCameraPicking(surface, host), selections = 0, interrupted = 0;
  const target = new Surface();
  target.dataset.objectNavigate = 'venus'; target.style.pointerEvents = 'auto';
  target.click = () => { selections++; document.addEventListener('pointerdown', () => interrupted++); };
  return { controls, publications, document, window, target, surface,
    get selections() { return selections; }, get interrupted() { return interrupted; },
    fire(type, time, data = {}) { now = time; surface.dispatchEvent(new Pointer(type, data)); },
    tick(time) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
    handoff() { unbind(); unbind = bindWorldCameraPicking(surface, host); },
    destroy() { controls.destroy(); unbind(); },
  };
}
function firstClick(f) {
  f.fire('pointerdown', 0); f.fire('mousedown', 0, { detail: 1 });
  f.fire('pointerup', 20); f.fire('click', 20, { detail: 1 });
}
function secondClick(f) {
  f.fire('pointerdown', 100); f.fire('mousedown', 100, { detail: 2 });
  f.fire('pointerup', 120); f.fire('click', 120, { detail: 2 }); f.fire('dblclick', 120, { detail: 2 });
}

test('physical hit uses the actual translated ellipse and visible marker, never the enlarged drag radius', () => {
  const tiny = project([0,0,-2e7]);
  assert.equal(hitsProjectedBody(550, 400, tiny, bounds), false);
  assert.equal(hitsProjectedBody(500, 400, tiny, bounds), true);
  assert.equal(hitsProjectedBody(502, 400, tiny, bounds, { x: 497.5, y: 397.5, width: 5, height: 5 }), true);
  const behind = project([0,0,1000]), displaced = project([2000,0,-1000]);
  assert.equal(hitsProjectedBody(500, 400, behind, bounds), false);
  assert.equal(hitsProjectedBody(500, 400, displaced, bounds), false);
  const close = project([400,-50,-1400]);
  const [x, y] = close.silhouette.centre;
  assert.equal(hitsProjectedBody(500 + x, 400 + y, close, bounds), true);
  assert.equal(hitsProjectedBody(500 + x, 400 + y + close.silhouette.radialSemiAxis * 2, close, bounds), false);
});

test('empty sky native double-click produces no camera publication or automatic flight', () => {
  const tiny = project([0,0,-2e7]);
  const f = fixture((x,y) => hitsProjectedBody(x,y,tiny,bounds));
  firstClick(f); secondClick(f); f.tick(150); f.tick(5000);
  assert.equal(f.controls.stats().surfaceFlyTo.starts, 0);
  assert.deepEqual(f.publications, []);
  assert.equal(f.selections, 0); f.destroy();
});

test('a real close-body second press keeps its permitted surface flight and release never restarts it', () => {
  const body = project([0,0,-1000]);
  const f = fixture((x,y) => hitsProjectedBody(x,y,body,bounds));
  firstClick(f); secondClick(f);
  assert.equal(f.controls.stats().surfaceFlyTo.starts, 1);
  f.tick(150); f.tick(900);
  assert.ok(f.publications.length > 0);
  assert.equal(f.controls.stats().surfaceFlyTo.starts, 1); f.destroy();
});

test('an object double-click selects once across owner handoff and cannot interrupt or start a surface flight', () => {
  const f = fixture(() => true);
  f.document.targets = [f.target]; firstClick(f);
  assert.equal(f.selections, 1);
  f.handoff(); f.document.targets = [];
  secondClick(f); f.tick(5000);
  assert.equal(f.selections, 1);
  assert.equal(f.interrupted, 0);
  assert.equal(f.controls.stats().surfaceFlyTo.starts, 0);
  f.destroy();
  assert.equal(getEventListeners(f.window, 'pointerdown').length, 0);
});

test('the coalesced second press still becomes a real native drag when it moves', () => {
  const f = fixture(); f.document.targets = [f.target]; firstClick(f);
  f.fire('pointerdown', 100);
  f.fire('pointermove', 120, { clientX: 580 }); f.tick(130);
  assert.equal(f.interrupted, 1);
  assert.ok(f.publications.length > 0);
  f.fire('pointerup', 140, { clientX: 580 }); f.destroy();
});

test('blank clicks after the native double-click interval are not swallowed', () => {
  const f = fixture(); f.document.targets = [f.target]; firstClick(f);
  f.document.targets = [];
  f.fire('pointerdown', 600);
  assert.equal(f.interrupted, 1);
  f.fire('pointerup', 620); f.destroy();
});
