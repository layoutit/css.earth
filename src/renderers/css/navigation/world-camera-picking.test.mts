import { createCameraMotion } from './camera-motion.js';
import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { getEventListeners } from 'node:events';
import * as runtimePolicy from '../../../../site/runtime-policy.mts';
import runtimeDefinition from '../../../../src/objects/mercury/prepared/runtime.json' with { type: 'json' };
import { presentWorldCamera, worldCameraFromPresentation } from './world-camera.ts';
import type { PreparedWorldCameraFrame } from './world-camera.ts';
import type { CameraDelta } from './types.ts';
import { hitsProjectedBody } from './world-camera-hit.ts';
import { bindWorldCameraPicking } from './world-camera-picking.ts';
import { screenPicking } from './screen-picking.ts';
import { createUnboundedMatrixDragControls } from './camera-input.ts';

afterEach(() => vi.unstubAllGlobals());
const bounds = { x: 0, y: 0, width: 1000, height: 800 } satisfies Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;
// The shared world camera presents Mercury's physical radius through a 900 px focal length.
const radiusUnits = runtimeDefinition.camera.logicalBodyDiameter / 2;
const frame: PreparedWorldCameraFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2461287.5, originM: [0, 0, 0],
  presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1000, bodyRadiusM: radiusUnits * 1000 };
const project = (bodyCenterUnits: readonly [number, number, number]) => {
  const presented = presentWorldCamera(worldCameraFromPresentation({ rotation: [1,0,0,0,1,0,0,0,1], bodyCenterUnits }, frame),
    frame, { focalPixels: 900, principalOffsetPixels: [0, 0] });
  return { visible: presented.silhouette !== null, silhouette: presented.silhouette, translate: presented.translateCssPixels };
};

type FakeStyle = {
  cursor?: string;
  pointerEvents?: string;
  opacity?: string;
  '--object-hover-cursor'?: string;
  setProperty(name: string, value: string): void;
  removeProperty(name: string): void;
};
type FakePointerInit = EventInit & Partial<Pick<PointerEvent,
  'pointerId' | 'pointerType' | 'isPrimary' | 'button' | 'buttons' | 'clientX' | 'clientY' | 'detail' | 'ctrlKey'>>;

class FakePointer extends Event {
  static now = 0;
  stopped = false;
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  readonly button: number;
  readonly buttons: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly detail: number;
  readonly ctrlKey: boolean;
  constructor(type: string, init: FakePointerInit = {}) {
    super(type, { bubbles: init.bubbles ?? true, cancelable: init.cancelable ?? true });
    this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true; this.button = init.button ?? 0; this.buttons = init.buttons ?? 1;
    this.clientX = init.clientX ?? 550; this.clientY = init.clientY ?? 400; this.detail = init.detail ?? 0;
    this.ctrlKey = init.ctrlKey ?? false;
    Object.defineProperty(this, 'timeStamp', { value: FakePointer.now });
  }
  override stopImmediatePropagation(): void { this.stopped = true; super.stopImmediatePropagation(); }
  override stopPropagation(): void { this.stopped = true; super.stopPropagation(); }
}

class FakeSurface extends EventTarget {
  readonly dataset: DOMStringMap = {};
  readonly style: FakeStyle;
  ownerDocument!: Document;
  parentElement: FakeSurface | null = null;
  ariaDisabled: string | null = null;
  click: () => void = () => {};
  readonly captured = new Set<number>();
  constructor() {
    super();
    this.style = {
      setProperty: (name, value) => { Reflect.set(this.style, name, value); },
      removeProperty: name => { Reflect.deleteProperty(this.style, name); },
    };
  }
  closest(selector: string): FakeSurface | null {
    const matches = selector === '[data-context-orbit]' ? this.dataset.contextOrbit : this.dataset.contextGroup;
    return matches ? this : this.parentElement?.closest(selector) ?? null;
  }
  querySelector(): FakeSurface | null { return fakeDocument(this.ownerDocument).group; }
  contains(element: Node | null): boolean { return element === narrowElement(this) || (element instanceof FakeSurface && fakeDocument(this.ownerDocument).targets.includes(element)); }
  setPointerCapture(id: number): void { this.captured.add(id); }
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
  releasePointerCapture(id: number): void { this.captured.delete(id); }
  override dispatchEvent(event: Event): boolean {
    Object.defineProperty(event, 'target', { value: narrowElement(this), configurable: true });
    const document = fakeDocument(this.ownerDocument);
    document.window.dispatchEvent(event);
    if (!isStopped(event)) this.ownerDocument.dispatchEvent(event);
    return isStopped(event) ? false : super.dispatchEvent(event);
  }
}

interface FakeDocumentState { window: EventTarget & { requestAnimationFrame(callback: FrameRequestCallback): number; cancelAnimationFrame(id: number): void }; targets: FakeSurface[]; group: FakeSurface | null; }
const documentStates = new WeakMap<Document, FakeDocumentState>();
const fakeDocument = (document: Document): FakeDocumentState => {
  const state = documentStates.get(document);
  if (!state) throw new Error('Fake document state is unavailable.');
  return state;
};
// Runtime guards use these native constructors; the fake supplies exactly their consumed fields.
const narrowElement = (surface: FakeSurface): HTMLElement => surface as unknown as HTMLElement;
const narrowDocument = (document: EventTarget): Document => document as unknown as Document;
const isStopped = (event: Event): boolean => event instanceof FakePointer && event.stopped;
type Fixture = ReturnType<typeof fixture>;

function fixture(hitTest: (x: number, y: number) => boolean = () => false,
  detailOccludes: ((x: number, y: number) => boolean) | undefined = undefined) {
  let now = 0, nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>(), publications: CameraDelta[] = [];
  const window = Object.assign(new EventTarget(), { requestAnimationFrame(callback: FrameRequestCallback): number { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number): void { frames.delete(id); } });
  const document = narrowDocument(new EventTarget());
  // The test supplies only the native document fields consumed by the input owners.
  Reflect.defineProperty(document, 'defaultView', { value: window });
  documentStates.set(document, { window, targets: [], group: null });
  vi.stubGlobal('HTMLElement', FakeSurface); vi.stubGlobal('PointerEvent', FakePointer);
  const surface = new FakeSurface(), host = new FakeSurface();
  surface.ownerDocument = document; host.ownerDocument = document;
  const registry = screenPicking(narrowElement(host));
  const setTargets = (value: FakeSurface[]): void => {
    fakeDocument(document).targets = value;
    registry.publish(document, value.flatMap(element => {
      const direct = element.dataset.objectNavigate && element.style.pointerEvents === 'auto';
      const orbit = element.parentElement?.closest('[data-context-orbit]');
      const target = direct ? element : orbit?.dataset.objectNavigate && Number(element.style.opacity || 1) > .1 ? orbit : null;
      return target ? [{ element: narrowElement(target), rank: 0, shape: { kind: 'rect' as const, left: -100, top: -100, right: 100, bottom: 100 } }] : [];
    }));
  };
  const readBounds = () => ({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height });
  const controls = createUnboundedMatrixDragControls({ cameraMotion: createCameraMotion(), inputSurface: narrowElement(surface), runtimePolicy,
    trackballMetrics: () => ({ centerX: 500, centerY: 400, radius: 250, surfaceRadius: 250, focalLength: 900,
      viewportWidth: 1000, sceneMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }),
    surfaceFlyToState: () => ({ zoom: 1, minimumZoom: .5, maximumZoom: 4 }), surfaceFlyToHitTest: hitTest,
    rotate: value => publications.push(value) });
  let unbind = bindWorldCameraPicking(narrowElement(surface), narrowElement(host), readBounds, detailOccludes), selections = 0, interrupted = 0;
  const target = new FakeSurface(); target.ownerDocument = document;
  target.dataset.objectNavigate = 'venus'; target.style.pointerEvents = 'auto';
  target.click = () => { selections++; document.addEventListener('pointerdown', () => interrupted++); };
  return { controls, publications, document: { set targets(value: FakeSurface[]) { setTargets(value); }, get targets(): FakeSurface[] { return fakeDocument(document).targets; }, set group(value: FakeSurface | null) { fakeDocument(document).group = value; } }, window, target, surface, registry, host,
    get selections() { return selections; }, get interrupted() { return interrupted; },
    fire(type: string, time: number, data: FakePointerInit = {}) { now = time; FakePointer.now = now; surface.dispatchEvent(new FakePointer(type, data)); },
    tick(time: number) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
    handoff() { unbind(); unbind = bindWorldCameraPicking(narrowElement(surface), narrowElement(host), readBounds, detailOccludes); },
    destroy() { controls.destroy(); unbind(); },
  };
}
function firstClick(f: Fixture): void {
  f.fire('pointerdown', 0); f.fire('mousedown', 0, { detail: 1 });
  f.fire('pointerup', 20); f.fire('click', 20, { detail: 1 });
}
function secondClick(f: Fixture): void {
  f.fire('pointerdown', 100); f.fire('mousedown', 100, { detail: 2 });
  f.fire('pointerup', 120); f.fire('click', 120, { detail: 2 }); f.fire('dblclick', 120, { detail: 2 });
}

function cursor(surface: FakeSurface): string | undefined {
  return surface.style.cursor;
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
  assert.ok(close.silhouette);
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
  const hoverChanges: (string | undefined)[] = [];
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
  assert.equal(f.surface.style.cursor, '');
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
  const group = new FakeSurface(), orbit = new FakeSurface();
  const circle = new FakeSurface(), chord = new FakeSurface();
  group.dataset.contextGroup = 'venus';
  orbit.dataset.contextOrbit = 'venus'; orbit.parentElement = group;
  orbit.dataset.objectNavigate = 'venus'; orbit.click = f.target.click;
  orbit.style.pointerEvents = 'none';
  const block = new FakeSurface(); block.parentElement = orbit;
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
  const f = fixture(), orbit = new FakeSurface(), chord = new FakeSurface();
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
  const intents: unknown[] = [];
  f.host.addEventListener('objecthoverchange', event => { intents.push(event instanceof CustomEvent ? event.detail.interactive : event); });
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
  assert.deepEqual(intents, [true, false], 'camera repicking is not a new pointer hover');
  f.destroy();
});

test('empty-space clicks never deselect, while body hits still select', () => {
  const f = fixture(); let deselections = 0;
  f.host.addEventListener('objectdeselect', () => deselections++);
  firstClick(f); assert.equal(deselections, 0);
  f.fire('pointerdown', 600);
  f.fire('pointermove', 610, { clientX: 580 });
  f.fire('pointerup', 620, { clientX: 580 });
  f.fire('click', 620, { clientX: 580 });
  assert.equal(deselections, 0);
  f.fire('click', 900, { ctrlKey: true }); assert.equal(deselections, 0);
  f.document.targets = [f.target];
  f.fire('pointerdown', 1100); f.fire('pointerup', 1120); f.fire('click', 1120);
  assert.equal(f.selections, 1); assert.equal(deselections, 0);
  f.destroy();
  const detail = fixture(() => true, () => true);
  detail.host.addEventListener('objectdeselect', () => deselections++);
  firstClick(detail); assert.equal(deselections, 0);
  detail.destroy();
});
