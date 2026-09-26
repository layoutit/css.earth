import { afterEach, expect, test, vi } from 'vitest';
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

afterEach(() => vi.useRealTimers());

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
  expect(publish(800, 600)).toHaveLength(3);
  expect(publish(200, 600)).toHaveLength(1);
  expect(publish(800, 600)).toHaveLength(3);
  expect(publish(800, 20)).toHaveLength(0);
  labels.destroy();
});

test('retained environment captions keep fixed 3D anchors while visibility, physical opacity and blockers fade reversibly', () => {
  vi.useFakeTimers();
  const { host, labels, nodes, clock } = mount(), retained = [...host.children, ...labels.root.children];
  expect(labels.root.className).toBe('prepared-environment-labels');
  expect(nodes['deep-cloud']!.textContent).toBe('Authored Galaxy');
  expect(nodes['outer-shell']!.textContent).toBe('Outer Shell');
  expect(nodes['deep-cloud']!.className).toBe('prepared-context-label');

  // Captions measure themselves when first shown, never at mount: measuring
  // there flushed the whole starting page's layout for far-out labels.
  const measured = () => Object.values(nodes).reduce((sum, node) => sum + (node as unknown as FakeElement).measurements, 0);
  expect(measured()).toBe(0);
  const first = labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  const measurements = measured();
  expect(measurements, 'Each shown caption reads its own width and height once').toBe(Object.keys(nodes).length * 2);
  expect(first).toHaveLength(3);
  expect(nodes['deep-cloud']!.style.transform).toBe('translate(0px,47px) translate(-50%,-100%)');
  expect(nodes['deep-cloud']!.style.opacity).toBe('0');
  expect(nodes['outer-shell']!.style.transform).toBe('translate(200px,-45.5px) translate(-50%,-100%)');
  clock.frame(100);
  expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.325, 12);
  expect(Number(nodes['outer-shell']!.style.opacity)).toBeCloseTo(.13, 12);
  clock.frame(100);
  expect(nodes['deep-cloud']!.style.opacity).toBe('0.65');
  expect(nodes['outer-shell']!.style.opacity).toBe('0.26');
  expect(labels.labelExclusionRects()).toBe(first);

  labels.publish({ world: world([0, 0, 150]), viewport, shellStats: [stats(.4), stats(.6)] });
  expect(nodes['deep-cloud']!.style.transform).toBe('translate(0px,72px) translate(-50%,-100%)');
  clock.frame(100); expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.4875, 12);
  clock.frame(100); expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.325, 12);
  labels.publish({ world: world([0, 0, 50]), viewport, shellStats: [stats(.4), stats(.6)] });
  // Inside the volume the caption fades to nothing, so it keeps the last anchor
  // it committed instead of tracking one it will not show.
  expect(nodes['deep-cloud']!.style.transform).toBe('translate(0px,72px) translate(-50%,-100%)');
  clock.frame(100); expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.1625, 12);
  expect(nodes['deep-cloud']!.style.visibility).toBe('');
  labels.publish({ world: world([0, 0, 150]), viewport, shellStats: [stats(.4), stats(.6)] });
  clock.frame(100); expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.24375, 12);
  vi.advanceTimersByTime(200); expect(nodes['deep-cloud']!.style.visibility).toBe('');

  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  clock.frame(200);
  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(0), stats(.6)] });
  clock.frame(100); vi.advanceTimersByTime(100); expect(Number(nodes['outer-shell']!.style.opacity)).toBeCloseTo(.13, 12);
  expect(nodes['outer-shell']!.style.visibility).toBe('');
  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(0), stats(.6)] });
  clock.frame(100); vi.advanceTimersByTime(100); expect(nodes['outer-shell']!.style.visibility).toBe('hidden');
  const visible = labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  expect(visible.at(-1)).toBeDefined();
  clock.frame(200);
  labels.publish({ world: world([0, 0, 150]), viewport, shellStats: [stats(.4), stats(.6)],
    blockerRects: [{ left: -400, top: -300, right: 400, bottom: 300 }] });
  expect(nodes['deep-cloud']!.style.transform).toBe('translate(0px,72px) translate(-50%,-100%)');
  clock.frame(100); expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.325, 12);
  labels.publish({ world: world([0, 0, 300]), viewport, shellStats: [stats(.4), stats(.6)] });
  clock.frame(100); expect(Number(nodes['deep-cloud']!.style.opacity)).toBeCloseTo(.4875, 12);
  vi.advanceTimersByTime(200); expect(nodes['deep-cloud']!.style.visibility).toBe('');
  expect([...host.children, ...labels.root.children]).toEqual(retained);

  expect(Object.values(nodes).reduce((sum, node) => sum + (node as unknown as FakeElement).measurements, 0)).toBe(measurements);
  labels.publish({ world: world([0, 0, -300]), viewport, shellStats: [stats(.4), stats(.6)] });
  expect(nodes['deep-cloud']!.style.visibility).toBe('hidden');
  const quarterTurn = Math.SQRT1_2;
  labels.publish({ world: { ...world([0, 0, 300]), pose: { positionM: [0, 0, 300], orientationXyzw: [0, 0, quarterTurn, quarterTurn] } },
    viewport, shellStats: [stats(.4), stats(.6)] });
  expect(nodes['deep-cloud']!.style.transform).toBe('translate(0px,47px) translate(-50%,-100%)');
  labels.publish({ world: world([0, 0, 300]), viewport: { ...viewport, principalOffsetPixels: [1_000, 0] }, shellStats: [stats(.4), stats(.6)] });
  expect(nodes['deep-cloud']!.style.visibility).toBe('');
  labels.destroy();
  expect(clock.pending.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  expect(host.children).toEqual([retained[1]]); labels.destroy();
});


test('an authored environment link is interactive only while its caption is admitted', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const labels = mountEnvironmentLabels({host:host as unknown as HTMLElement,before:before as unknown as Element,
    volume,shells:[],links:{'deep-cloud':'/sun/?overview=milky-way'}});
  const label=labels.inspect()['deep-cloud']!;
  expect(label.getAttribute('href')).toBe('/sun/?overview=milky-way');
  const publication={world:world([0,0,300]),viewport:{...viewport,widthPixels:800,heightPixels:600},shellStats:[],volumeLabelOpacity:1};
  labels.publish(publication);
  expect(label.style.pointerEvents).toBe('auto');
  const rect=labels.labelExclusionRects()[0]!;
  const picking=screenPicking(host as unknown as HTMLElement);
  expect(picking.pick((rect.left+rect.right)/2,(rect.top+rect.bottom)/2)).toBe(label);
  labels.publish({...publication,volumeLabelOpacity:0});
  expect(label.style.pointerEvents).toBe('none');
  expect(picking.pick((rect.left+rect.right)/2,(rect.top+rect.bottom)/2)).toBeNull();
  labels.destroy();
});
