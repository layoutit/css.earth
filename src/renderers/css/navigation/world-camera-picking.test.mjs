import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { getEventListeners } from 'node:events';
import * as runtimePolicy from '../../../../site/runtime-policy.mts';
import runtimeDefinition from '../../../../src/planets/mercury/prepared/runtime.json' with { type: 'json' };
import { projectHeliocentricView } from '../solar-system/heliocentric-view.ts';
import { hitsProjectedBody } from './world-camera-hit.ts';
import { bindWorldCameraPicking } from './world-camera-picking.ts';
import { screenPicking } from './screen-picking.ts';
import { createUnboundedMatrixDragControls } from './camera-input.ts';

afterEach(() => vi.unstubAllGlobals());
const bounds = { x: 0, y: 0, width: 1000, height: 800 };
const project = bodyCenter => projectHeliocentricView(runtimeDefinition.heliocentricView.plan, {
  bodyCenter, distance: Math.hypot(...bodyCenter), rotation: [1,0,0,0,1,0,0,0,1],
  focal: 900, principalOffset: [0,0], viewportWidth: 1000, viewportHeight: 800,
}).body;

function fixture(hitTest = () => false, detailOccludes) {
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
    style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
    parentElement = null;
    closest(selector) {
      const matches = selector === '[data-context-orbit]' ? this.dataset.contextOrbit : this.dataset.contextGroup;
      return matches ? this : this.parentElement?.closest(selector) ?? null;
    }
    querySelector() { return document.group ?? null; }
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
  const registry = screenPicking(host);
  let targets = [];
  Object.defineProperty(document, 'targets', { get: () => targets, set(value) {
    targets = value;
    registry.publish(document, value.flatMap(element => {
      const direct = element.dataset.objectNavigate && element.style.pointerEvents === 'auto';
      const orbit = element.parentElement?.closest('[data-context-orbit]');
      const target = direct ? element : orbit?.dataset.objectNavigate && Number(element.style.opacity || 1) > .1 ? orbit : null;
      return target ? [{ element: target, rank: 0, shape: { kind: 'rect', left: -100, top: -100, right: 100, bottom: 100 } }] : [];
    }));
  } });
  document.elementsFromPoint = () => { throw new Error('Input must not search rendered DOM'); };
  const readBounds = () => ({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height });
  const controls = createUnboundedMatrixDragControls({ inputSurface: surface, runtimePolicy,
    trackballMetrics: () => ({ centerX: 500, centerY: 400, radius: 250, surfaceRadius: 250, focalLength: 900,
      sceneMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }),
    surfaceFlyToState: () => ({ zoom: 1, minimumZoom: .5, maximumZoom: 4 }), surfaceFlyToHitTest: hitTest,
    rotate: value => publications.push(value) });
  let unbind = bindWorldCameraPicking(surface, host, readBounds, detailOccludes), selections = 0, interrupted = 0;
  const target = new Surface();
  target.dataset.objectNavigate = 'venus'; target.style.pointerEvents = 'auto';
  target.click = () => { selections++; document.addEventListener('pointerdown', () => interrupted++); };
  return { controls, publications, document, window, target, surface, registry, host,
    get selections() { return selections; }, get interrupted() { return interrupted; },
    fire(type, time, data = {}) { now = time; surface.dispatchEvent(new Pointer(type, data)); },
    tick(time) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
    handoff() { unbind(); unbind = bindWorldCameraPicking(surface, host, readBounds, detailOccludes); },
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

function cursor(surface) {
  const fallback = /var\(--object-hover-cursor, (\w+)\)/.exec(surface.style.cursor ?? '');
  return fallback ? surface.style['--object-hover-cursor'] ?? fallback[1] : surface.style.cursor;
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

test('a background target overlapping detailed surface pixels cannot steal hover or surface double-click', () => {
  let occluded = true;
  const f = fixture(() => true, () => occluded);
  f.document.targets = [f.target];
  f.fire('pointermove', 0, { buttons: 0 }); f.tick(1);
  assert.equal(f.target.dataset.objectHovered, undefined);
  assert.equal(cursor(f.surface), 'grab');
  firstClick(f); secondClick(f);
  assert.equal(f.selections, 0);
  assert.equal(f.controls.stats().surfaceFlyTo.starts, 1);
  // The same retained background target remains navigable outside the surface,
  // and in overview where no detailed geometry occludes it.
  occluded = false;
  f.fire('pointermove', 600, { buttons: 0 }); f.tick(601);
  assert.equal(f.target.dataset.objectHovered, 'true');
  f.fire('pointerdown', 650); f.fire('pointerup', 670); f.fire('click', 670);
  assert.equal(f.selections, 1);
  f.destroy();
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

test('hover uses the same retained target as picking and restores the input cursor', () => {
  const f = fixture(() => true);
  const hoverChanges = [];
  f.host.addEventListener('objecthoverchange', () => hoverChanges.push(f.target.dataset.objectHovered));
  f.document.targets = [f.target];
  f.fire('pointermove', 0, { buttons: 0 }); f.tick(1);
  assert.equal(f.target.dataset.objectHovered, 'true');
  assert.equal(cursor(f.surface), 'pointer');
  assert.equal(f.selections, 0);
  f.document.targets = [];
  f.fire('pointermove', 10, { buttons: 0 }); f.tick(11);
  assert.equal(f.target.dataset.objectHovered, undefined);
  assert.equal(cursor(f.surface), 'grab');
  assert.deepEqual(hoverChanges, ['true', undefined]);
  f.document.targets = [f.target];
  f.target.ariaDisabled = 'true';
  f.fire('pointermove', 20, { buttons: 0 }); f.tick(21);
  assert.equal(f.target.dataset.objectHovered, undefined);
  f.target.ariaDisabled = 'false';
  f.fire('pointermove', 30, { buttons: 0, pointerType: 'touch' }); f.tick(31);
  assert.equal(f.target.dataset.objectHovered, undefined);
  f.fire('pointermove', 40, { buttons: 0 }); f.tick(41);
  f.destroy();
  assert.equal(f.target.dataset.objectHovered, undefined);
  assert.equal(f.surface.style.cursor, undefined);
  assert.equal(f.surface.style['--object-hover-cursor'], undefined);
  assert.equal(getEventListeners(f.surface, 'pointerleave').length, 0);
  assert.equal(getEventListeners(f.window, 'blur').length, 0);
});

test('sky and surface hover cursors follow the physical hit and both use grabbing during a drag', () => {
  let bodyVisible = true;
  const f = fixture(x => bodyVisible && x < 600);
  f.fire('pointermove', 0, { buttons: 0, clientX: 750 }); f.tick(1);
  assert.equal(cursor(f.surface), 'crosshair');
  f.fire('pointerdown', 10, { clientX: 750 });
  f.fire('pointermove', 20, { clientX: 550 });
  assert.equal(cursor(f.surface), 'grabbing');
  f.fire('pointerup', 30, { clientX: 550 });
  assert.equal(cursor(f.surface), 'grab');
  f.fire('pointerdown', 40, { clientX: 550 });
  assert.equal(cursor(f.surface), 'grabbing');
  f.fire('pointermove', 50, { clientX: 750 });
  assert.equal(cursor(f.surface), 'grabbing');
  f.fire('pointerup', 60, { clientX: 750 });
  assert.equal(cursor(f.surface), 'crosshair');
  f.fire('pointermove', 70, { buttons: 0, clientX: 550 }); f.tick(71);
  assert.equal(cursor(f.surface), 'grab');
  bodyVisible = false;
  f.controls.invalidateTrackball();
  assert.equal(cursor(f.surface), 'crosshair');
  f.controls.update({ drag: false });
  assert.equal(cursor(f.surface), '');
  f.destroy();
});

test('hover clears before a drag and on leaving the scene', () => {
  const f = fixture(); f.document.targets = [f.target];
  f.fire('pointermove', 0, { buttons: 0 }); f.tick(1);
  f.fire('pointerdown', 10);
  assert.equal(f.target.dataset.objectHovered, undefined);
  f.fire('pointermove', 20, { buttons: 1, clientX: 580 });
  assert.equal(f.target.dataset.objectHovered, undefined);
  f.fire('pointerup', 30);
  f.fire('pointermove', 40, { buttons: 0 }); f.tick(41);
  assert.equal(f.target.dataset.objectHovered, 'true');
  f.fire('pointerleave', 50, { buttons: 0 });
  assert.equal(f.target.dataset.objectHovered, undefined);
  f.destroy();
});


test('label, circle and visible orbit share hover, pointer cursor and single-click navigation', () => {
  const f = fixture();
  const group = new f.target.constructor(), orbit = new f.target.constructor();
  const circle = new f.target.constructor(), chord = new f.target.constructor();
  group.dataset.contextGroup = 'venus';
  orbit.dataset.contextOrbit = 'venus'; orbit.parentElement = group;
  orbit.dataset.objectNavigate = 'venus'; orbit.click = f.target.click;
  orbit.style.pointerEvents = 'none';
  const block = new f.target.constructor(); block.parentElement = orbit;
  chord.parentElement = block;
  f.target.parentElement = circle.parentElement = group;
  circle.dataset.objectNavigate = 'venus'; circle.style.pointerEvents = 'auto';
  for (const target of [f.target, circle, chord]) {
    f.document.targets = [target];
    f.fire('pointermove', 0, { buttons: 0 }); f.tick(1);
    assert.equal(group.dataset.objectHovered, 'true');
    assert.equal(cursor(f.surface), 'pointer');
  }
  firstClick(f);
  assert.equal(f.selections, 1);
  assert.equal(group.dataset.objectHovered, undefined);
  f.document.targets = [chord]; f.fire('pointermove', 30, { buttons: 0 }); f.tick(31);
  f.document.targets = []; f.fire('pointermove', 40, { buttons: 0 }); f.tick(41);
  assert.equal(group.dataset.objectHovered, undefined);
  f.document.group = group; f.target.parentElement = null;
  f.document.targets = [f.target]; f.fire('pointermove', 50, { buttons: 0 }); f.tick(51);
  assert.equal(group.dataset.objectHovered, 'true', 'the separate Sun point can highlight its context owner');
  f.destroy();
});

test('faded orbit chords and empty orbit groups cannot select a body', () => {
  const f = fixture(), orbit = new f.target.constructor(), chord = new f.target.constructor();
  orbit.dataset.contextOrbit = orbit.dataset.objectNavigate = 'venus';
  orbit.style.pointerEvents = 'none'; orbit.click = f.target.click;
  chord.parentElement = orbit; chord.style.opacity = '.01';
  for (const targets of [[orbit], [chord]]) {
    f.document.targets = targets;
    firstClick(f);
    assert.equal(f.selections, 0);
  }
  f.destroy();
});


test('hover coalesces pointer events and follows the latest published targets while stationary', () => {
  const f = fixture();
  const pick = vi.spyOn(f.registry, 'pick');
  f.document.targets = [f.target];
  f.fire('pointermove', 1, { buttons: 0 });
  f.fire('pointermove', 2, { buttons: 0 });
  f.fire('pointermove', 3, { buttons: 0 });
  assert.equal(pick.mock.calls.length, 0);
  f.tick(16);
  assert.equal(pick.mock.calls.length, 1);
  assert.equal(f.target.dataset.objectHovered, 'true');
  f.document.targets = [];
  f.tick(32);
  assert.equal(f.target.dataset.objectHovered, undefined);
  f.destroy();
});

test('only an unmodified empty-space click requests deselection, never a drag, body hit or control click', () => {
  const f = fixture(); let deselections = 0;
  f.host.addEventListener('objectdeselect', () => deselections++);
  firstClick(f); assert.equal(deselections, 1);
  f.fire('pointerdown', 600);
  f.fire('pointermove', 610, { clientX: 580 });
  f.fire('pointerup', 620, { clientX: 580 });
  f.fire('click', 620, { clientX: 580 });
  assert.equal(deselections, 1);
  f.fire('click', 900, { ctrlKey: true }); assert.equal(deselections, 1);
  f.document.targets = [f.target];
  f.fire('pointerdown', 1100); f.fire('pointerup', 1120); f.fire('click', 1120);
  assert.equal(f.selections, 1); assert.equal(deselections, 1);
  f.destroy();
  const detail = fixture(() => true, () => true);
  detail.host.addEventListener('objectdeselect', () => deselections++);
  firstClick(detail); assert.equal(deselections, 1);
  detail.destroy();
});
