import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { screenPicking } from '../navigation/screen-picking.js';
import { mountEnvironmentLabels } from './environment-labels.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import type { PreparedCssVolume } from '../volume/types.js';

class FakeElement {
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = ''; textContent = ''; ariaHidden: string | null = null;
  clientWidth = 800; clientHeight = 600; measurements = 0;
  readonly ownerDocument: FakeDocument;
  constructor(ownerDocument: FakeDocument) { this.ownerDocument = ownerDocument;}
  attributes = new Map<string,string>();
  setAttribute(key:string,value:string) { this.attributes.set(key,value); }
  getAttribute(key:string) { return this.attributes.get(key) ?? null; }
  get offsetWidth() { this.measurements++; return this.textContent.length * 7; }
  get offsetHeight() { this.measurements++; return 14; }
  appendChild(child: FakeElement) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.remove(); child.parentNode = this; const at = before ? this.children.indexOf(before) : -1;
    this.children.splice(at < 0 ? this.children.length : at, 0, child); return child;
  }
  remove() { if (!this.parentNode) return; const at = this.parentNode.children.indexOf(this); if (at >= 0) this.parentNode.children.splice(at, 1); this.parentNode = null; }
}
class FakeWindow {
  now = 0; next = 0; pending = new Map<number, (time: number) => void>(); cancelled: number[] = [];
  readonly performance = { now: () => this.now };
  requestAnimationFrame = (callback: (time: number) => void) => { const id = ++this.next; this.pending.set(id, callback); return id; };
  cancelAnimationFrame = (id: number) => { this.cancelled.push(id); this.pending.delete(id); };
  frame(milliseconds: number) { this.now += milliseconds; const callbacks = [...this.pending.values()]; this.pending.clear(); for (const callback of callbacks) callback(this.now); }
}
class FakeDocument { readonly defaultView = new FakeWindow(); createElement() { return new FakeElement(this); } }

const bounds = { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
const frame = (originM: [number, number, number]) => ({ referenceFrame: 'sun-icrf', epochJdTt: 1, originM,
  localToReferenceXyzw: [0, 0, 0, 1] as [number, number, number, number], metersPerUnit: 100, boundsUnits: bounds });
const volume = { id: 'deep-cloud', frame: frame([0, 0, 0]) } as unknown as PreparedCssVolume;
const shellBounds = { min: [-2, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
const shellFrame = (originM: [number, number, number]) => ({ ...frame(originM), boundsUnits: shellBounds });
const shell = { id: 'outer-shell', frame: shellFrame([600, 0, 0]), visibility: {
  hiddenInsideM: 100, fullUntilM: 900, hiddenBeyondM: 1_000 } } as unknown as PreparedCssSurfaceShell;
const innerShell = { ...shell, id: 'inner-bubble', frame: shellFrame([-600, 0, 0]) } as PreparedCssSurfaceShell;
const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const };
const world = (positionM: [number, number, number]) => ({ referenceFrame: 'sun-icrf', epochJdTt: 1,
  pose: { positionM, orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } });
const stats = (opacity: number, distanceM = 671) => ({ visible: opacity > 0, opacity, distanceM,
  visibleFaces: opacity > 0 ? 1 : 0, totalFaces: 2, atlasFrames: 1 });

function mount() {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const labels = mountEnvironmentLabels({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    volume, shells: [shell, innerShell], names: { 'deep-cloud': 'Authored Galaxy' } });
  return { host, labels, nodes: labels.inspect(), clock: document.defaultView };
}

afterEach(() => mock.timers.reset());

test('camera viewport snapshots drive clipping and resize without reading layout after scene publication', () => {
  const { host, labels } = mount();
  Object.defineProperties(host, {
    clientWidth: { get() { throw new Error('Publication flushed host layout'); } },
    clientHeight: { get() { throw new Error('Publication flushed host layout'); } },
  });
  const publish = (widthPixels: number, heightPixels: number) => labels.publish({
    world: world([0, 0, 300]), viewport: { ...viewport, widthPixels, heightPixels },
    shellStats: [stats(.4), stats(.6)],
  });
  assert.equal(publish(800, 600).length, 3);
  assert.equal(publish(200, 600).length, 1);
  assert.equal(publish(800, 600).length, 3);
  assert.equal(publish(800, 20).length, 0);
  labels.destroy();
});

test('retained environment captions keep fixed 3D anchors while visibility, physical opacity and blockers fade reversibly', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'setImmediate', 'Date'] });
  const { host, labels, nodes, clock } = mount(), retained = [...host.children, ...labels.root.children];
  assert.equal(labels.root.className, 'prepared-environment-labels');
  assert.equal(nodes['deep-cloud']!.textContent, 'Authored Galaxy');
  assert.equal(nodes['outer-shell']!.textContent, 'Outer Shell');
  assert.equal(nodes['deep-cloud']!.className, 'prepared-context-label');

  // Captions measure themselves when first shown, never at mount: measuring
  // there flushed the whole starting page's layout for far-out labels.
  const measured = () => Object.values(nodes).reduce((sum, node) => sum + (node as unknown as FakeElement).measurements, 0);
  assert.equal(measured(), 0);
  const first = labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  const measurements = measured();
  assert.equal(measurements, Object.keys(nodes).length * 2, 'Each shown caption reads its own width and height once');
  assert.equal(first.length, 3);
  assert.equal(nodes['deep-cloud']!.style.transform, 'translate(0px,47px) translate(-50%,-100%)');
  assert.equal(nodes['deep-cloud']!.style.opacity, '0');
  assert.equal(nodes['outer-shell']!.style.transform, 'translate(200px,-45.5px) translate(-50%,-100%)');
  clock.frame(100);
  assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.325)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.325}`);
  assert.ok(Math.abs(Number(nodes['outer-shell']!.style.opacity) - (.13)) < 10 ** -12 / 2, `${Number(nodes['outer-shell']!.style.opacity)} is not close to ${.13}`);
  clock.frame(100);
  assert.equal(nodes['deep-cloud']!.style.opacity, '0.65');
  assert.equal(nodes['outer-shell']!.style.opacity, '0.26');
  assert.equal(labels.labelExclusionRects(), first);

  labels.publish({ world: world([0, 0, 150]), viewport, shellStats: [stats(.4), stats(.6)] });
  assert.equal(nodes['deep-cloud']!.style.transform, 'translate(0px,72px) translate(-50%,-100%)');
  clock.frame(100); assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.4875)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.4875}`);
  clock.frame(100); assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.325)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.325}`);
  labels.publish({ world: world([0, 0, 50]), viewport, shellStats: [stats(.4), stats(.6)] });
  // Inside the volume the caption fades to nothing, so it keeps the last anchor
  // it committed instead of tracking one it will not show.
  assert.equal(nodes['deep-cloud']!.style.transform, 'translate(0px,72px) translate(-50%,-100%)');
  clock.frame(100); assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.1625)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.1625}`);
  assert.equal(nodes['deep-cloud']!.style.visibility, '');
  labels.publish({ world: world([0, 0, 150]), viewport, shellStats: [stats(.4), stats(.6)] });
  clock.frame(100); assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.24375)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.24375}`);
  mock.timers.tick(200); assert.equal(nodes['deep-cloud']!.style.visibility, '');

  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  clock.frame(200);
  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(0), stats(.6)] });
  clock.frame(100); mock.timers.tick(100); assert.ok(Math.abs(Number(nodes['outer-shell']!.style.opacity) - (.13)) < 10 ** -12 / 2, `${Number(nodes['outer-shell']!.style.opacity)} is not close to ${.13}`);
  assert.equal(nodes['outer-shell']!.style.visibility, '');
  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(0), stats(.6)] });
  clock.frame(100); mock.timers.tick(100); assert.equal(nodes['outer-shell']!.style.visibility, 'hidden');
  const visible = labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  assert.notEqual(visible.at(-1), undefined);
  clock.frame(200);
  labels.publish({ world: world([0, 0, 150]), viewport, shellStats: [stats(.4), stats(.6)],
    blockerRects: [{ left: -400, top: -300, right: 400, bottom: 300 }] });
  assert.equal(nodes['deep-cloud']!.style.transform, 'translate(0px,72px) translate(-50%,-100%)');
  clock.frame(100); assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.325)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.325}`);
  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  clock.frame(100); assert.ok(Math.abs(Number(nodes['deep-cloud']!.style.opacity) - (.4875)) < 10 ** -12 / 2, `${Number(nodes['deep-cloud']!.style.opacity)} is not close to ${.4875}`);
  mock.timers.tick(200); assert.equal(nodes['deep-cloud']!.style.visibility, '');
  assert.deepEqual(([...host.children, ...labels.root.children]), retained);

  assert.equal(Object.values(nodes).reduce((sum, node) => sum + (node as unknown as FakeElement).measurements, 0), measurements);
  labels.publish({ world: world([0, 0, -300]), viewport, shellStats: [stats(.4), stats(.6)] });
  assert.equal(nodes['deep-cloud']!.style.visibility, 'hidden');
  const quarterTurn = Math.SQRT1_2;
  labels.publish({ world: { ...world([0, 0, 300]), pose: { positionM: [0, 0, 300], orientationXyzw: [0, 0, quarterTurn, quarterTurn] } },
    viewport, shellStats: [stats(.4), stats(.6)] });
  assert.equal(nodes['deep-cloud']!.style.transform, 'translate(0px,47px) translate(-50%,-100%)');
  labels.publish({ world: world([0, 0, 300]), viewport: { ...viewport, principalOffsetPixels: [1_000, 0] }, shellStats: [stats(.4), stats(.6)] });
  assert.equal(nodes['deep-cloud']!.style.visibility, '');
  labels.destroy();
  assert.equal(clock.pending.size, 0);  assert.deepEqual(host.children, [retained[1]]); labels.destroy();
});


test('an authored environment link is interactive only while its caption is admitted', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const labels = mountEnvironmentLabels({host:host as unknown as HTMLElement,before:before as unknown as Element,
    volume,shells:[],links:{'deep-cloud':'/milky-way/'}});
  const label=labels.inspect()['deep-cloud']!;
  assert.equal(label.getAttribute('href'), '/milky-way/');
  const publication={world:world([0,0,300]),viewport:{...viewport,widthPixels:800,heightPixels:600},shellStats:[],volumeLabelOpacity:1};
  labels.publish(publication);
  assert.equal(label.style.pointerEvents, 'auto');
  const rect=labels.labelExclusionRects()[0]!;
  const picking=screenPicking(host as unknown as HTMLElement);
  assert.equal(picking.pick((rect.left+rect.right)/2,(rect.top+rect.bottom)/2), label);
  labels.publish({...publication,volumeLabelOpacity:0});
  assert.equal(label.style.pointerEvents, 'none');
  assert.equal(picking.pick((rect.left+rect.right)/2,(rect.top+rect.bottom)/2), null);
  labels.destroy();
});

test('a published stellar extent hangs the caption under the drawn volume and hides it inside the extent', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const labels = mountEnvironmentLabels({ host: host as unknown as HTMLElement, before: before as unknown as Element, volume, shells: [], extentRadiusM: 150 });
  const label = labels.inspect()['deep-cloud']!;
  const publish = (z: number) => labels.publish({ world: world([0, 0, z]), viewport: { ...viewport, widthPixels: 800, heightPixels: 600 }, shellStats: [] });
  // The drawn sphere (the frame's 1-unit half extent) seen from 3 units drops 33.333 px; the caption's bottom is 8 px gap
  // and 14 px of text below that.
  publish(300);
  assert.equal(label.style.transform, 'translate(0px,55.333px) translate(-50%,-100%)');
  assert.equal(labels.labelExclusionRects().length, 1);
  assert.equal((labels.root as unknown as FakeElement).children.some(node => node.className === 'prepared-context-marker'), false, 'no ring is drawn');
  // Inside the 1.5-unit extent the camera is within the galaxy, and its caption hides.
  publish(120);
  assert.equal(labels.labelExclusionRects().length, 0);
  labels.destroy();
});

test('without a published extent the volume keeps its caption where it was', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  assert.throws(() => mountEnvironmentLabels({ host: host as unknown as HTMLElement, before: before as unknown as Element, volume, shells: [], extentRadiusM: 0 }), /deep-cloud: stellar extent must be a positive radius/);
});
