import type { OrientationXyzw, PhysicalCameraPose } from '@cssearth/engine';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import { required } from '../../../../tools/contract/test-values.mts';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import { decodeWorldOrbitBank, decodeWorldOrbits, orbitVertices, parsePreparedWorldContext, parsePreparedWorldContextSummary } from '../prepared-data/world-context.js';
import { mountPreparedWorldContext } from './prepared-world-context.js';
import { worldContextGeometry } from '../prepared-data/world-context.js';
import type { WorldContextFrame } from './world-context/world-context-frame.js';
import type { PlannedWorldContext } from './world-context/world-context-planner.js';
import { preparedVolumeOpacity } from './world-context/context-scale.js';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import { screenPicking } from '../navigation/screen-picking.js';
import { createWorldContextFrameEncoder } from './world-context/world-context-frame.js';
import { createWorldContextPlanner } from './world-context/world-context-planner.js';
import { CONTEXT_LINE_WIDTH, INDICATOR_DOT_MAX_DIAMETER, indicatorDotDiameter } from './world-context/context-scale.js';
import { SCENE_OBJECTS } from '../../../../site/objects.mts';
import { labelImportance } from '../labels/universe-label-policy.js';
import { SYSTEM_RANGES, SYSTEM_VIEWS, SYSTEM_VIEW_HOSTS, loadSystemView, systemFramingRect, systemViewTarget } from '../../../../site/system-framing.mts';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, async host => JSON.parse(await (await import('node:fs/promises')).readFile(new URL(`../../../../src/objects/sun/prepared/system-views/${host}.json`, import.meta.url), 'utf8')))));

// The production publisher only accepts encoded frames. Tests run the actual
// planner inline and supply that same protocol without starting a browser worker.
function mountTestContext({ annotationPriorities, annotationLandmarks, ...options }:
  Parameters<typeof mountPreparedWorldContext>[0] & { annotationPriorities?: Readonly<Record<string, number>>; annotationLandmarks?: readonly string[] }) {
  let latest: [WorldCameraPose, Parameters<ReturnType<typeof mountPreparedWorldContext>['publish']>[1]] | null = null;
  let planner: ReturnType<typeof createWorldContextPlanner> | undefined, sequence = 0;
  const encode = createWorldContextFrameEncoder();
  const layer = mountPreparedWorldContext({ ...options, requestPublication() {
    if (options.requestPublication?.()) return true;
    if (latest && options.plan.schema === 'cssearth-world-context@1') publish(...latest);
    return true;
  } });
  function publish(world: WorldCameraPose, viewport: Parameters<typeof layer.publish>[1], frame?: WorldContextFrame | PlannedWorldContext) {
    latest = [world, viewport];
    if (frame && 'updates' in frame) { layer.publish(world, viewport, frame); return; }
    const snapshot = layer.captureFrame(world, viewport);
    const planned = frame ?? (planner ??= createWorldContextPlanner(worldContextGeometry(options.plan), annotationPriorities, annotationLandmarks))(snapshot.view);
    // Explicit complete-frame cases use a fresh baseline; ordinary samples keep their acknowledged delta chain.
    layer.publish(world, viewport, encode(++sequence, frame ? 0 : snapshot.view.contextCommittedId ?? 0, planned));
  }
  return { ...layer, publish };
}

/** Every style, data-attribute and attribute write that changes a value, while a test records: the browser fast-path check. */
let writeLog: string[] | null = null;
const logWrite = (element: FakeElement, what: string, before: unknown, after: unknown) => {
  if (writeLog && String(before ?? '') !== String(after ?? '')) writeLog.push(`${element.tagName} ${what}`);
};
class FakeElement extends EventTarget {
  readonly children: FakeElement[] = [];
  styleWrites = 0;
  readonly style = new Proxy(Object.assign({ opacity: '' } as Record<string, string>, {
    getPropertyValue: (name: string) => this.style[name] ?? '',
    setProperty: (name: string, value: string) => { this.style[name] = value; },
  }), { set: (target, key, value) => { this.styleWrites++; logWrite(this, `style.${String(key)}`, Reflect.get(target, key), value); Reflect.set(target, key, value); return true; } });
  attributeWrites = 0;
  readonly dataset: Record<string, string> = new Proxy({}, {
    set: (target, key, value) => { this.attributeWrites++; logWrite(this, `data-${String(key)}`, Reflect.get(target, key), value); Reflect.set(target, key, value); return true; },
    deleteProperty: (target, key) => { logWrite(this, `data-${String(key)} removed`, Reflect.get(target, key), undefined); return Reflect.deleteProperty(target, key); },
  });
  parentNode: FakeElement | null = null;
  get parentElement(): FakeElement | null { return this.parentNode; }
  get isConnected(): boolean { return this.parentNode !== null; }
  closest(selector: string): FakeElement | null {
    if (selector.startsWith('.') && this.className.split(' ').includes(selector.slice(1))) return this;
    return this.parentNode?.closest(selector) ?? null;
  }
  className = ''; textContent = ''; hidden = false; clientWidth = 0; clientHeight = 0;
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) { super(); this.ownerDocument = ownerDocument; this.tagName = tagName; }
  measurements = 0;
  getBoundingClientRect() { this.measurements++; return { width: this.dataset.contextName.length * 6, height: 14 }; }
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void { logWrite(this, `@${name}`, this.attributes.get(name), value); this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  append(...entries: FakeElement[]): void { for (const entry of entries) this.insertBefore(entry, null); }
  appendChild(entry: FakeElement): FakeElement { this.append(entry); return entry; }
  insertBefore(entry: FakeElement, before: FakeElement | null): void {
    entry.remove(); entry.parentNode = this;
    const index = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(index < 0 ? this.children.length : index, 0, entry);
  }
  remove(): void { if (this.parentNode) { const index = this.parentNode.children.indexOf(this); if (index >= 0) this.parentNode.children.splice(index, 1); this.parentNode = null; } }
}
class Clock extends EventTarget {
  now = 0; next = 0; frames = new Map<number, (time: number) => void>(); timers = new Map<number, { at: number; callback: () => void }>();
  performance = { now: () => this.now };
  getComputedStyle = (element: FakeElement, pseudo: string) => {
    expect(pseudo).toBe('::after'); element.measurements++;
    return { width: `${element.dataset.contextName.length * 6}px`, height: '14px' };
  };
  requestAnimationFrame = (callback: (time: number) => void) => { const id = ++this.next; this.frames.set(id, callback); return id; };
  cancelAnimationFrame = (id: number) => { this.frames.delete(id); };
  setTimeout = (callback: () => void, milliseconds: number) => { const id = ++this.next; this.timers.set(id, { at: this.now + milliseconds, callback }); return id; };
  clearTimeout = (id: number) => { this.timers.delete(id); };
  advance(milliseconds: number) {
    this.now += milliseconds;
    const frames = [...this.frames.values()]; this.frames.clear(); for (const callback of frames) callback(this.now);
    for (const [id, timer] of [...this.timers]) if (timer.at <= this.now) { this.timers.delete(id); timer.callback(); }
  }
}
class FakeDocument {
  defaultView = new Clock();
  createElement(tagName: string): FakeElement { return new FakeElement(this, tagName); }
  createElementNS(_namespace: string, tagName: string): FakeElement { return this.createElement(tagName); }
}

const mounted = new WeakMap<FakeElement, ReturnType<typeof mountTestContext>>();

test('approximate orbit cues stay on retained groups through selection and publication', () => {
  const original = plan(1);
  const input = { ...original, bodies: [{ ...original.bodies[0], placement: 'approximate' }, original.bodies[1]] };
  const prepared = parsePreparedWorldContext(input);
  expect(prepared.bodies[0]!.placement).toBe('approximate');
  expect(prepared.bodies[0]!.orbit).toEqual(original.bodies[0]!.orbit);
  expect(() => parsePreparedWorldContext({ ...input, bodies: [{ ...input.bodies[0], placement: 'unknown' }] })).toThrow(/placement/);
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: prepared, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } } as const;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  // Orbit leaf blocks are built on first use and then retained.
  layer.publish(world, viewport);
  const group = find(root, 'contextGroup', 'mercury'), count = all(root).length;
  layer.selectObject('mercury');
  layer.publish(world, viewport);
  expect(group.dataset.contextPlacement).toBe('approximate');
  expect(find(root, 'contextLabel', 'mercury').dataset.contextName).toBe('Mercury (approx)');
  expect(find(root, 'contextOrbit', 'mercury').dataset.contextPlacement).toBe('approximate');
  expect(find(root, 'contextGroup', 'venus').dataset.contextPlacement).toBeUndefined();
  expect(all(root).length).toBe(count);
  layer.destroy();
});
const sprite = { url: '/marker.png', index: 0, count: 1, size: 16 };
const presentation = {
  projection: { model: 'css-perspective-shared-with-sky', cssPerspective: '86.60254037844386cqw' },
  dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .006, minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 1 },
  levelOfDetail: { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20, billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 },
  orbitLineFade: { visibleBelowDiscHeightShare: .12, hiddenAboveDiscHeightShare: .3 }, drag: { model: 'screen-axis-tumble' },
};
const orbit = (position: readonly [number, number, number], scale: number) => ({
  centerBodyId: 'sun', centerPositionM: [0, 0, 0],
  verticesM: [[position[0], position[1], position[2]], [0, 100, 0], [-100, 0, 0], [0, -100, 0], [100, 0, 0], [0, 100, 0], [-100, 0, 0], [0, -100, 0]].map(v => v.map(n => n * scale)),
  trail: [1, 1, 1, 1, 1, 1, 1, 1],
});
function plan(scale: number) {
  const point = (id: string, name: string, color: string, position: readonly [number, number, number], radius: number) => ({ id, name, color, positionM: position.map(value => value * scale), radiusM: radius * scale });
  const focus = point('sun', 'Sun', '#f5a623', [0, 0, 0], 10);
  const front = point('mercury', 'Mercury', '#9d9388', [100, 0, 0], 1);
  const hidden = point('venus', 'Venus', '#d6aa69', [0, 0, -20], 1);
  return parsePreparedWorldContext({ schema: 'cssearth-world-context@1',
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: scale, bodyRadiusM: 10 * scale },
    focus, bodies: [{ ...front, orbit: orbit([100, 0, 0], scale) }, { ...hidden, orbit: orbit([0, 0, -20], scale) }],
    camera: { minimumDistanceM: 12 * scale, maximumDistanceM: 10_000 * scale, framingReferenceZoom: 1, presentation },
    volume: { objectId: 'milky-way', fadeStartDistanceM: 100 * scale, fullDistanceM: 1_000 * scale }, system: { fadeOutStartDistanceM: scale, hiddenDistanceM: 1e30 * scale },
    stars: { objectId: 'stellar-neighbourhood', fadeStartDistanceM: 10 * scale, fullDistanceM: 50 * scale },
    sky: { sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' },
  });
}
function find(root: FakeElement, key: string, value: string): FakeElement {
  const found = [root, ...all(root)].find(element => element.dataset[key] === value);
  if (!found) throw new Error(`Missing ${key}=${value}`); return found;
}
// Orbit leaf blocks are built on first use and then retained. Every earlier node
// survives in order, and only orbit leaf blocks or their leaves may be added. The one
// corner locator is the exception by design: a single element that moves into whichever
// marker is emphasised, so it and its two paths are left out of the order.
const isLocator = (node: FakeElement) => node.getAttribute('class') === 'context-locator' || node.parentNode?.getAttribute('class') === 'context-locator';
function expectRetained(root: FakeElement, retained: readonly FakeElement[]) {
  const nodes = retained.filter(node => !isLocator(node));
  const known = new Set(nodes), now = all(root).filter(node => !isLocator(node)), kept = now.filter(node => known.has(node));
  expect(kept.length === nodes.length && kept.every((node, index) => node === nodes[index]), 'every retained node survives in order').toBe(true);
  expect(now.every(node => known.has(node) || node.className === 'context-orbit-block' || node.parentNode?.className === 'context-orbit-block'),
    'only orbit leaf blocks are added').toBe(true);
}
function captionName(element: { dataset: { contextName?: string } }): string {
  const name = element.dataset.contextName;
  if (name === undefined) throw new Error('A shown caption has no name.');
  return name;
}
test('validated immutable context is shared, while modified transport still gets validated', () => {
  const prepared = plan(1);
  expect(parsePreparedWorldContext(prepared)).toBe(prepared);
  // Orbit paths are typed arrays (views over the orbit bank), which cannot be frozen; the records around them are.
  expect(() => { Object.assign(prepared.bodies[0]!.orbit!, { centerBodyId: 'moved' }); }).toThrow();
  const transport = structuredClone(prepared);
  const validated = parsePreparedWorldContext(transport);
  expect(validated).not.toBe(transport);
  expect(validated).toEqual(prepared);
  transport.bodies[0]!.orbit!.verticesM[0] = 0;
  expect(() => parsePreparedWorldContext(transport)).toThrow('align');
  expect(parsePreparedWorldContext(validated)).toBe(validated);
});
function all(root: FakeElement): FakeElement[] { return root.children.flatMap(child => [child, ...all(child)]); }
// Inspect the one real element's pseudo state and composed transform. These
// helpers return values, never pretend the pseudos are independent DOM nodes.
function annotationVisibility(element: HTMLElement | FakeElement, part: 'label' | 'indicator') {
  return element.style.visibility !== 'hidden' && element.dataset[part === 'label' ? 'contextLabelVisible' : 'contextIndicatorVisible'] === 'true' ? '' : 'hidden';
}
// Per-frame motion and paint order belong to the bare mover that wraps each
// marker. The marker keeps its stable style, attributes and two pseudos, so
// every transform or z-index expectation reads the mover instead.
function mover(element: HTMLElement | FakeElement): FakeElement {
  const parent = (element as FakeElement).parentNode;
  if (!parent) throw new Error('A marker outside its mover has no transform owner.');
  return parent;
}
function billboardCenter(element: HTMLElement | FakeElement): number[] {
  const moved = mover(element);
  // The context root is a zero-size anchor at the stage centre, so a mover's translation is already centre-relative.
  const [x, y] = moved.style.transform.match(/-?[\d.]+/g)!.map(Number);
  return [x, y];
}
function captionPosition(element: HTMLElement | FakeElement): number[] {
  const [x, y] = billboardCenter(element);
  const dx = Number(element.style.getPropertyValue('--context-label-x').replace('px', ''));
  const dy = Number(element.style.getPropertyValue('--context-label-y').replace('px', ''));
  return [x + dx, y + dy];
}
const paintedOrbitLeaf = (piece: HTMLElement | SVGElement) => piece.getAttribute('stroke-opacity') !== null
  ? Boolean(piece.getAttribute('d')) : piece.style.visibility === '';
const orbitLeafWeight = (piece: HTMLElement | SVGElement) => Number(piece.getAttribute('stroke-opacity') ?? piece.style.opacity);
function mount(scale: number, requestPublication?: () => boolean) {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(scale), sprites: { sun: sprite, mercury: sprite, venus: sprite }, requestPublication });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1_000 * scale], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
  mounted.set(layer.root as unknown as FakeElement, layer);
  return layer.root as unknown as FakeElement;
}

test('open world trajectories validate their epoch vertex and never accept a closing weight', () => {
  const original = plan(1), body = original.bodies[0]!;
  const verticesM = [[-100, -50, 0], [-50, -30, 0], [0, -10, 0], [100, 0, 0],
    [150, 20, 0], [200, 50, 0], [250, 90, 0], [300, 140, 0]];
  const orbit = { centerBodyId: 'sun', centerPositionM: [0, 0, 0], verticesM, closed: false,
    bodyVertexIndex: 3, displayExtentAu: 600, trailModel: 'finite-open-trajectory-constant-weight',
    trail: Array(7).fill(1), activeChords: [0, 1, 2, 3, 4, 5, 6], extentChords: [0, 3, 1, 5, 2, 4, 6] };
  const input = { ...original, bodies: [{ ...body, orbit }, original.bodies[1]] };
  expect(parsePreparedWorldContext(input).bodies[0]!.orbit).toEqual({ ...orbit, verticesM: Float64Array.from(verticesM.flat()), trail: Float64Array.from(orbit.trail),
    activeChords: Uint32Array.from(orbit.activeChords), extentChords: Uint32Array.from(orbit.extentChords), vertexCount: 8, fullTrail: true });
  for (const invalid of [{ closed: true }, { bodyVertexIndex: undefined }, { bodyVertexIndex: 0 }, { bodyVertexIndex: 8 },
    { trail: Array(8).fill(1) }, { trail: [0, 1, 1, 1, 1, 1, 1] }, { displayExtentAu: 0 },
    { activeChords: [0, 1, 2, 3, 4, 5, 7] }]) {
    expect(() => parsePreparedWorldContext({ ...input, bodies: [{ ...body, orbit: { ...orbit, ...invalid } }, original.bodies[1]] })).toThrow();
  }
});

test('semantic changes invalidate worker snapshots without synchronously republishing geometry', () => {
  const request = vi.fn(() => true), root = mount(1, request), layer = mounted.get(root)!;
  const clock = root.ownerDocument.defaultView;
  clock.advance(1000);
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const planner = createWorldContextPlanner(plan(1));
  const drawing = () => JSON.stringify(all(root).map(node => node.style));
  for (const change of [() => layer.setOverview(true), () => layer.setBodyVisibility({ orbitHidden: ['mercury'] }),
    () => layer.setBodyVisibility({ labelHidden: ['venus'] }), () => layer.previewSelection('mercury')]) {
    const stale = layer.captureFrame(world, viewport), before = drawing(), calls = request.mock.calls.length;
    change();
    expect(stale.current()).toBe(false);
    expect(request.mock.calls.length).toBe(calls + 1);
    expect(drawing()).toBe(before);
    const fresh = layer.captureFrame(world, viewport);
    layer.publish(world, viewport, planner(fresh.view));
    clock.advance(1000);
  }
  // A hover decides which annotations show, not where bodies project: a plan in
  // flight stays valid (discarding it would cost a full repair of every body),
  // nothing is drawn synchronously, and the next captured view carries the hover.
  const before = drawing(), stale = layer.captureFrame(world, viewport);
  find(root, 'contextGroup', 'mercury').dataset.objectHovered = 'true';
  root.parentNode!.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16);
  expect(stale.current()).toBe(true);
  expect(drawing()).toBe(before);
  expect(layer.captureFrame(world, viewport).view.bodies[1].hovered).toBe(true);
  layer.destroy();
});

test('inactive annotations retain emphasis until their reveal publication', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const nodes = all(root), groups = ['sun', 'mercury', 'venus'].map(id => find(root, 'contextGroup', id));
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const away = { ...world, pose: { ...world.pose, orientationXyzw: [0, 1, 0, 0] as const } };
  layer.publish(away, viewport);
  clock.advance(1000);
  layer.publish(away, viewport);
  const retained = groups.map(group => group.dataset.contextSelected);
  layer.setOverview(true);
  clock.advance(1000);
  layer.publish(away, viewport);
  expect(groups.map(group => group.dataset.contextSelected)).toEqual(retained);
  layer.publish(world, viewport);
  clock.advance(1000);
  layer.publish(world, viewport);
  const shown = layer.inspect().filter(body => body.mover.style.visibility !== 'hidden');
  expect(shown.length).toBeGreaterThan(0);
  // Emphasis is two-state. The overview emphasizes nobody, so the Sun that was
  // selected before the bodies were culled must publish 'false' on its reveal.
  for (const body of shown) expect(find(root, 'contextGroup', body.id).dataset.contextSelected).toBe('false');
  expectRetained(root, nodes);
  layer.destroy();
});

test('a body carries its prepared colour inline, and the emphasised one wears the one corner locator by inheritance', () => {
  const base = plan(1), colours: Record<string, string> = { mercury: '#abcdef', venus: '#123456' };
  const prepared = { ...base, focus: { ...base.focus, contextColor: '#fedcba' },
    bodies: base.bodies.map(body => ({ ...body, contextColor: colours[body.id]!, labelCase: 'upper' as const })) };
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: prepared,
    sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  const mercury = find(root, 'contextGroup', 'mercury'), venus = find(root, 'contextGroup', 'venus'), sun = find(root, 'contextGroup', 'sun');
  // No stylesheet rule per body: the colour and caption case are on the marker and its orbit.
  expect([mercury.style.color, venus.style.color, find(root, 'contextOrbit', 'mercury').style.color]).toEqual(['#abcdef', '#123456', '#abcdef']);
  expect(mercury.dataset.contextLabelCase).toBe('upper');
  const locatorIn = (marker: FakeElement) => marker.children.find(child => child.getAttribute('class') === 'context-locator');
  layer.selectObject('mercury'); layer.publish(world, viewport);
  const locator = locatorIn(mercury)!;
  // It sits under the sprite, as the ring does, and has no colour of its own: its paths fill with currentColor.
  expect(mercury.children.indexOf(locator)).toBe(mercury.children.findIndex(child => child.tagName === 'i') - 1);
  expect([locator.style.color ?? '', ...locator.children.map(path => path.getAttribute('fill'))]).toEqual(['', 'currentColor', 'currentColor']);
  expect([mercury.dataset.contextLocator, venus.dataset.contextLocator]).toEqual(['', undefined]);
  layer.selectObject('sun'); layer.publish(world, viewport);
  // The same element moves; the marker it leaves returns to its ring.
  expect([locatorIn(sun), locatorIn(mercury), mercury.dataset.contextLocator, sun.dataset.contextLocator]).toEqual([locator, undefined, undefined, '']);
  layer.destroy();
});

test('a culled indicator with retained alpha is dormant, then gets current emphasis on reveal', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  const group = find(root, 'contextGroup', 'mercury');
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1, heightPixels: 1 };
  // Emphasis is two-state, so the body has to be the emphasized one before it
  // is culled for a dormant value to be distinguishable from a current one.
  layer.selectObject('mercury');
  layer.publish(world, { ...viewport, widthPixels: 800, heightPixels: 600 });
  expect(group.dataset.contextSelected).toBe('true');
  layer.publish(world, viewport); clock.advance(1000);
  expect(mercury.mover.style.visibility).toBe('hidden');
  expect(Number(mercury.mover.style.opacity)).toBe(0);
  const retained = group.dataset.contextSelected;
  expect(retained).toBe('true');
  layer.setOverview(true); layer.publish(world, viewport);
  expect(group.dataset.contextSelected).toBe(retained);
  layer.publish(world, { ...viewport, widthPixels: 800, heightPixels: 600 });
  expect(mercury.mover.style.visibility).toBe('');
  expect(group.dataset.contextSelected).toBe('false');
  layer.destroy();
});

test('a resolved background sprite does not pick through its transparent square corners', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.selectObject('mercury');
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 100], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  const registry = screenPicking(root.parentNode! as unknown as HTMLElement);
  const sun = layer.inspect().find(body => body.id === 'sun')!.billboard;
  expect(registry.pick(0, 0)).toBe(sun);
  expect(registry.pick(35, 35)).not.toBe(sun);
  layer.destroy();
});

test('camera viewport snapshots drive clipping and resize without reading host layout', () => {
  const root = mount(1), layer = mounted.get(root)!;
  Object.defineProperties(root.parentNode!, {
    clientWidth: { get() { throw new Error('Publication flushed host layout'); } },
    clientHeight: { get() { throw new Error('Publication flushed host layout'); } },
  });
  const mercury = layer.inspect().find(entry => entry.id === 'mercury')!;
  const publish = (widthPixels: number, heightPixels: number) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1_000], orientationXyzw: [0, 0, 0, 1] },
  }, { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels, heightPixels });
  publish(800, 600);
  expect(mercury.mover.style.visibility).toBe('');
  publish(40, 600);
  expect(mercury.mover.style.visibility).toBe('hidden');
  publish(800, 600);
  expect(mercury.mover.style.visibility).toBe('');
  publish(800, 10);
  expect(mercury.mover.style.visibility).toBe('hidden');
  layer.destroy();
});

test('hidden orbit selection leaves other orbits intact and retains the same body nodes', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const target = find(root, 'contextOrbit', 'mercury'), other = find(root, 'contextOrbit', 'venus');
  const visibleTarget = target.style.opacity, visibleOther = other.style.opacity;
  expect(visibleTarget).not.toBe('0');
  layer.setBodyVisibility({ orbitHidden: ['mercury'] });
  root.ownerDocument.defaultView.advance(200);
  expect(target.style.opacity).toBe('0');
  expect(target.style.pointerEvents).toBe('none');
  expect(target.dataset.objectNavigate).toBeUndefined();
  expect(other.style.opacity).toBe(visibleOther);
  expect(find(root, 'contextLabel', 'mercury').style.visibility).toBe('');
  expect(find(root, 'contextBody', 'mercury').style.visibility).toBe('');
  expectRetained(root, nodes);
  layer.setNavigationInFlight(true);
  layer.setBodyVisibility({ orbitHidden: [] });
  expect(target.style.opacity).toBe(visibleTarget);
  expect(target.dataset.objectNavigate).toBeUndefined();
  layer.setNavigationInFlight(false);
  expect(target.style.opacity).toBe(visibleTarget);
  expect(target.dataset.objectNavigate).toBe('mercury');
  expect(other.style.opacity).toBe(visibleOther);
  expectRetained(root, nodes);
  layer.destroy();
});

test('hover-only trails reveal the full orbit and keep their circle and label before and after hover', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map(body => ({ ...body,
    orbit: { ...body.orbit, trail: [0, 0, 0, .2, .4, .6, .8, 1], activeChords: [3, 4, 5, 6, 7] },
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.setBodyVisibility({ orbitHidden: ['mercury', 'venus'] });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const circle = find(root, 'contextBody', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const orbit = find(root, 'contextOrbit', 'mercury'), other = find(root, 'contextOrbit', 'venus');
  for (const hovered of [false, true, false]) {
    circle.dataset.objectHovered = String(hovered);
    host.dispatchEvent(new Event('objecthoverchange'));
    document.defaultView.advance(16); document.defaultView.advance(200);
    expect(annotationVisibility(circle, 'indicator')).toBe('');
    expect(annotationVisibility(label, 'label')).toBe('');
    expect(orbit.style.opacity === '0').toBe(!hovered);
    if (hovered) {
      const visiblePieces = layer.inspect().find(body => body.id === 'mercury')!.orbit.filter(piece => piece.style.visibility === '');
      expect(visiblePieces.length).toBeGreaterThan(5);
      expect(visiblePieces.every(piece => Number(piece.style.opacity) === 1)).toBe(true);
    }
    expect(orbit.dataset.objectNavigate).toBeUndefined();
    // The stage picker owns every hit. A paint node that was never navigable
    // keeps only the inert pointer policy it declared when it was mounted.
    expect(orbit.style.cssText).toContain('pointer-events:none');
    expect(orbit.style.pointerEvents ?? 'none').toBe('none');
    expect(other.style.opacity).toBe('0');
  }
  // Hover builds the full orbit's leaf blocks on first use.
  expectRetained(root, nodes);
  layer.destroy();
});

test('open trajectories stay hidden until their body circle is hovered', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), body = source.bodies[0]!;
  const verticesM = [[-100, -50, 0], [-50, -30, 0], [0, -10, 0], [100, 0, 0],
    [150, 20, 0], [200, 50, 0], [250, 90, 0], [300, 140, 0]];
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit: {
    centerBodyId: 'sun', centerPositionM: [0, 0, 0], verticesM, closed: false,
    bodyVertexIndex: 3, displayExtentAu: 600, trailModel: 'finite-open-trajectory-constant-weight',
    trail: Array(7).fill(1), activeChords: [0, 1, 2, 3, 4, 5, 6], extentChords: [0, 3, 1, 5, 2, 4, 6],
  } }, source.bodies[1]!] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const publish = () => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  publish();
  const root = layer.root as unknown as FakeElement;
  const circle = find(root, 'contextBody', 'mercury'), orbit = find(root, 'contextOrbit', 'mercury');
  expect(annotationVisibility(circle, 'indicator')).toBe('');
  expect(orbit.style.opacity).toBe('0');
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  expect(orbit.style.opacity).not.toBe('0');
  expect(layer.inspect().find(entry => entry.id === 'mercury')!.orbit.some(piece => paintedOrbitLeaf(piece))).toBe(true);
  circle.dataset.objectHovered = 'false';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  expect(orbit.style.opacity).toBe('0');
  layer.destroy();
});

test('an unlabelled minor body cannot leave an anonymous orbit across the stage', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite },
    annotationPriorities: { mercury: 1, venus: 3 } });
  layer.setBodyVisibility({ labelHidden: ['mercury'] });
  const publish = () => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  publish();
  const root = layer.root as unknown as FakeElement;
  const marker = find(root, 'contextBody', 'mercury'), orbit = find(root, 'contextOrbit', 'mercury');
  expect(annotationVisibility(marker, 'indicator')).toBe('hidden');
  expect(orbit.style.opacity).toBe('0');
  marker.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  expect(annotationVisibility(marker, 'indicator')).toBe('');
  expect(orbit.style.opacity).not.toBe('0');
  marker.dataset.objectHovered = 'false';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); publish(); document.defaultView.advance(200);
  expect(orbit.style.opacity).toBe('0');
  layer.destroy();
});

test('hidden annotations leave the physical dot pickable and hover reveals the complete annotation', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const clock = root.ownerDocument.defaultView, host = root.parentNode!;
  const circle = find(root, 'contextBody', 'mercury');
  const label = find(root, 'contextLabel', 'mercury');
  const orbit = find(root, 'contextOrbit', 'mercury');
  const other = find(root, 'contextOrbit', 'venus');
  const sunLabel = find(root, 'contextLabel', 'sun');
  layer.setBodyVisibility({ orbitHidden: ['mercury', 'venus'] });
  layer.setBodyVisibility({ labelHidden: ['mercury', 'venus'] });
  clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  expect(annotationVisibility(circle, 'indicator')).toBe('hidden');
  expect(circle.dataset.objectNavigate).toBe('mercury');
  expect(annotationVisibility(sunLabel, 'label')).toBe('');
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16); clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('');
  expect(label.dataset.objectNavigate).toBe('mercury');
  expect(orbit.style.opacity).not.toBe('0');
  expect(all(orbit).some(piece => piece.tagName === 's' && piece.style.visibility === '' &&
    piece.parentNode?.style.display === 'contents')).toBe(true);
  // A temporarily revealed orbit cannot keep itself hovered after leaving the circle.
  expect(orbit.dataset.objectNavigate).toBeUndefined();
  expect(orbit.style.pointerEvents).toBe('none');
  expect(other.style.opacity).toBe('0');
  delete circle.dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16); clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  expect(orbit.style.opacity).toBe('0');
  expect(circle.dataset.objectNavigate).toBe('mercury');
  layer.setBodyVisibility({ labelHidden: [] }); clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('');
  expect(orbit.style.opacity).toBe('0');
  layer.setBodyVisibility({ orbitHidden: [] });
  layer.setBodyVisibility({ labelHidden: ['mercury'] }); clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  expect(orbit.dataset.objectNavigate).toBeUndefined();
  expect(orbit.style.opacity).toBe('0');
  expectRetained(root, nodes);
  layer.destroy();
  host.dispatchEvent(new Event('objecthoverchange'));
  expect(clock.frames.size).toBe(0);
});

test('a highlighted set reveals hidden labels and marks its retained groups until cleared', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const group = find(root, 'contextGroup', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const clock = root.ownerDocument.defaultView;
  const nodes = all(root);
  // The caption is this marker's own pseudo-element, so its visibility is the
  // published attribute the style reads, not a style property of a label node.
  layer.setBodyVisibility({ labelHidden: ['mercury'] }); clock.advance(16); clock.advance(200);
  expect(label.dataset.contextLabelVisible).toBe('false');
  layer.setBodyVisibility({ highlighted: ['mercury'] }); clock.advance(16); clock.advance(200);
  expect(label.dataset.contextLabelVisible).toBe('true');
  expect(group.dataset.contextHighlight).toBe('true');
  expect(root.dataset.contextHighlighting).toBe('true');
  layer.setBodyVisibility({ highlighted: [] }); clock.advance(16); clock.advance(200);
  expect(label.dataset.contextLabelVisible).toBe('false');
  expect(group.dataset.contextHighlight).toBeUndefined();
  expect(root.dataset.contextHighlighting).toBeUndefined();
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('keyboard focus also reveals a hidden label and orbit, then retires them on blur', () => {
  const root = mount(1), layer = mounted.get(root)!, host = root.parentNode!;
  const circle = find(root, 'contextBody', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const clock = root.ownerDocument.defaultView;
  layer.setBodyVisibility({ orbitHidden: ['mercury'] }); layer.setBodyVisibility({ labelHidden: ['mercury'] });
  Object.assign(root.ownerDocument, { activeElement: circle });
  host.dispatchEvent(new Event('focusin')); clock.advance(16); clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('');
  Object.assign(root.ownerDocument, { activeElement: null });
  host.dispatchEvent(new Event('focusout')); clock.advance(16); clock.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  layer.destroy();
});

test('camera publication consumes interaction changes without polling retained DOM state', () => {
  const root = mount(1), layer = mounted.get(root)!, host = root.parentNode!;
  const group = find(root, 'contextGroup', 'mercury');
  const label = find(root, 'contextLabel', 'mercury');
  const circle = find(root, 'contextBody', 'mercury');
  let hovered: string | undefined, focused: FakeElement | null = null;
  let hoverReads = 0, focusReads = 0;
  Object.defineProperty(group.dataset, 'objectHovered', { get() { hoverReads++; return hovered; } });
  Object.defineProperty(root.ownerDocument, 'activeElement', { get() { focusReads++; return focused; } });
  const publish = (distance = 1_000) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels: 800, heightPixels: 600 });
  layer.setBodyVisibility({ labelHidden: ['mercury'] });
  for (let distance = 1_000; distance < 1_020; distance++) publish(distance);
  expect(hoverReads).toBe(0); expect(focusReads).toBe(0);
  hovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  // A camera sample can arrive before the scheduled annotation callback.
  publish();
  expect(annotationVisibility(label, 'label')).toBe('');
  expect(hoverReads).toBe(1); expect(focusReads).toBe(1);
  root.ownerDocument.defaultView.advance(16);
  expect(hoverReads).toBe(1); expect(focusReads).toBe(1);
  publish(1e31); // Retire non-anchor publication.
  hovered = undefined; focused = circle;
  host.dispatchEvent(new Event('objecthoverchange'));
  host.dispatchEvent(new Event('focusin'));
  publish(1e31); publish();
  expect(annotationVisibility(label, 'label')).toBe('');
  expect(hoverReads).toBe(2); expect(focusReads).toBe(2);
  focused = null; host.dispatchEvent(new Event('focusout'));
  publish(); root.ownerDocument.defaultView.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  expect(hoverReads).toBe(3); expect(focusReads).toBe(3);
  layer.destroy();
  host.dispatchEvent(new Event('objecthoverchange'));
  root.ownerDocument.defaultView.advance(200);
  expect(hoverReads).toBe(3); expect(focusReads).toBe(3);
});

function expectAlignedContextOrigin(actual: readonly number[], expected: readonly number[], label: string): void {
  expect(actual).toHaveLength(3); expect(expected).toHaveLength(3);
  // Match preparation's positionToleranceM policy: saved frames and freshly
  // reconstructed matrix products differ by millimetres across V8 platforms.
  const toleranceM = Math.max(.001, 8 * Number.EPSILON * Math.max(...actual.map(Math.abs), ...expected.map(Math.abs)));
  const separationM = Math.hypot(...actual.map((value, axis) => value - required(expected[axis])));
  expect(separationM, label).toBeLessThanOrEqual(toleranceM);
}

test('context alignment accepts observed Linux roundoff but rejects detached origins', () => {
  const saved = [4464323069020.515, 219850064405.67654, -21150265923.520695] as const;
  const linux = [4464323069020.515, 219850064405.67706, -21150265923.520573] as const;
  expect(() => expectAlignedContextOrigin(linux, saved, 'observed Neptune reconstruction')).not.toThrow();
  expect(() => expectAlignedContextOrigin([linux[0] + 1, linux[1], linux[2]], saved, 'one metre drift')).toThrow();
  expect(() => expectAlignedContextOrigin([0, .0005, 0], [0, 0, 0], 'near-origin roundoff')).not.toThrow();
  expect(() => expectAlignedContextOrigin([0, .002, 0], [0, 0, 0], 'near-origin displacement')).toThrow();
});

test('accepts the generated Sun context and rejects detached or malformed prepared data', async () => {
  const source = JSON.parse(await readFile(fileURLToPath(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
  const { readCatalog } = await import('../../../../tools/prepare/prepare-catalog.mts');
  const contextEntries = (await readCatalog()).filter(body => body.context && body.id !== 'sun')
    .sort((a, b) => (a.context!.order ?? Number.MAX_SAFE_INTEGER) - (b.context!.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en'));
  // Bodies drawn from their astronomy records around a packaged host follow the catalogue's own entries.
  expect(parsePreparedWorldContext(source).bodies.filter(body => !body.unpackaged).map(body => body.id)).toEqual(contextEntries.map(body => body.id));
  for (const body of parsePreparedWorldContext(source).bodies.filter(body => !body.unpackaged)) {
    const frame = SCENE_OBJECTS.find(object => object.id === body.id)!.worldFrame!;
    expect(body.radiusM, `${body.id} context must match the selectable detail radius`).toBe(frame.bodyRadiusM);
    expectAlignedContextOrigin(body.positionM, frame.originM, `${body.id} context must match the selectable detail origin`);
    // A placed star or black hole has no orbit in the Sun's context; every orbiting body's orbit facts are prepared.
    if (!body.orbit) { expect(['star', 'black-hole']).toContain(SCENE_OBJECTS.find(object => object.id === body.id)!.classification); continue; }
    expect(body.orbit.bounds, `${body.id} orbit bounds are owned by preparation`).toBeDefined();
    expect([...body.orbit.activeChords!]).toEqual([...body.orbit.trail].flatMap((weight, index) => weight > 0 ? [index] : []));
    expect([...(body.orbit.extentChords ?? [])].sort((a, b) => a - b)).toEqual([...body.orbit.activeChords!]);
  }
  expect(() => parsePreparedWorldContext({ ...source, focus: { ...(source.focus as Record<string, unknown>), positionM: [1, 0, 0] } })).toThrow('frame origin');
  const camera = source.camera as Record<string, unknown>, presentation = camera.presentation as Record<string, unknown>;
  expect(() => parsePreparedWorldContext({ ...source, camera: { ...camera, presentation: { ...presentation, dolly: { ...(presentation.dolly as Record<string, unknown>), minimumDistanceRadii: 1 } } } })).toThrow('outside the focus');
  const body = (source.bodies as Record<string, unknown>[])[0]!;
  expect(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit: { ...(body.orbit as Record<string, unknown>), verticesM: [[0, 0, 0], ...((body.orbit as { verticesM: unknown[] }).verticesM.slice(1))] } }, ...(source.bodies as unknown[]).slice(1)] })).toThrow('align');
  expect(() => parsePreparedWorldContext({ ...source, sky: { sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1)' } })).toThrow('pure matrix3d rotation');
  const bodies = source.bodies as Record<string, unknown>[];
  for (const orbit of [{ ...(body.orbit as object), centerBodyId: 'unprepared-parent' },
    { ...(body.orbit as object), centerPositionM: [1, 0, 0] },
    { ...(body.orbit as object), centerBodyId: undefined },
    { ...(body.orbit as object), bounds: { centerM: [0, 0, 0], radiusM: 1 } },
    { ...(body.orbit as object), bounds: { centerM: [0, 0, 0], radiusM: Infinity } },
    { ...(body.orbit as object), activeChords: [] },
    { ...(body.orbit as object), activeChords: [0, 0] },
    { ...(body.orbit as object), extentChords: [] },
    { ...(body.orbit as object), extentChords: (body.orbit as { extentChords: number[] }).extentChords.map(() => 0) },
    { ...(body.orbit as object), extentChords: (body.orbit as { extentChords: number[] }).extentChords.map((value, index) => index === 0 ? .5 : value) },
    { ...(body.orbit as object), runtimeEphemeris: true }]) {
    expect(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit }, ...bodies.slice(1)] })).toThrow();
  }
  const parent = bodies.find(body => body.systemView)!;
  const view = parent.systemView as { memberIds: string[]; memberRadiiM: number[]; candidates: Record<string, unknown>[] };
  for (const systemView of [
    { ...view, candidates: [] },
    { ...view, memberRadiiM: [] },
    { ...view, memberRadiiM: view.memberRadiiM.map(radius => radius * 2) },
    { ...view, memberIds: view.memberIds.map(() => 'missing-moon') },
    { ...view, candidates: [{ ...view.candidates[0], memberPositionsM: [] }] },
    { ...view, candidates: [{ ...view.candidates[0], cameraToReference: [1,0,0,0,1,0,0,0,2] }] },
    { ...view, candidates: [{ ...view.candidates[0], minimumM: view.candidates[0].maximumM }] },
  ]) {
    expect(() => parsePreparedWorldContext({ ...source,
      bodies: bodies.map(body => body === parent ? { ...body, systemView } : body) })).toThrow();
  }
});

test('the Earth reference remains painted when its physical marker has faded at outer-system scale', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id,
      labelImportance(object.classification, object.discovery.featured, object.discovery.orientationReference ?? 0)])),
  });
  layer.setOverview(true);
  layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, 233.27 * 149_597_870_700], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1100, principalOffsetPixels: [0, 0], widthPixels: 1280, heightPixels: 720 });
  const earth = layer.inspect().find(body => body.id === 'earth')!;
  expect(annotationVisibility(earth.billboard, 'indicator')).toBe('hidden');
  expect(annotationVisibility(earth.billboard, 'label')).toBe('');
  expect(earth.mover.style.visibility).toBe('');
  expect(Number(earth.mover.style.opacity)).toBeGreaterThan(0);
  expect(earth.orbit.some(paintedOrbitLeaf)).toBe(false);
  layer.destroy();
});

test('prepared planetary systems retain identified moon paths and retire offscreen context annotations', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])) });
  for (const [planet, moon] of [['saturn', 'titan'], ['jupiter', 'europa'], ['uranus', 'titania']]) {
    const body = context.bodies.find(body => body.id === planet)!;
    layer.selectObject(planet);
    const publish = (radii: number) => layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [body.positionM[0], body.positionM[1], body.positionM[2] + radii * body.radiusM], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
    // Orbit leaves are built on first use, so read the retained leaves after each publication.
    const orbit = () => layer.inspect().find(body => body.id === moon)!.orbit;
    // The planet spans about 20px, or 3.3% of this viewport: the moon system is readable.
    publish(40);
    expect(orbit().some(paintedOrbitLeaf), `${planet} moon system at overview distance`).toBe(true);
    // Offscreen moons have no admitted annotation, so their context paths retire too.
    publish(2);
    expect(orbit().some(paintedOrbitLeaf), `${planet} close-up`).toBe(false);
  }
  layer.destroy();
});

test.each(['bars', 'strokes'] as const)('%s gives the selected moon family full emphasis and dims unrelated bodies and paths', orbitRenderer => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), parent = base.bodies[0]!;
  const unrelated = { ...base.bodies[1]!, positionM: [0, -100, 0] as const, orbit: orbit([0, -100, 0], 1) };
  const moons = ['moon-a', 'moon-b'].map((id, index) => ({ ...parent, id, name: id, radiusM: .1,
    positionM: [150, (index ? -1 : 1) * 50, 0], orbit: { ...orbit([150, (index ? -1 : 1) * 50, 0], 1),
      centerBodyId: index ? 'satellite-center' : parent.id, centerPositionM: parent.positionM } }));
  const context = parsePreparedWorldContext({ ...base, bodies: [parent, unrelated, ...moons],
    orbitCenters: { 'satellite-center': { centerBodyId: parent.id, positionM: parent.positionM } } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])), orbitRenderer });
  layer.selectObject(parent.id); layer.setOverview(true);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, 40], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 100, principalOffsetPixels: [0, 0] });
  const opacity = (id: string) => {
    const body = layer.inspect().find(body => body.id === id)!;
    const line = orbitRenderer === 'bars'
      ? Number(find(layer.root as unknown as FakeElement, 'contextOrbit', id).style.opacity)
      : Math.max(...body.orbit.filter(piece => piece.getAttribute('points')).map(piece => Number(piece.style.strokeOpacity)));
    return { marker: Number(body.mover.style.opacity), line };
  };
  const baseline = new Map(context.bodies.map(body => [body.id, opacity(body.id)]));
  for (const id of [parent.id, 'moon-a', 'moon-b']) {
    layer.previewSelection(id); document.defaultView.advance(200);
    for (const body of context.bodies) {
      const expected = body.id === unrelated.id ? .25 : 1;
      const actual = opacity(body.id), normal = baseline.get(body.id)!;
      expect(normal.marker).toBeGreaterThan(0); expect(normal.line).toBeGreaterThan(0);
      expect(actual.marker / normal.marker, `${id} -> ${body.id} marker`).toBeCloseTo(expected, 1);
      expect(actual.line / normal.line, `${id} -> ${body.id} orbit`).toBeCloseTo(expected, 1);
    }
  }
  const marker = layer.inspect().find(body => body.id === unrelated.id)!.billboard;
  marker.dataset.objectHovered = 'true'; host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(200); document.defaultView.advance(200);
  expect(opacity(unrelated.id).marker).toBeCloseTo(baseline.get(unrelated.id)!.marker);
  expect(opacity(unrelated.id).line).toBeGreaterThan(baseline.get(unrelated.id)!.line);
  marker.dataset.objectHovered = 'false'; host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(200); document.defaultView.advance(200);
  layer.previewSelection(null); document.defaultView.advance(200);
  for (const body of context.bodies) expect(opacity(body.id)).toEqual(baseline.get(body.id));
  // Pulling back restores context without clearing the selected body. Both
  // paint owners must update their multipliers again when zooming back in.
  layer.previewSelection(parent.id);
  const publishDistance = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 100, principalOffsetPixels: [0, 0] });
  publishDistance(200);
  const farSelected = opacity(unrelated.id);
  layer.previewSelection(null);
  expect(opacity(unrelated.id)).toEqual(farSelected);
  layer.previewSelection(parent.id);
  publishDistance(40);
  expect(opacity(unrelated.id).marker / baseline.get(unrelated.id)!.marker).toBeCloseTo(.25, 1);
  expect(opacity(unrelated.id).line / baseline.get(unrelated.id)!.line).toBeCloseTo(.25, 1);
  layer.destroy();
});

test.each([...SYSTEM_VIEWS.keys()].filter(id => id !== 'sun'))('%s moon orbits stay complete across selection, hover, flight and zoom', async planet => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const viewport = { focalPixels: 1100, framingRadiusPixels: 200, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1280, heightPixels: 720, visibleRect: null, detailHandoffDiameterPixels: 20 };
  const frame = SCENE_OBJECTS.find(object => object.id === planet)!.worldFrame;
  const target = systemViewTarget({ referenceFrame: required(frame).referenceFrame, epochJdTt: required(frame).epochJdTt,
    pose: { positionM: [0, 0, 1e15], orientationXyzw: [0, 0, 0, 1] } },
    required(frame), viewport, required(SYSTEM_VIEWS.get(planet)), systemFramingRect(viewport), 0, false, SYSTEM_RANGES.get(planet));
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])) });
  // The system's prepared members: bodies orbiting the planet, or a centre placed off it (a circumbinary planet).
  const memberIds = new Set(required([context.focus, ...context.bodies].find(body => body.id === planet)!.systemView).memberIds);
  const moons = layer.inspect().filter(body => memberIds.has(body.id));
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.selectObject(planet);
  layer.publish(target, viewport);
  for (const zoom of [.8, 1, 1.4]) {
    layer.publish({ ...target, pose: { ...target.pose,
      positionM: target.pose.positionM.map((value, axis) => required(frame).originM[axis] + (value - required(frame).originM[axis]) * zoom) as [number, number, number],
    } }, viewport);
    for (const selection of [null, planet, [...memberIds][0], undefined]) {
      layer.previewSelection(selection);
      for (const active of [true, false]) {
        layer.setNavigationInFlight(active);
        const circle = find(root, 'contextBody', [...memberIds][0]!);
        circle.dataset.objectHovered = String(active);
        host.dispatchEvent(new Event('objecthoverchange'));
        document.defaultView.advance(16);
        const pieces = moons.flatMap(moon => moon.orbit.filter(paintedOrbitLeaf));
        expect(pieces.length).toBeGreaterThan(0);
        // A full orbit paints at full weight; a member drawn as a trail (an S-star) fades along its half orbit by design.
        const full = moons.filter(moon => context.bodies.find(body => body.id === moon.id)?.orbit?.fullTrail === true);
        expect(full.flatMap(moon => moon.orbit.filter(paintedOrbitLeaf)).every(piece => orbitLeafWeight(piece) === 1)).toBe(true);
      }
    }
  }
  expectRetained(root, nodes);
  layer.destroy();
});

test('initial Jupiter system framing makes the four large moons and their labels readable', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const viewport = { focalPixels: 1100, framingRadiusPixels: 200, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1280, heightPixels: 720, visibleRect: null, detailHandoffDiameterPixels: 20 };
  const frame = SCENE_OBJECTS.find(object => object.id === 'jupiter')!.worldFrame;
  const target = systemViewTarget({ referenceFrame: required(frame).referenceFrame, epochJdTt: required(frame).epochJdTt,
    pose: { positionM: [0, 0, 1e15], orientationXyzw: [0, 0, 0, 1] } },
    required(frame), viewport, required(SYSTEM_VIEWS.get('jupiter')), systemFramingRect(viewport));
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id, labelImportance(object.classification)])),
  });
  layer.selectObject('jupiter');
  layer.publish(target, viewport); document.defaultView.advance(200);
  for (const id of ['io', 'europa', 'ganymede', 'callisto']) {
    const moon = layer.inspect().find(body => body.id === id)!;
    expect(moon.mover.style.visibility, `${id} circle`).toBe('');
    expect(moon.mover.style.visibility, `${id} label`).toBe('');
    expect(moon.orbit.some(paintedOrbitLeaf), `${id} orbit`).toBe(true);
  }
  layer.destroy();
});

test.each(['opacityProfile', 'brightnessProfile'] as const)('%s has a constant plateau, a logarithmic smooth ramp and legacy opacity one', key => {
  const base = plan(1), profile = { model: 'logarithmic-distance' as const, nearOpacity: .12, fullOpacity: 1, fadeStartDistanceM: 100, fullDistanceM: 100_000 };
  const parsed = parsePreparedWorldContext({ ...base, volume: { ...base.volume, [key]: profile } });
  expect(parsed.volume[key]).toEqual(profile);
  for (const distance of [0, 1, 47, 100]) expect(preparedVolumeOpacity(distance, parsed.volume[key])).toBe(.12);
  expect(preparedVolumeOpacity(Math.sqrt(100 * 100_000), profile)).toBeCloseTo(.56, 12);
  for (const distance of [100_000, 1e20]) expect(preparedVolumeOpacity(distance, profile)).toBe(1);
  expect(preparedVolumeOpacity(47, base.volume[key])).toBe(1);
  const samples = Array.from({ length: 101 }, (_, index) => preparedVolumeOpacity(100 * 1000 ** (index / 100), profile));
  expect(samples.every((value, index) => index === 0 || value >= samples[index - 1]!)).toBe(true);
  for (const invalid of [{ ...profile, model: 'linear' }, { ...profile, nearOpacity: -.01 }, { ...profile, fullOpacity: 1.01 },
    { ...profile, fullOpacity: Infinity }, { ...profile, nearOpacity: undefined }, { ...profile, fadeStartDistanceM: 0 },
    { ...profile, fullDistanceM: profile.fadeStartDistanceM }, { ...profile, runtimeExposure: true }]) {
    expect(() => parsePreparedWorldContext({ ...base, volume: { ...base.volume, [key]: invalid } })).toThrow(/opacity/i);
  }
});

test('prepared parent identities must form an acyclic hierarchy ending at the focus', () => {
  const source = plan(1), [a, b] = source.bodies;
  expect(() => parsePreparedWorldContext({ ...source, bodies: [
    { ...a, orbit: { ...a!.orbit, centerBodyId: b!.id, centerPositionM: b!.positionM } },
    { ...b, orbit: { ...b!.orbit, centerBodyId: a!.id, centerPositionM: a!.positionM } },
  ] })).toThrow('hierarchy');
});

test('satellite markers remain occluded by their parent when another detail object is selected', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), parent = source.bodies[0]!, child = source.bodies[1]!;
  const positionM = [100, 0, -20];
  const context = parsePreparedWorldContext({ ...source, bodies: [parent, { ...child, positionM,
    orbit: { ...child.orbit, centerBodyId: parent.id, centerPositionM: parent.positionM,
      verticesM: [positionM, ...orbitVertices(child.orbit!).slice(1)] } }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [100, 0, 20], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement;
  expect(find(root, 'contextBody', 'mercury').style.visibility).toBe('');
  expect(find(root, 'contextBody', 'venus').style.visibility).toBe('hidden');
  expect(find(root, 'contextBody', 'venus').style.pointerEvents).toBe('none');
  layer.destroy();
});

test('a prepared object outside the navigation menu renders and selects using its retained asset', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => index === 0 ? { ...body, id: 'new-object', name: 'New object' } : body) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, 'new-object': sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  expect(find(root, 'contextBody', 'new-object').dataset.objectNavigate).toBe('new-object');
  layer.selectObject('new-object');
  expectRetained(root, nodes);
  layer.destroy();
});

test('an orbitless prepared object renders and navigates without manufacturing orbital geometry', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), { orbit: _orbit, ...point } = source.bodies[0]!;
  const body = { ...point, id: 'future-object', name: 'Future object' };
  const context = parsePreparedWorldContext({ ...source, bodies: [body] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, 'future-object': sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const marker = find(root, 'contextBody', 'future-object'), selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  expect(marker.style.visibility).toBe('');
  marker.dispatchEvent(new Event('click'));
  expect(selections).toEqual(['future-object']);
  layer.selectObject('future-object');
  expectRetained(root, nodes);
  expect(layer.inspect().every(body => body.orbit.length === 0)).toBe(true);
  for (const orbit of [null, {}, { runtimeEphemeris: true }]) {
    expect(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit }] })).toThrow();
  }
  expect(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, radiusM: undefined }] })).toThrow();
  layer.destroy();
});

test('an orbit may centre on an orbitless prepared parent while remaining acyclic', () => {
  const source = plan(1), parent = source.bodies[0]!, child = source.bodies[1]!;
  const { orbit: _orbit, ...point } = parent;
  const parsed = parsePreparedWorldContext({ ...source, bodies: [point,
    { ...child, orbit: { ...child.orbit, centerBodyId: parent.id, centerPositionM: parent.positionM } }] });
  expect(parsed.bodies[0]!.orbit).toBeUndefined();
  expect(parsed.bodies[1]!.orbit!.centerBodyId).toBe(parent.id);
});

test('projects retained markers, culls focus-occluded bodies, and keeps physical scale invariant', () => {
  const near = mount(1), far = mount(1e12);
  const nearSun = find(near, 'contextBody', 'sun'), nearMercury = find(near, 'contextBody', 'mercury'), nearVenus = find(near, 'contextBody', 'venus');
  expect(mover(nearSun).style.transform).toContain('translate(30px,-20px)');
  expect(nearMercury.style.visibility).toBe('');
  expect(nearVenus.style.visibility).toBe('hidden');
  const nearOrbit = mounted.get(near)!.inspect().find(body => body.id === 'mercury')!.orbit.filter(element => element.style.visibility === '');
  expect(nearOrbit.length).toBeGreaterThan(0);
  for (const piece of nearOrbit) {
    const values = piece.style.transform.match(/-?[0-9.]+/g)!.map(Number);
    expect(Math.abs(values[4]!)).toBeLessThanOrEqual(400);
    expect(Math.abs(values[5]!)).toBeLessThanOrEqual(300);
  }
  expect(mover(nearMercury).style.transform).toBe(mover(find(far, 'contextBody', 'mercury')).style.transform);
  expect(nearOrbit.length).toBe(mounted.get(far)!.inspect().find(body => body.id === 'mercury')!.orbit.filter(element => element.style.visibility === '').length);
});

test('camera updates retain fixed stroke styles and only publish changed orbit picking policy', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const orbit = find(root, 'contextOrbit', 'mercury');
  const indicator = find(root, 'contextBody', 'mercury');
  const orbitWrites = vi.spyOn(orbit.style, 'setProperty');
  const indicatorWrites = vi.spyOn(indicator.style, 'setProperty');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  publish(1100); publish(1200);
  expect(orbitWrites).not.toHaveBeenCalled();
  expect(indicatorWrites).not.toHaveBeenCalled();
  expect(orbit.dataset.objectNavigate).toBe('mercury');
  layer.setBodyVisibility({ orbitHidden: ['mercury'] });
  expect(orbitWrites).not.toHaveBeenCalled();
  expect(orbit.dataset.objectNavigate).toBeUndefined(); orbitWrites.mockClear();
  publish(1250);
  expect(orbitWrites).not.toHaveBeenCalled();
  layer.setBodyVisibility({ orbitHidden: [] });
  expect(orbitWrites).not.toHaveBeenCalled();
  orbitWrites.mockClear();
  layer.setNavigationInFlight(true); layer.setNavigationInFlight(false);
  expect(orbitWrites).not.toHaveBeenCalled();
  expect(orbit.dataset.objectNavigate).toBe('mercury');
  layer.destroy();
});

test('distant ordinary bodies stop intercepting navigation while retained bodies remain selectable', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [source.bodies[0],
    { ...source.bodies[1], positionM: [0, 100, 0], orbit: orbit([0, 100, 0], 1) }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite },
    distantNavigation: { afterDistanceM: 500, nonNavigableIds: ['mercury'] } });
  const root = layer.root as unknown as FakeElement;
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  publish(400);
  expect(find(root, 'contextBody', 'mercury').dataset.objectNavigate).toBe('mercury');
  expect(find(root, 'contextBody', 'venus').dataset.objectNavigate).toBe('venus');
  publish(600);
  expect(find(root, 'contextBody', 'mercury').dataset.objectNavigate).toBeUndefined();
  expect(find(root, 'contextOrbit', 'mercury').dataset.objectNavigate).toBeUndefined();
  expect(find(root, 'contextBody', 'venus').dataset.objectNavigate).toBe('venus');
  publish(400);
  expect(find(root, 'contextBody', 'mercury').dataset.objectNavigate).toBe('mercury');
  layer.destroy();
});

test('orbit chords stop at the circular indicator on both sides of the centered body', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  expect(mercury.mover.style.visibility).toBe('');
  expect(mercury.billboard.style.width).toBe('16px');
  expect(mercury.center).toEqual([70, -20]);
  expect(mover(mercury.billboard).style.transform).toContain('translate(70px,-20px)');
  const edges: number[][] = [];
  for (const piece of mercury.orbit.filter(piece => piece.style.visibility === '')) {
    const [dx, dy, , , x, y] = piece.style.transform.slice(7, -1).split(',').map(Number);
    const t = Math.max(0, Math.min(1, ((70 - x) * dx + (-20 - y) * dy) / (dx * dx + dy * dy)));
    expect(Math.hypot(x + dx * t - 70, y + dy * t + 20)).toBeGreaterThanOrEqual(8 - 1e-5);
    for (const [ex, ey] of [[x, y], [x + dx, y + dy]]) {
      if (Math.abs(Math.hypot(ex - 70, ey + 20) - 8) < 1e-5) edges.push([ex, ey]);
    }
  }
  expect(edges.some(([, y]) => y > -20)).toBe(true);
  expect(edges.some(([, y]) => y < -20)).toBe(true);
  expect(find(root, 'contextBody', 'venus').style.visibility).toBe('hidden');
  layer.destroy();
});

test('body circles fade with apparent size, remain clickable, and reuse their nodes', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const indicator = find(root, 'contextBody', 'mercury');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(100);
  expect(annotationVisibility(indicator, 'indicator')).toBe('hidden');
  expect(indicator.style.pointerEvents).toBe('none');
  publish(140);
  expect(Number(indicator.parentNode!.style.opacity)).toBeGreaterThan(0);
  expect(Number(indicator.parentNode!.style.opacity)).toBeLessThan(1);
  publish(200);
  expect(Number(indicator.parentNode!.style.opacity)).toBeGreaterThan(0.98);
  expect(Number(indicator.parentNode!.style.opacity)).toBeLessThanOrEqual(1);
  expect(indicator.dataset.objectNavigate).toBe('mercury');
  const selections: string[] = [];
  root.parentNode!.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  indicator.dispatchEvent(new Event('click'));
  expect(selections).toEqual(['mercury']);
  expectRetained(root, nodes);
  layer.destroy();
});

test('orbit and circle keep a one-pixel stroke across zoom and physical system size', () => {
  for (const scale of [1, 1e12]) {
    const root = mount(scale), layer = mounted.get(root)!;
    const strokeAt = (extent: number) => {
      layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
        pose: { positionM: [0, 0, 80000 / extent * scale], orientationXyzw: [0, 0, 0, 1] } },
        { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 5000, heightPixels: 5000 });
      const mercury = layer.inspect().find(body => body.id === 'mercury')!;
      const marker = mercury.billboard as unknown as FakeElement;
      const orbitRoot = (mercury.orbit[0].parentNode as unknown as FakeElement).parentNode!;
      expect(marker.style['--context-line-width']).toBeUndefined();
      expect(orbitRoot.style['--context-line-width']).toBeUndefined();
      expect(find(root, 'contextBody', 'sun').style['--context-line-width']).toBeUndefined();
      return CONTEXT_LINE_WIDTH;
    };
    expect(strokeAt(512)).toBe(1);
    expect(strokeAt(Math.sqrt(64 * 512))).toBe(1);
    expect(strokeAt(64)).toBeCloseTo(1);
    expect(strokeAt(24)).toBe(1);
    const crowded = layer.inspect().find(body => body.id === 'mercury')!;
    expect(crowded.indicatorShown).toBe(false);
    expect(crowded.orbit.some(piece => piece.style.visibility === '')).toBe(false);
    expect(strokeAt(8)).toBe(1);
    expect(layer.inspect().find(body => body.id === 'mercury')!.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
    layer.destroy();
  }
});

test('orbit settings preserve admitted captions and their placements', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const labels = () => layer.inspect().filter(body => body.labelShown).map(body => [body.id, body.labelRect]);
  const before = structuredClone(labels());
  expect(before.length).toBeGreaterThan(0);
  layer.setBodyVisibility({ orbitHidden: ['mercury', 'venus'] });
  expect(labels()).toEqual(before);
  expect(layer.inspect().flatMap(body => body.orbit).some(paintedOrbitLeaf)).toBe(false);
  layer.destroy();
});

test('overlapping circles retain selection priority and reappear when separated', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 1000; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: 0.1, positionM: [400 + index * 10, 0, 0],
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const mercury = find(root, 'contextBody', 'mercury'), venus = find(root, 'contextBody', 'venus');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(2000);
  expect(mercury.style.visibility).toBe('');
  expect(annotationVisibility(venus, 'indicator')).toBe('hidden');
  expect(venus.style.pointerEvents).toBe('none');
  const venusMarker = find(root, 'contextBody', 'venus');
  expect(venusMarker.style.visibility).toBe(''); // Decluttering only hides annotations.
  let writes = 0;
  for (const node of [mover(venusMarker)]) {
    let transform = node.style.transform;
    Object.defineProperty(node.style, 'transform', {
      get: () => transform, set: value => { writes++; transform = value; },
    });
  }
  publish(2200); publish(2500);
  expect(writes).toBe(2); // The visible physical sprite follows both camera samples.
  layer.selectObject('venus'); publish(2000);
  expect(writes).toBe(3);
  expect(billboardCenter(venus)).toEqual([82, 0]);
  expect(venusMarker).toBe(venus);
  expect(venus.style.visibility).toBe('');
  expect(annotationVisibility(mercury, 'indicator')).toBe('hidden');
  publish(160);
  expect(mercury.style.visibility).toBe('');
  expect(venus.style.visibility).toBe('');
  expectRetained(root, nodes);
  layer.destroy();
});

test.each([
  ['planet', 'dwarf-planet'], ['planet', 'comet'], ['planet', 'asteroid'],
  ['dwarf-planet', 'comet'], ['dwarf-planet', 'asteroid'], ['comet', 'asteroid'],
])('%s annotations outrank %s through zoom, even after the lower class was visible first', (higher, lower) => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 1000; host.append(before);
  const source = plan(1);
  const objects = [lower, higher].map(classification => SCENE_OBJECTS.find(object => object.classification === classification)!);
  const context = parsePreparedWorldContext({ ...source,
    system: { fadeOutStartDistanceM: 10_000, hiddenDistanceM: 1e30 },
    bodies: objects.map((object, index) => ({
    ...source.bodies[0], id: object.id, name: object.name, radiusM: .1,
    positionM: [400 + index * 30, 0, 0],
    orbit: { ...source.bodies[0].orbit, verticesM: orbit([100, 0, 0], 1).verticesM.map(([x, y, z]) => [x + 300 + index * 30, y, z]) },
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries(['sun', ...objects.map(object => object.id)].map(id => [id, sprite])),
    annotationPriorities: Object.fromEntries(objects.map(object => [object.id, labelImportance(object.classification)])),
  });
  layer.setOverview(true);
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const [minor, major] = objects.map(object => layer.inspect().find(body => body.id === object.id)!);
  const publish = (distance: number) => {
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [0, 0] });
    document.defaultView.advance(200);
  };
  // Selection initially gives the lower class the retained visibility bonus.
  layer.previewSelection(objects[0].id); publish(1000);
  expect(annotationVisibility(minor.billboard, 'indicator')).toBe('');
  layer.previewSelection(null);
  const distances = Array.from({ length: 61 }, (_, index) => 400 + index * 20);
  for (const distance of [...distances, ...distances.toReversed()]) {
    publish(distance);
    expect(major.mover.style.visibility).toBe('');
    expect(major.mover.style.visibility).toBe('');
    for (const body of [minor, major]) {
      expect(body.mover.style.visibility).toBe('');
      // Ranking decides captions and circles; a named body always keeps the path beside it.
      if (body.labelShown) expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
      expect(body.indicatorShown).toBe(body.labelShown);
    }
  }
  publish(1000);
  expect(annotationVisibility(minor.billboard, 'indicator')).toBe('hidden');
  // Direct interaction can still reveal a lower-priority body and its label.
  (minor.billboard as unknown as FakeElement).dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange')); publish(1000);
  expect(annotationVisibility(minor.billboard, 'indicator')).toBe('');
  expect(annotationVisibility(minor.billboard, 'indicator')).toBe('');
  delete (minor.billboard as unknown as FakeElement).dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  layer.previewSelection(objects[0].id); publish(1000);
  expect(annotationVisibility(minor.billboard, 'indicator')).toBe('');
  expect(annotationVisibility(minor.billboard, 'indicator')).toBe('');
  layer.previewSelection(null); publish(1000);
  expect(major.mover.style.visibility).toBe('');
  expectRetained(root, nodes);
  layer.destroy();
});

test('the Sun circle and label remain visible after all planetary context fades at maximum range', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, camera: { ...source.camera, maximumDistanceM: 1e12 },
    system: { fadeOutStartDistanceM: 100, hiddenDistanceM: 1000 } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  for (const distance of [10000, context.camera.maximumDistanceM]) {
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [30, -20] });
    expect(root.hidden).toBe(false);
    expect(find(root, 'contextBody', 'sun').style.visibility).toBe('');
    expect(find(root, 'contextBody', 'sun').parentNode!.style.opacity).toBe('1');
    expect(find(root, 'contextLabel', 'sun').style.visibility).toBe('');
    expect(find(root, 'contextLabel', 'sun').dataset.objectNavigate).toBe('sun');
    expect(find(root, 'contextBody', 'mercury').style.visibility).toBe('hidden');
    expect(find(root, 'contextLabel', 'mercury').style.visibility).toBe('hidden');
    expect(layer.inspect().flatMap(body => body.orbit).every(piece => piece.style.visibility === 'hidden')).toBe(true);
  }
  expectRetained(root, nodes);
  layer.destroy();
});

test('retired bodies stop receiving zoom writes and resume with current picking after indicator toggles', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, viewport);
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  publish(1e31); root.ownerDocument.defaultView.advance(200);
  const writes: string[] = [];
  const group = find(root, 'contextGroup', 'mercury');
  for (const node of [mover(group), group, ...all(group)]) for (const key of Object.keys(node.style)) {
    let value = node.style[key];
    if (typeof value !== 'string') continue;
    Object.defineProperty(node.style, key, { get: () => value, set: next => { writes.push(key); value = next; }, configurable: true });
  }
  publish(2e31); publish(3e31);
  expect(writes).toEqual([]);
  expect(find(root, 'contextLabel', 'sun').dataset.objectNavigate).toBe('sun');
  expect(mercury.billboard.dataset.objectNavigate).toBeUndefined();
  expect(layer.backgroundExclusionRects()).toEqual([...layer.labelExclusionRects(),
    { left: 22, right: 38, top: -28, bottom: -12 }]); // Only the Sun's caption and 16 px circle remain.
  publish(1000);
  expect(writes.length).toBeGreaterThan(0);
  expect(mercury.billboard.dataset.objectNavigate).toBe('mercury');
  expect(mercury.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  // Hiding overlays before retirement must not restore their old visible state
  // when the controls are re-enabled at galaxy distance.
  layer.setNavigationInFlight(true); publish(1e31); publish(2e31);
  layer.setNavigationInFlight(false);
  expect(mercury.mover.style.visibility).toBe('hidden');
  expect(mercury.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
  // A flight holds keyboard and accessibility state instead of disabling and
  // restoring every body, so the retired marker keeps the target it committed
  // while it was drawn; its hidden visibility keeps it out of the tab order.
  expect(mercury.billboard.dataset.objectNavigate).toBe('mercury');
  publish(1000);
  expect(mercury.billboard.dataset.objectNavigate).toBe('mercury');
  expectRetained(root, nodes);
  layer.destroy();
});

test('retired depth groups defer rotation and selection writes until same-pose re-entry', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const publish = (z: number, orientationXyzw: OrientationXyzw = [0, 0, 0, 1]) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, z], orientationXyzw },
  }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1e31); root.ownerDocument.defaultView.advance(200);
  let writes = 0;
  for (const id of ['mercury', 'venus']) {
    const style = mover(find(root, 'contextGroup', id)).style;
    let zIndex = style.zIndex;
    Object.defineProperty(style, 'zIndex', { get: () => zIndex, set: value => { writes++; zIndex = value; } });
  }
  const halfTurn: OrientationXyzw = [0, 1, 0, 0];
  publish(-1e31, halfTurn);
  layer.selectObject('venus'); publish(-2e31, halfTurn);
  expect(writes).toBe(0);
  const depth = (id: string) => Number(mover(find(root, 'contextGroup', id)).style.zIndex);
  expect(depth('sun')).toBeLessThan(0);
  // Distance alone resumes the system; the cached orientation/selection are
  // unchanged, so re-entry itself must invalidate the depth publication scope.
  publish(-1000, halfTurn);
  expect(writes).toBeGreaterThan(0);
  expect(depth('venus')).toBe(0);
  expect(depth('mercury')).toBeGreaterThan(depth('sun'));
  expect(depth('mercury')).toBeLessThan(0);
  expectRetained(root, nodes);
  layer.destroy();
});

test('dolly motion leaves depth styles untouched while selection and rotation still reorder retained groups', () => {
  const root = mount(1), layer = mounted.get(root)!;
  let writes = 0;
  for (const id of ['sun', 'mercury', 'venus']) {
    const style = mover(find(root, 'contextGroup', id)).style;
    let zIndex = style.zIndex;
    Object.defineProperty(style, 'zIndex', { get: () => zIndex, set: value => { writes++; zIndex = value; } });
  }
  const publish = (distance: number, orientationXyzw: OrientationXyzw = [0, 0, 0, 1]) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  for (const distance of [200, 2000, 1e8, 2e8]) publish(distance);
  expect(writes).toBe(0);
  layer.selectObject('venus'); publish(2000);
  expect(writes).toBeGreaterThan(0);
  // Venus is occluded here. Its depth style is deferred until it can draw.
  expect(find(root, 'contextGroup', 'venus').style.visibility).toBe('hidden');
  expect(Number(mover(find(root, 'contextGroup', 'sun')).style.zIndex)).toBeGreaterThan(3);
  writes = 0; publish(3000); expect(writes).toBe(0);
  publish(-3000, [0, 1, 0, 0]);
  expect(writes).toBeGreaterThan(0);
  expect(mover(find(root, 'contextGroup', 'venus')).style.zIndex).toBe('0');
  expect(Number(mover(find(root, 'contextGroup', 'mercury')).style.zIndex)).toBeLessThan(0);
  expect(find(root, 'contextGroup', 'sun').style.visibility).toBe('');
  layer.destroy();
});

test('selection transfers the detail handoff to the destination while retaining every orbit and marker', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const camera: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, 20], orientationXyzw: [0, 0, 0, 1] } } as const;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  layer.publish(camera, viewport);
  const marker = find(root, 'contextBody', 'mercury');
  expect(marker.style.visibility).toBe('');
  expect(marker.dataset.objectNavigate).toBe('mercury');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  marker.dispatchEvent(new Event('click'));
  expect(selections).toEqual(['mercury']);
  layer.selectObject('mercury'); layer.publish(camera, viewport);
  expect(marker.style.visibility).toBe('hidden');
  expect(marker.style.pointerEvents).toBe('none');
  marker.dispatchEvent(new Event('click'));
  expect(selections).toEqual(['mercury']);
  expectRetained(root, nodes);
  expect(() => layer.selectObject('unprepared')).toThrow('unavailable');
  layer.selectObject('sun'); layer.publish(camera, viewport);
  expect(marker.style.visibility).toBe('');
  layer.destroy();
});

test('crowded labels keep selection and hover priority, disable hidden targets, and reappear with clearance', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: 1, positionM: [400 + index * 10, 0, 0],
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const mercury = find(root, 'contextLabel', 'mercury'), venus = find(root, 'contextLabel', 'venus');
  const publish = (focalPixels = 400) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [400, 0, 2000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels, principalOffsetPixels: [0, 0] });
  const shown = () => [mercury, venus].filter(label => annotationVisibility(label, 'label') === '').map(label => label.dataset.contextName);
  publish(); expect(shown()).toEqual(['Mercury']);
  expect(venus.style.pointerEvents).toBe('none');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  // The hidden caption has no hit rectangle; the visible physical dot still navigates.
  expect(layer.inspect().find(body => body.id === 'venus')!.labelRect).toBeNull();
  venus.dispatchEvent(new Event('click')); expect(selections).toEqual(['venus']);
  layer.selectObject('venus'); publish(); expect(shown()).toEqual(['Venus']);
  find(root, 'contextBody', 'mercury').dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  publish(); expect(shown()).toEqual(['Mercury']); // Hover takes priority over selection.
  delete find(root, 'contextBody', 'mercury').dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  layer.selectObject('sun');
  publish(8800); expect(shown()).toEqual(['Mercury']);
  publish(10000); expect(shown()).toEqual(['Mercury', 'Venus']);
  publish(9200); expect(shown()).toEqual(['Mercury', 'Venus']);
  publish(8800); expect(shown()).toEqual(['Mercury']);
  publish(9200); expect(shown()).toEqual(['Mercury', 'Venus']);
  expect(mercury.measurements).toBe(1); expect(venus.measurements).toBe(1);
  expectRetained(root, nodes);
  layer.destroy();
});


test.each(['pointer', 'keyboard'])('a hidden moon annotation reveals together on %s interaction', interaction => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [
    { ...source.bodies[0], positionM: [400, 0, 0], orbit: orbit([400, 0, 0], 1) },
    { ...source.bodies[1], positionM: [460, 0, 0], radiusM: .1,
      orbit: { ...orbit([460, 0, 0], 1), centerBodyId: 'mercury', centerPositionM: [400, 0, 0] } },
  ] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.setBodyVisibility({ orbitHidden: ['venus'] });
  layer.setBodyVisibility({ labelHidden: ['venus'] });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const circle = find(root, 'contextBody', 'venus'), label = find(root, 'contextLabel', 'venus');
  expect(annotationVisibility(circle, 'indicator')).toBe('hidden');
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  for (const active of [true, false]) {
    if (interaction === 'pointer') circle.dataset.objectHovered = String(active);
    else Object.assign(document, { activeElement: active ? circle : null });
    host.dispatchEvent(new Event(interaction === 'pointer' ? 'objecthoverchange' : active ? 'focusin' : 'focusout'));
    document.defaultView.advance(16); document.defaultView.advance(200);
    expect(annotationVisibility(circle, 'indicator')).toBe(active ? '' : 'hidden');
    expect(annotationVisibility(label, 'label')).toBe(active ? '' : 'hidden');
    if (active) expect(label.dataset.contextIndicatorHovered).toBe('true');
  }
  expectRetained(root, nodes);
  layer.destroy();
});

test('an in-frame circle and caption stay visible and constrained at the viewport edge', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0], positionM: [990, 740, 0], orbit: orbit([990, 740, 0], 1) }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.setBodyVisibility({ orbitHidden: ['mercury'] });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement;
  const circle = find(root, 'contextBody', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  expect(annotationVisibility(circle, 'indicator')).toBe('');
  expect(annotationVisibility(label, 'label')).toBe('');
  const beforeHover = captionPosition(label);
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); document.defaultView.advance(200);
  expect(annotationVisibility(circle, 'indicator')).toBe('');
  expect(annotationVisibility(label, 'label')).toBe('');
  const [x, y] = captionPosition(label);
  expect([x, y]).toEqual(beforeHover);
  expect(x).toBeGreaterThanOrEqual(-396); expect(x + label.dataset.contextName.length * 6).toBeLessThanOrEqual(396);
  expect(y).toBeGreaterThanOrEqual(-296); expect(y + 14).toBeLessThanOrEqual(296);
  layer.destroy();
});

test('the Sun caption stays above its marker as orbit strokes cross during zoom', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const label = find(root, 'contextLabel', 'sun');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(1200);
  expect(annotationVisibility(label, 'label')).toBe('');
  publish(4000);
  expect(annotationVisibility(label, 'label')).toBe('');
  expect(captionPosition(label)).toEqual([-9, -26]);
  publish(1200);
  expect(annotationVisibility(label, 'label')).toBe('');
  publish(8000);
  expect(annotationVisibility(label, 'label')).toBe('');
  expect(captionPosition(label)).toEqual([-9, -26]);
  layer.destroy();
});

test.each([
  { reason: 'an orbit clears the visible stroke', y: 81.5, extent: 200, weight: 1, shown: true },
  { reason: 'a visible orbit crosses the text', y: 50, extent: 200, weight: 1, shown: true },
  { reason: 'the crossing orbit trail is faded away', y: 50, extent: 200, weight: .01, shown: true },
  { reason: 'a small resolved orbit still crosses the text', y: 50, extent: 65, weight: 1, shown: true },
  { reason: 'the orbit is unresolved at this zoom', y: 10, extent: 10, weight: 1, shown: true },
])('the Sun caption remains readable across orbit strokes when $reason', ({ y, extent, weight, shown }) => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), body = source.bodies[0], positionM = [-extent, -extent, 0];
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...body, positionM, orbit: { ...body.orbit,
    verticesM: [positionM, [-extent, y, 0], [extent, y, 0], [extent, -extent, 0],
      positionM, [-extent, y, 0], [extent, y, 0], [extent, -extent, 0]], trail: Array(8).fill(weight),
  } }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.setOverview(true);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const label = find(layer.root as unknown as FakeElement, 'contextLabel', 'sun');
  expect(annotationVisibility(label, 'label')).toBe(shown ? '' : 'hidden');
  expect(label.style.pointerEvents).toBe('none');
  if (shown) expect(captionPosition(label)).toEqual([-9, -26]);
  layer.destroy();
});


test('switching to the Solar System card immediately reveals the Sun ring without another camera frame', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 500], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  const ring = find(root, 'contextBody', 'sun');
  expect(annotationVisibility(ring, 'indicator')).toBe('hidden');
  layer.setOverview(true);
  expect(annotationVisibility(ring, 'indicator')).toBe('');
  expect(ring.dataset.objectNavigate).toBe('sun');
  expect(ring.parentNode!.style.opacity).toBe('1');
  layer.setOverview(false);
  expect(annotationVisibility(ring, 'indicator')).toBe('hidden');
  layer.destroy();
});


test.each([true, false])('crowding retires complete annotations and their orbits while preserving physical bodies (closed=%s)', closed => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => {
    const positionM = [20 + index * 10, 0, 0];
    return { ...body, radiusM: .1, positionM, orbit: { ...body.orbit,
      verticesM: [positionM, [0,500,0], [-500,0,0], [0,-500,0], [500,0,0], [0,500,0], [-500,0,0], [0,-500,0]],
      trail: closed ? body.orbit!.trail : body.orbit!.trail.map(() => .75) } };
  }) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite} });
  layer.setOverview(true);
  const publish = (distance: number) => layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]}}, {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(2000);
  const entries = layer.inspect();
  expect(entries[0].mover.style.visibility).toBe('');
  for (const body of entries.slice(1)) {
    expect(body.indicatorShown).toBe(false);
    expect(body.labelShown).toBe(false);
    expect(body.mover.style.visibility).toBe('');
    expect(body.billboard.style.pointerEvents).toBe('none');
    // Too far for this camera to name any of them: no captions, and no unidentified paths.
    expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(false);
  }
  publish(100);
  for (const body of entries.slice(1)) {
    expect(body.mover.style.visibility).toBe('');
    if (body.labelShown) expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  }
  layer.destroy();
});

test.each([true, false])('admitted annotations retain physical alpha while orbit extent controls optional line paint (closed=%s)', closed => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 5000; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0],
    positionM: [500, 0, 0], radiusM: .1,
    orbit: { ...source.bodies[0].orbit,
      verticesM: [[500,0,0], [550,50,0], [600,0,0], [550,-50,0], [500,0,0], [550,50,0], [600,0,0], [550,-50,0]],
      trail: Array(8).fill(closed ? 1 : .75) },
  }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite} });
  layer.setOverview(true);
  const nodes = all(layer.root as unknown as FakeElement);
  const body = layer.inspect().find(entry => entry.id === 'mercury')!;
  const orbitRoot = find(layer.root as unknown as FakeElement, 'contextOrbit', 'mercury');
  for (const extent of [160, 80, 48, 32, 24, 16, 8, 16, 24, 32, 48, 80, 160]) {
    layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: {positionM: [0, 0, 40000 / extent], orientationXyzw: [0, 0, 0, 1]}},
      {focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 5000, heightPixels: 5000});
    // Culled indicators retain their last paint values; visible fades still match exactly.
    expect(Number(body.mover.style.opacity)).toBeGreaterThanOrEqual(Number(orbitRoot.style.opacity));
    expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(body.labelShown && extent > 12);
    // Body-parent separation is five times this fixture's tiny orbit extent.
    // Indicator readability follows that separation, independently of orbit paint.
    expect(body.indicatorShown).toBe(body.labelShown);
    expect(body.billboard.style.pointerEvents).toBe('none');
  }
  expectRetained(layer.root as unknown as FakeElement, nodes);
  layer.destroy();
});

test('an offscreen context body keeps the ring the camera crosses; explicit selection retains the clipped path', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0],
    positionM: [2000, 0, 0],
    orbit: { ...source.bodies[0].orbit,
      verticesM: [[2000,0,0], [100,100,0], [-100,100,0], [-200,0,0], [-100,-100,0], [100,-100,0], [1000,-50,0], [1500,-20,0]],
      trail: Array(8).fill(.75) },
  }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite} });
  layer.setOverview(true);
  layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1]}},
    {focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600});
  const body = layer.inspect().find(entry => entry.id === 'mercury')!;
  expect(body.mover.style.visibility).toBe('hidden');
  // The body is off screen and cannot own an annotation, but its path still crosses
  // the viewport and remains useful in the ordinary context view.
  expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  layer.setOverview(false); layer.selectObject('mercury');
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  layer.destroy();
});

test('a label cannot cover a neighbouring circle even when the two labels fit', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: .1, positionM: [100 + index * 80, 0, 0],
  })) });
  const layer = mountTestContext({host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite}});
  layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 400], orientationXyzw: [0, 0, 0, 1]}}, {focalPixels: 400, principalOffsetPixels: [0, 0]});
  const entries = layer.inspect();
  expect(entries.filter(body => body.labelShown).length).toBeGreaterThan(1);
  for (const body of entries.filter(body => body.labelShown)) {
    const [x, y] = captionPosition(body.billboard);
    const width = captionName(body.billboard).length * 6;
    for (const other of entries.filter(other => other !== body && other.indicatorShown)) {
      const [cx, cy] = other.center;
      expect(Math.hypot(Math.max(x, Math.min(x + width, cx)) - cx,
        Math.max(y, Math.min(y + 14, cy)) - cy)).toBeGreaterThanOrEqual(12);
    }
  }
  layer.destroy();
});

test('one retained focus label and locator survive system retirement at their physical galaxy position', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1);
  const context = parsePreparedWorldContext({ ...base,
    focus: { ...base.focus, id: 'anchor', name: 'Anchor' },
    bodies: base.bodies.map(body => ({ ...body, orbit: { ...body.orbit, centerBodyId: 'anchor' } })),
    system: { fadeOutStartDistanceM: 1000, hiddenDistanceM: 10000 } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { anchor: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const focus = layer.inspect().find(body => body.id === 'anchor')!;
  const label = focus.billboard as unknown as FakeElement, locator = focus.billboard as unknown as FakeElement;
  const retained = all(host);
  expect(label.dataset.contextName).toBe('Anchor');
  expect(mover(label).parentNode).toBe(root);
  expect(mover(label).children).toEqual([label]);
  // The only child is the sprite, which alone scales; the ring and caption stay pseudos of the unscaled marker.
  expect(label.children.map(child => child.tagName)).toEqual(['i']); expect(label.children[0]!.children).toHaveLength(0); expect(label).toBe(locator);
  expect(all(host).filter(node => node.dataset.contextLabel === 'anchor')).toEqual([label]);
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const camera = (distance: number): {referenceFrame: string; epochJdTt: number; pose: {positionM: [number, number, number]; orientationXyzw: OrientationXyzw}} => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } });
  // The caption remains visible when the intermediate orbit crosses it.
  for (const [distance, locatorOpacity, captionVisible] of [[50, 0, false], [Math.sqrt(1000 * 10000), 1, true], [8000, 1, true], [1e21, 1, true], [50, 0, false]] as const) {
    layer.publish(camera(distance!), viewport);
    document.defaultView.advance(200);
    if (locatorOpacity) expect(Number(locator.parentNode!.style.opacity)).toBeCloseTo(1);
    expect(annotationVisibility(locator, 'indicator')).toBe(locatorOpacity! > 0 ? '' : 'hidden');
    expect(annotationVisibility(label, 'label')).toBe(captionVisible ? '' : 'hidden');
    expectRetained(host, retained);
  }
  const distant = camera(1e21);
  distant.pose.positionM = [-1e20, 5e19, 1e21];
  layer.publish(distant, viewport);
  document.defaultView.advance(200);
  expect(layer.inspect().filter(body => body.id !== 'anchor').every(body => body.mover.style.visibility === 'hidden')).toBe(true);
  expect(mover(label).hidden).toBe(false); expect(mover(label).parentNode!.hidden).toBe(false);
  expect(annotationVisibility(label, 'label')).toBe(''); expect(Number(label.parentNode!.style.opacity)).toBeCloseTo(1);
  expect(annotationVisibility(locator, 'indicator')).toBe(''); expect(Number(locator.parentNode!.style.opacity)).toBeCloseTo(1);
  expect(billboardCenter(locator)).toEqual([70, 0]);
  expect(captionPosition(label)).toEqual([52, -26]);
  expect(locator.dataset.objectNavigate).toBe('anchor');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  label.dispatchEvent(new Event('click')); expect(selections).toEqual(['anchor']);
  // Roll moves the physical projected location; a reversed view must cull it.
  distant.pose.orientationXyzw = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  layer.publish(distant, viewport);
  expect(billboardCenter(locator)).not.toEqual([70, -40]);
  const poses: PhysicalCameraPose[] = [
    { ...camera(1e21).pose, orientationXyzw: [0, 1, 0, 0] },
    { ...camera(1e21).pose, positionM: [-2e21, 0, 1e21] },
  ];
  for (const pose of poses) {
    layer.publish({ ...distant, pose }, viewport);
    expect(annotationVisibility(locator, 'indicator')).toBe('hidden'); expect(annotationVisibility(label, 'label')).toBe('hidden');
    expect(locator.style.pointerEvents).toBe('none'); expect(label.style.pointerEvents).toBe('none');
    label.dispatchEvent(new Event('click')); expect(selections).toEqual(['anchor']);
  }
  layer.destroy(); expect(host.children).toEqual([before]);
  label.dispatchEvent(new Event('click')); expect(selections).toEqual(['anchor']);
  expect(label.measurements, 'camera publication must never remeasure label layout').toBe(1);
});

test('the selected moon family shows readable labels, then fades at system distance', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), parent = { ...base.bodies[0]!, radiusM: 5 }, satellite = base.bodies[1]!;
  const positionM = [250, 0, 0];
  const context = parsePreparedWorldContext({ ...base, system: { fadeOutStartDistanceM: 1e10, hiddenDistanceM: 1e11 },
    bodies: [parent, { ...satellite, positionM, orbit: { ...satellite.orbit, centerBodyId: parent.id,
      centerPositionM: parent.positionM, verticesM: [[250,0,0],[200,100,0],[100,150,0],[0,100,0],[-50,0,0],[0,-100,0],[100,-150,0],[200,-100,0]] } }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const child = layer.inspect().find(body => body.id === satellite.id)!;
  const marker = child.billboard as unknown as FakeElement, label = child.billboard as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  const camera = (z: number): WorldCameraPose => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [100, 0, z], orientationXyzw: [0, 0, 0, 1] } });
  layer.selectObject(parent.id);
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  expect(marker.style.visibility).toBe(''); expect(annotationVisibility(label, 'label')).toBe('');
  expect(label.style.pointerEvents).toBe('none');
  layer.publish(camera(180), viewport);
  expect(marker.style.visibility).toBe(''); expect(annotationVisibility(label, 'label')).toBe('');
  expect(label.dataset.objectNavigateActivation).toBe('click'); expect(label.style.pointerEvents).toBe('none');
  const [left, top] = captionPosition(label);
  const rect = child.labelRect!;
  expect(rect.left).toBeCloseTo(left, 5); expect(rect.top).toBeCloseTo(top, 5);
  expect(rect.right - rect.left).toBe(label.dataset.contextName.length * 6);
  expect(layer.labelExclusionRects()).toContainEqual(rect);
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  expect(marker.style.visibility).toBe(''); expect(annotationVisibility(label, 'label')).toBe('');
  layer.publish(camera(12000), viewport);
  document.defaultView.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden');
  expect(label.style.pointerEvents).toBe('none'); expect(label.measurements).toBe(1);
  layer.destroy(); expect(layer.labelExclusionRects()).toEqual([]);
});

test('resolved body labels remain visible alongside faint close-up orbit lines', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), position = [35, 0, -60] as const;
  const context = parsePreparedWorldContext({ ...base, bodies: [{ ...base.bodies[0],
    positionM: position, radiusM: 8, orbit: orbit(position, 1) }] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 40], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const body = layer.inspect().find(body => body.id === 'mercury')!;
  expect(body.mover.style.visibility).toBe('');
  expect(body.orbit.some(paintedOrbitLeaf)).toBe(true);
  expect(Number(find(layer.root as unknown as FakeElement, 'contextOrbit', 'mercury').style.opacity)).toBeGreaterThan(0);
  expect(body.mover.style.visibility).toBe('');
  expect(body.billboard.dataset.objectNavigate).toBe('mercury');
  const [labelX, labelY] = captionPosition(body.billboard);
  expect(labelX + 'Mercury'.length * 6 / 2).toBeCloseTo(140);
  expect(labelY).toBeGreaterThan(32);
  layer.destroy();
});

test('a moon label tries the other side when its first position overlaps the selected parent label', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1);
  const parent = { ...base.bodies[0], name: 'Jupiter', radiusM: 7, positionM: [400, 0, 0], orbit: orbit([400, 0, 0], 1) };
  // Below the parent on screen: the identity pose has +y up, so the moon sits at -y.
  const moon = { ...base.bodies[1], name: 'Ganymede', radiusM: .1, positionM: [326, -32, 0],
    orbit: { ...base.bodies[1].orbit, centerBodyId: parent.id, centerPositionM: parent.positionM,
      verticesM: [[326,-32,0], [400,-150,0], [550,0,0], [400,150,0], [250,0,0], [400,-150,0], [550,0,0], [400,150,0]] } };
  const context = parsePreparedWorldContext({ ...base, bodies: [parent, moon] });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite} });
  layer.selectObject(parent.id);
  const camera: WorldCameraPose = { referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: {positionM: [400, 0, 400], orientationXyzw: [0, 0, 0, 1]} };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let frame = 0; frame < 3; frame++) {
    layer.publish(camera, viewport); document.defaultView.advance(200);
    const label = layer.inspect().find(body => body.id === moon.id)!.billboard;
    expect(annotationVisibility(label, 'label')).toBe('');
    expect(captionPosition(label)[0]).toBeLessThan(-74);
    const rects = layer.labelExclusionRects();
    expect(rects).toHaveLength(2);
    expect(labelRectsOverlap(rects[0], rects[1], 4)).toBe(false);
  }
  layer.destroy();
});

test.each([1, 1e9, 1e16])('an orbit interior does not exclude background annotations at physical scale %s', scale => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(scale), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const camera: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000 * scale], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  layer.publish(camera, viewport);
  const backgroundText = { left: -10, top: 20, right: 10, bottom: 30 };
  expect(layer.labelExclusionRects().every(rect => !labelRectsOverlap(backgroundText, rect))).toBe(true);
  expect(layer.inspect().some(body => body.orbit.some(piece => piece.style.visibility === ''))).toBe(true);
  expect(layer.backgroundExclusionRects().some(rect => labelRectsOverlap(backgroundText, rect))).toBe(false);
  const circle = layer.inspect().find(body => body.id === 'mercury')!;
  expect(circle.indicatorShown).toBe(true);
  const [x, y] = circle.center;
  expect(layer.backgroundExclusionRects()).toContainEqual({ left: x - 8, right: x + 8, top: y - 8, bottom: y + 8 });
  expect(layer.inspect().find(body => body.id === 'sun')!.mover.style.visibility).toBe('');
  // Close orbits clip the viewport; they must not claim the entire background.
  layer.publish({ ...camera, pose: { ...camera.pose, positionM: [0, 0, 50 * scale] } }, viewport);
  expect(layer.backgroundExclusionRects()).toEqual(layer.labelExclusionRects());
  layer.destroy();
});

test.each([1, 1e9, 1e16])('stars returning during a drag regain annotations at physical scale %s', scale => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(scale);
  const context = parsePreparedWorldContext({ ...base, bodies: base.bodies.map((body, index) => ({
    ...body, orbit: undefined, positionM: [(index ? -250 : 250) * scale, 120 * scale, 0],
  })) });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const camera: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000 * scale], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  const stars = () => layer.inspect().filter(body => body.id !== 'sun');
  layer.publish(camera, viewport);
  expect(stars().every(body => body.labelShown && body.indicatorShown)).toBe(true);
  layer.setRotationActive(true);
  layer.publish(camera, { ...viewport, principalOffsetPixels: [1000, 0] });
  expect(stars().every(body => !body.labelShown && !body.indicatorShown)).toBe(true);
  layer.publish(camera, viewport);
  expect(stars().every(body => body.labelShown && body.indicatorShown)).toBe(true);
  layer.setRotationActive(false);
  layer.publish(camera, viewport);
  expect(stars().every(body => body.labelShown && body.indicatorShown)).toBe(true);
  layer.destroy();
});

test('billboard zoom alpha owns dot, circle and caption without per-label clocks', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const body = layer.inspect().find(body => body.id === 'mercury')!, element = body.billboard as unknown as FakeElement;
  const nodes = all(root);
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1000);
  expect(element.children.map(child => child.tagName)).toEqual(['i']); expect(element.textContent).toBe('');
  expect(element.dataset.contextName).toBe('Mercury');
  expect(element.dataset.contextLabelVisible).toBe('true');
  expect(Number((element.parentNode as unknown as HTMLElement).style.opacity)).toBeGreaterThan(0);
  expect(clock.timers.size).toBe(0); expect(layer.opacityStats().active).toBe(0);
  publish(1e31);
  expect(element.style.visibility).toBe('hidden');
  expect(element.dataset.objectNavigate).toBeUndefined();
  publish(1000);
  expect(element.style.visibility).toBe('');
  expect(element.dataset.objectNavigate).toBe('mercury');
  expect(clock.timers.size).toBe(0); expectRetained(root, nodes);
  layer.destroy();
});

test('a plain dot needs no sprite, paints its colour and is never a pick or navigation target', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(1),
    sprites: { sun: sprite, venus: sprite }, plainDots: { ids: ['mercury'], minimumDiameterPixels: 2 } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const marker = layer.inspect().find(body => body.id === 'mercury')!.billboard, leaf = marker.children[0] as HTMLElement;
  expect([leaf.style.backgroundImage ?? '', leaf.style.backgroundColor, leaf.style.borderRadius]).toEqual(['', '#9d9388', '50%']);
  expect(marker.dataset.contextBodyVisible).toBe('true');
  expect(marker.dataset.objectNavigate).toBeUndefined();
  expect(screenPicking(host as unknown as HTMLElement).pick(70, -20)).toBeNull();
  layer.destroy();
});

test('suppression retires the whole annotation while flight preserves admission and disables picking', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const element = layer.inspect().find(body => body.id === 'mercury')!.billboard;
  const opacity = (element.parentNode as unknown as HTMLElement).style.opacity;
  layer.setBodyVisibility({ labelSuppressed: ['mercury'] });
  expect(annotationVisibility(element, 'label')).toBe('hidden');
  expect(annotationVisibility(element, 'indicator')).toBe('hidden');
  expect((element.parentNode as unknown as HTMLElement).style.opacity).toBe(opacity); expect(clock.timers.size).toBe(0);
  layer.setBodyVisibility({ labelSuppressed: [] });
  expect(annotationVisibility(element, 'label')).toBe('');
  layer.previewSelection('venus');
  layer.setNavigationInFlight(true);
  expect(annotationVisibility(element, 'label')).toBe('');
  expect(annotationVisibility(element, 'indicator')).toBe('');
  // The stage picker, cleared for the flight, owns every pointer hit. The
  // keyboard target is held rather than disabled and restored on every body.
  expect(element.style.visibility).toBe(''); expect(element.dataset.objectNavigate).toBe('mercury');
  expect(screenPicking(root.parentNode! as unknown as HTMLElement).pick(70, -20)).toBeNull();
  layer.setNavigationInFlight(false);
  expect(annotationVisibility(element, 'label')).toBe('');
  expect(annotationVisibility(element, 'indicator')).toBe('');
  expect(element.dataset.objectNavigate).toBe('mercury');
  expect(screenPicking(root.parentNode! as unknown as HTMLElement).pick(70, -20)).toBe(element);
  expect(clock.timers.size).toBe(0);
  layer.destroy();
});

test('the Sun locator stays visible across galactic observer rotations while resolved occluders still hide it', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), distance = 3.085677581491367e19;
  const context = parsePreparedWorldContext({ ...base,
    focus: { ...base.focus, radiusM: 6.957e8 }, frame: { ...base.frame, bodyRadiusM: 6.957e8 },
    // An orbiting occluder: an orbitless body would itself be a placed locator.
    bodies: [{ id: 'uranus', name: 'Uranus', positionM: [3e12, 0, 0], radiusM: 2.5e7, color: '#99bbcc', orbit: orbit([3e12, 0, 0], 1) }],
    system: { fadeOutStartDistanceM: 1e14, hiddenDistanceM: 1e15 } });
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, uranus: sprite } });
  layer.selectObject('uranus');
  const focus = layer.inspect().find(body => body.id === 'sun')!, label = focus.billboard as unknown as FakeElement;
  const locator = focus.billboard as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let degrees = 0; degrees < 360; degrees++) {
    const angle = degrees * Math.PI / 180;
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
      positionM: [distance * Math.sin(angle), 0, distance * Math.cos(angle)],
      orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
    } }, viewport);
    document.defaultView.advance(200);
    expect(annotationVisibility(label, 'label'), `${degrees} degrees`).toBe(''); expect(Number(label.parentNode!.style.opacity)).toBeCloseTo(1);
    expect(annotationVisibility(locator, 'indicator'), `${degrees} degrees`).toBe(''); expect(Number(locator.parentNode!.style.opacity)).toBeCloseTo(1);
  }
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
    positionM: [3e12 + 1e8, 0, 0], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  } }, viewport);
  expect(label.style.pointerEvents).toBe('none');
  document.defaultView.advance(200);
  expect(annotationVisibility(label, 'label')).toBe('hidden'); expect(label.style.visibility).toBe('hidden');
  layer.destroy();
});

test('billboards straddle the selected detail in camera-depth order without replacing nodes', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = { ...source, bodies: source.bodies.map((body, index) => ({ ...body,
    positionM: (index === 0 ? [20, 0, 30] : [-20, 0, -30]) as [number, number, number] })) };
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  // The container must not trap foreground children behind the detailed body.
  expect(root.style.cssText).not.toContain('z-index');
  const depth = (id: string) => Number(mover(find(root, 'contextGroup', id)).style.zIndex);
  const publish = (z: number, orientationXyzw: [number, number, number, number]) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, z], orientationXyzw },
  }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(100, [0, 0, 0, 1]);
  expect(depth('venus')).toBeLessThan(0);
  // At this distance the selected Sun is detailed geometry, so its hidden
  // billboard does not need a z-index; the visible bodies still straddle it.
  expect(find(root, 'contextGroup', 'sun').style.visibility).toBe('hidden');
  expect(depth('mercury')).toBeGreaterThan(3);
  publish(-100, [0, 1, 0, 0]);
  expect(depth('mercury')).toBeLessThan(0);
  expect(depth('venus')).toBeGreaterThan(3);
  layer.selectObject('venus');
  publish(-100, [0, 1, 0, 0]);
  expect(depth('venus')).toBe(0);
  expect(depth('mercury')).toBeLessThan(depth('sun'));
  expect(depth('sun')).toBeLessThan(0);
  expectRetained(root, nodes);
  layer.destroy();
});

test('hover changes the orbit gap once per endpoint without measuring the ring', () => {
  const observer = vi.fn();
  vi.stubGlobal('ResizeObserver', observer);
  const root = mount(1), layer = mounted.get(root)!;
  try {
    const body = layer.inspect().find(entry => entry.id === 'mercury')!;
    const indicator = body.billboard as unknown as FakeElement;
    const group = find(root, 'contextGroup', 'mercury');
    const nodes = all(root);
    const clock = root.ownerDocument.defaultView;
    const [cx, cy] = body.center;
    const gap = () => Math.min(...body.orbit.filter(line => line.style.visibility === '').flatMap(line => {
      const [dx, dy, , , x, y] = line.style.transform.slice(7, -1).split(',').map(Number);
      return [Math.hypot(x - cx, y - cy), Math.hypot(x + dx - cx, y + dy - cy)];
    }));
    const measurements = nodes.reduce((sum, element) => sum + element.measurements, 0);
    const hover = (active: boolean) => {
      group.dataset.objectHovered = String(active);
      root.parentNode!.dispatchEvent(new Event('objecthoverchange'));
      clock.advance(16);
    };
    const finishShrink = () => {
      const event = new Event('transitionend');
      Object.defineProperties(event, { propertyName: { value: 'transform' }, target: { value: indicator } });
      root.dispatchEvent(event); clock.advance(16);
    };
    expect(gap()).toBeCloseTo(8, 3);
    hover(true);
    expect(indicator.dataset.contextIndicatorHovered).toBe('true');
    expect(gap()).toBeCloseTo(10, 3);
    const writes = body.orbit.map(node => (node as unknown as FakeElement).styleWrites);
    clock.advance(180);
    expect(body.orbit.map(node => (node as unknown as FakeElement).styleWrites)).toEqual(writes);
    hover(false);
    expect(indicator.dataset.contextIndicatorHovered).toBe('false');
    expect(gap()).toBeCloseTo(10, 3); // Do not cut through a ring still shrinking.
    hover(true);
    finishShrink(); // A reversed transition cannot close the hover gap.
    expect(gap()).toBeCloseTo(10, 3);
    hover(false); finishShrink();
    expect(gap()).toBeCloseTo(8, 3);
    expectRetained(root, nodes);
    expect(nodes.reduce((sum, element) => sum + element.measurements, 0)).toBe(measurements);
    expect(observer).not.toHaveBeenCalled();
  } finally {
    layer.destroy(); vi.unstubAllGlobals();
  }
});

test('flights keep admitted annotations and orbit projection live with shared selection emphasis', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const mercury = layer.inspect().find(entry => entry.id === 'mercury')!;
  const sun = layer.inspect().find(entry => entry.id === 'sun')!;
  const nodes = all(root), orbit = mercury.orbit.map(node => ({ ...node.style }));
  const markerTransform = mover(mercury.billboard).style.transform;
  layer.setOverview(true);
  layer.previewSelection('mercury');
  layer.setNavigationInFlight(true);
  root.ownerDocument.defaultView.advance(200);
  const measurements = nodes.reduce((sum, node) => sum + node.measurements, 0);
  expect(annotationVisibility(sun.billboard, 'label')).toBe('');
  expect(annotationVisibility(sun.billboard, 'indicator')).toBe('');
  expect(Number(mercury.mover.style.opacity)).toBeGreaterThan(0);
  expect(mercury.mover.style.opacity).not.toBe('0');
  const orbitRoot = find(root, 'contextOrbit', 'mercury');
  expect(orbitRoot.style.opacity).not.toBe('0');
  // Keyboard targets hold through the flight; only the stage picker is cleared.
  expect(orbitRoot.dataset.objectNavigate).toBe('mercury');
  expect(screenPicking(root.parentNode! as unknown as HTMLElement).pick(70, -20)).toBeNull();
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [50, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels: 800, heightPixels: 600 });
  expect(nodes.reduce((sum, node) => sum + node.measurements, 0)).toBe(measurements);
  expect(mover(mercury.billboard).style.transform).not.toBe(markerTransform);
  expect(mercury.orbit.map(node => ({ ...node.style }))).not.toEqual(orbit);
  expect(mover(mercury.billboard).style.transform).toContain('50px');
  expect(orbitRoot.style.opacity).not.toBe('0');
  layer.setNavigationInFlight(false);
  root.ownerDocument.defaultView.advance(200);
  expect(Number(sun.mover.style.opacity)).toBeGreaterThan(0);
  expect(sun.mover.style.opacity).not.toBe('0');
  expect(orbitRoot.dataset.objectNavigate).toBe('mercury');
  expectRetained(root, nodes);
  layer.destroy();
});

test('one retained flight caption survives the sprite fade through arrival', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  layer.selectObject('mercury'); layer.previewSelection('mercury'); layer.setNavigationInFlight(true);
  let caption: FakeElement | undefined;
  const world = (diameter: number) => ({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, Math.hypot(1, 800 / diameter)], orientationXyzw: [0, 0, 0, 1] } } as const);
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] } as const;
  for (const diameter of [13, 17, 20, 100, 300]) {
    layer.publish(world(diameter), viewport);
    const current = find(root, 'contextFlightLabel', 'mercury');
    caption ??= current;
    expect(current).toBe(caption);
    expect(current.style.visibility).toBe('');
    expect(current.textContent).toBe('Mercury');
    expect(Number(current.style.opacity)).toBeGreaterThan(0);
    const marker = find(root, 'contextLabel', 'mercury');
    expect(annotationVisibility(marker, 'label')).toBe('hidden');
    const circle = find(root, 'contextFlightCircle', 'mercury');
    expect(circle.style.visibility).toBe(diameter < 20 ? '' : 'hidden');
    if (diameter < 20) expect(Number(circle.style.opacity)).toBeGreaterThan(0);
    expect(annotationVisibility(marker, 'indicator')).toBe('hidden');
    if (diameter >= 20) expect(marker.parentNode!.style.opacity).toBe('0');
  }
  layer.setNavigationInFlight(false); layer.publish(world(300), viewport);
  expect(caption!.style.visibility).toBe('hidden');
  expectRetained(root, nodes);
  layer.destroy();
});

test.each([null, 'venus'])('flights to %s retain system annotations and orbit cutouts without enabling picking', destination => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  layer.previewSelection(null);
  const picking = screenPicking(root.parentNode! as unknown as HTMLElement);
  const before = layer.inspect().map(entry => ({ id: entry.id, label: entry.mover.style.opacity,
    indicator: entry.mover.style.opacity, orbit: entry.orbit.map(node => ({ ...node.style })),
    navigate: entry.billboard.dataset.objectNavigate }));
  expect(picking.pick(30, -20)).not.toBeNull();
  layer.previewSelection(destination);
  layer.setNavigationInFlight(true);
  for (const previous of before) {
    const entry = layer.inspect().find(entry => entry.id === previous.id)!;
    expect(entry.mover.style.opacity).toBe(previous.label);
    expect(entry.mover.style.opacity).toBe(previous.label);
    expect(entry.orbit.map(node => ({ ...node.style }))).toEqual(previous.orbit);
    // Keyboard state holds through the flight; the stage picker owns every hit
    // and is the one thing the flight clears, so nothing becomes pickable.
    expect(entry.billboard.dataset.objectNavigate).toBe(previous.navigate);
  }
  expect(picking.pick(30, -20)).toBeNull();
  expect(picking.pick(70, -20)).toBeNull();
  layer.setOverview(true);
  layer.setNavigationInFlight(false);
  expectRetained(root, nodes);
  layer.destroy();
});

test('selection emphasis previews immediately without changing the detailed occluder', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const sun = find(root, 'contextGroup', 'sun'), mercury = find(root, 'contextGroup', 'mercury');
  layer.previewSelection('mercury');
  expect(mercury.dataset.contextSelected).toBe('true');
  expect(sun.dataset.contextSelected).toBe('false');
  layer.previewSelection(null);
  // Only the emphasized body is distinguished. With nobody emphasized both
  // markers publish the shared unselected value instead of a third state.
  expect(mercury.dataset.contextSelected).toBe('false');
  expect(sun.dataset.contextSelected).toBe('false');
  layer.previewSelection();
  expect(sun.dataset.contextSelected).toBe('true');
  expect(mercury.dataset.contextSelected).toBe('false');
  layer.destroy();
});

test('the Solar System overview has no body selection until the Sun is explicitly selected', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  const sun = find(root, 'contextGroup', 'sun');
  const mercury = find(root, 'contextGroup', 'mercury');
  const sprite = find(root, 'contextBody', 'mercury');
  // An overview emphasizes nobody, and styles distinguish only the emphasized
  // body, so every marker shares the same unselected value.
  const neutral = () => {
    expect([sun, mercury].map(body => body.dataset.contextSelected)).toEqual(['false', 'false']);
  };

  layer.setOverview(true);
  root.ownerDocument.defaultView.advance(200);
  neutral();
  const normalOpacity = Number(sprite.parentNode!.style.opacity);
  expect(normalOpacity).toBeGreaterThan(0);

  // Selection changes immediately without dimming surrounding landmarks.
  layer.previewSelection('sun');
  root.ownerDocument.defaultView.advance(120);
  expect(sun.dataset.contextSelected).toBe('true');
  expect(mercury.dataset.contextSelected).toBe('false');
  expect(Number(sprite.parentNode!.style.opacity)).toBeCloseTo(normalOpacity);
  layer.setOverview(false);
  layer.previewSelection();
  expect(sun.dataset.contextSelected).toBe('true');
  expect(Number(sprite.parentNode!.style.opacity)).toBeCloseTo(normalOpacity);

  // Returning to the overview keeps that same weight.
  layer.previewSelection(null);
  root.ownerDocument.defaultView.advance(120);
  neutral();
  expect(Number(sprite.parentNode!.style.opacity)).toBeCloseTo(normalOpacity);
  layer.setOverview(true);
  layer.previewSelection();
  neutral();
  expect(Number(sprite.parentNode!.style.opacity)).toBeCloseTo(normalOpacity);

  // A cancelled object selection restores the overview, not a Sun selection.
  layer.previewSelection('mercury');
  expect(mercury.dataset.contextSelected).toBe('true');
  layer.previewSelection();
  neutral();
  expect(Number(sprite.parentNode!.style.opacity)).toBeCloseTo(normalOpacity);
  expectRetained(root, nodes);
  layer.destroy();
});

test('transports a non-rendered parent coordinate without creating a body or marker', () => {
  const source = structuredClone(plan(1));
  const center = { positionM: [50, 0, 0], centerBodyId: 'sun' };
  const bodies = source.bodies.map((body, index) => index === 0 ? { ...body,
    orbit: { ...body.orbit!, centerBodyId: 'patroclus', centerPositionM: center.positionM } } : body);
  const parsed = parsePreparedWorldContext({ ...source, bodies, orbitCenters: { patroclus: center } });
  expect(parsed.bodies.map(body => body.id)).toEqual(['mercury', 'venus']);
  expect(parsed.orbitCenters?.patroclus).toEqual(center);
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: parsed, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  expect(all(layer.root as unknown as FakeElement).some(node => Object.values(node.dataset).includes('patroclus'))).toBe(false);
  layer.destroy();
});

test('rejects malformed, detached, duplicate or cyclic non-rendered orbit centres', () => {
  const source = structuredClone(plan(1));
  const center = { positionM: [50, 0, 0], centerBodyId: 'sun' };
  const bodies = source.bodies.map((body, index) => index === 0 ? { ...body,
    orbit: { ...body.orbit!, centerBodyId: 'patroclus', centerPositionM: center.positionM } } : body);
  const parse = (orbitCenters: unknown) => parsePreparedWorldContext({ ...source, bodies, orbitCenters });
  for (const orbitCenters of [
    {}, { patroclus: { ...center, positionM: [NaN, 0, 0] } },
    { patroclus: { ...center, positionM: [50, 0] } },
    { patroclus: { ...center, positionM: [51, 0, 0] } },
    { patroclus: center, sun: center }, { patroclus: center, mercury: center },
    { patroclus: { ...center, centerBodyId: 'missing' } },
    { patroclus: { ...center, centerBodyId: 'mercury' } },
    { patroclus: { ...center, centerBodyId: 'second' }, second: { ...center, centerBodyId: 'patroclus' } },
    { patroclus: { ...center, radiusM: 1 } },
  ]) expect(() => parse(orbitCenters)).toThrow();
});

test('world presentation leaves the detail scope while retaining its input registry and focus updates', () => {
  const document = new FakeDocument(), host = document.createElement('main'), presentationHost = document.createElement('section');
  presentationHost.append(host);
  const request = vi.fn(() => true);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, presentationHost: presentationHost as unknown as HTMLElement,
    before: host as unknown as Element, plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite }, requestPublication: request });
  const world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  layer.publish(world, viewport);
  expect(host.children).toHaveLength(0);
  expect((layer.root as unknown as FakeElement).parentNode).toBe(presentationHost);
  expect(screenPicking(host as unknown as HTMLElement).pick(30, -20)).not.toBeNull();
  expect(screenPicking(presentationHost as unknown as HTMLElement).pick(30, -20)).toBeNull();
  // Focus, like hover, changes annotations only: the plan in flight stays valid
  // and a publication is still requested so the change reaches the screen.
  const stale = layer.captureFrame(world, viewport);
  presentationHost.dispatchEvent(new Event('focusin'));
  document.defaultView.advance(16);
  expect(stale.current()).toBe(true);
  expect(request).toHaveBeenCalledOnce();
  layer.destroy();
  presentationHost.dispatchEvent(new Event('focusin'));
  document.defaultView.advance(16);
  expect(request).toHaveBeenCalledOnce();
  expect(presentationHost.children).toEqual([host]);
});

test('opacity-only ticks do not reproject, republish picking or measure retained annotations', () => {
  const request = vi.fn(() => true), root = mount(1, request), layer = mounted.get(root)!;
  const clock = root.ownerDocument.defaultView;
  const nodes = all(root), measurements = nodes.map(node => node.measurements);
  const transforms = nodes.map(node => node.style.transform);
  const picking = screenPicking(root.parentNode! as unknown as HTMLElement);
  const pick = vi.spyOn(picking, 'publish');
  expect(layer.opacityStats().active).toBe(0); // Pseudo fades no longer schedule JS frames.
  clock.advance(100); clock.advance(100);
  expect(request).not.toHaveBeenCalled(); expect(pick).not.toHaveBeenCalled();
  expect(nodes.map(node => node.measurements)).toEqual(measurements);
  expect(nodes.map(node => node.style.transform)).toEqual(transforms);
  expectRetained(root, nodes);
  expect(layer.opacityStats().active).toBe(0); expect(clock.frames.size).toBe(0);
  const writes = nodes.map(node => node.style.opacity);
  clock.advance(1000); expect(nodes.map(node => node.style.opacity)).toEqual(writes);
  layer.destroy();
});


test('the main thread draws worker frames from the orbit summary exactly as from the full context', () => {
  const full = plan(1);
  const summaryInput = { ...full, schema: 'cssearth-world-context-summary@1', bodies: full.bodies.map(({ orbit, ...body }) => !orbit ? body : { ...body,
    orbit: { centerBodyId: orbit.centerBodyId, centerPositionM: orbit.centerPositionM, vertexCount: orbit.verticesM.length, fullTrail: orbit.fullTrail,
      ...(orbit.bounds ? { bounds: orbit.bounds } : {}), ...(orbit.lod ? { lod: { bounds: orbit.lod.bounds } } : {}) } }) };
  const summary = parsePreparedWorldContextSummary(summaryInput);
  expect(() => parsePreparedWorldContextSummary(structuredClone(full))).toThrow(/Unsupported/);
  expect(() => parsePreparedWorldContext(summaryInput)).toThrow(/Unsupported/);
  expect(() => parsePreparedWorldContextSummary({ ...summaryInput, bodies: summaryInput.bodies.map(body =>
    'orbit' in body ? { ...body, orbit: { ...body.orbit, verticesM: [] } } : body) })).toThrow(/verticesM/);
  const layers = [full, summary].map(prepared => {
    const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
    host.clientWidth = 800; host.clientHeight = 600; host.append(before);
    const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
      plan: prepared, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
    return { layer, root: layer.root as unknown as FakeElement };
  });
  const calculate = createWorldContextPlanner(full);
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  const drawing = (node: FakeElement) => all(node).map(node => ({ style: { ...node.style }, dataset: { ...node.dataset } }));
  for (const distance of [1000, 500, 50]) {
    world.pose.positionM[2] = distance;
    for (const { layer, root } of layers) {
      layer.publish(world, viewport, structuredClone(calculate(layer.captureFrame(world, viewport).view)));
      root.ownerDocument.defaultView.advance(50);
    }
    expect(JSON.stringify(drawing(layers[1]!.root))).toBe(JSON.stringify(drawing(layers[0]!.root)));
  }
  // A flight or a selection preview with no worker publication to request (an interrupted flight's queue holds no current
  // request) waits for the next worker frame instead of planning paths the summary does not carry.
  expect(() => { layers[1]!.layer.setNavigationInFlight(true); layers[1]!.layer.previewSelection('venus'); }).not.toThrow();
  // Without a worker frame the layer would have to project paths the summary does not carry.
  expect(() => layers[1]!.layer.publish({ ...world, pose: { ...world.pose, positionM: [0, 0, 700] } }, viewport)).toThrow(/full prepared world context/);
});

test('delta publication matches full frames through navigation, hover, fades and orbit retirement', () => {
  const root = mount(1, () => true), deltaRoot = mount(1, () => true);
  const full = mounted.get(root)!, incremental = mounted.get(deltaRoot)!;
  const calculate = createWorldContextPlanner(plan(1)), encode = createWorldContextFrameEncoder();
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  const drawing = (node: FakeElement) => all(node).map(node => ({ style: { ...node.style }, dataset: { ...node.dataset } }));
  let id = 0;
  const publish = () => {
    const a = full.captureFrame(world, viewport), b = incremental.captureFrame(world, viewport);
    const frame = structuredClone(calculate(a.view));
    full.publish(world, viewport, frame);
    incremental.publish(world, viewport, structuredClone(encode(++id, b.view.contextCommittedId ?? 0, frame)));
    root.ownerDocument.defaultView.advance(50); deltaRoot.ownerDocument.defaultView.advance(50);
    // Methods in the fake style object close over different owners.
    expect(JSON.stringify(drawing(deltaRoot))).toBe(JSON.stringify(drawing(root)));
    expect(incremental.labelExclusionRects()).toEqual(full.labelExclusionRects());
    expect(incremental.backgroundExclusionRects()).toEqual(full.backgroundExclusionRects());
    for (let x = -400; x < 400; x += 40) for (let y = -300; y < 300; y += 40) {
      const pick = (node: FakeElement) => screenPicking(node.parentNode as unknown as HTMLElement).pick(x, y)?.dataset;
      expect(pick(deltaRoot)).toEqual(pick(root));
    }
  };
  for (const distance of [1000, 1000, 900, 500, 50, 500, 1000]) { world.pose.positionM[2] = distance; publish(); }
  for (const layer of [full, incremental]) { layer.setOverview(true); layer.setBodyVisibility({ orbitHidden: ['mercury'] }); }
  publish();
  for (const node of [root, deltaRoot]) {
    find(node, 'contextGroup', 'mercury').dataset.objectHovered = 'true';
    node.parentNode!.dispatchEvent(new Event('objecthoverchange'));
  }
  publish();
  for (const layer of [full, incremental]) { layer.setNavigationInFlight(true); layer.previewSelection('mercury'); }
  publish();
  for (const layer of [full, incremental]) { layer.selectObject('mercury'); layer.setNavigationInFlight(false); layer.setBodyVisibility({ orbitHidden: [] }); }
  publish();
  // A resize changes the absolute transform origin even when a body stays
  // at the same projected coordinates and the worker has no geometry delta.
  viewport.widthPixels = 1000; viewport.heightPixels = 700; publish();
  viewport.widthPixels = 800; viewport.heightPixels = 600; publish();
  for (let i = 0; i < 12; i++) publish();
  const writes = all(deltaRoot).reduce((sum, node) => sum + node.styleWrites, 0);
  const before = incremental.publicationStats();
  publish();
  expect(all(deltaRoot).reduce((sum, node) => sum + node.styleWrites, 0) - writes).toBe(0);
  expect(incremental.publicationStats()).toEqual({ ...before, skippedPublications: before.skippedPublications + 1 });
  full.destroy(); incremental.destroy();
});

test('rotation and settlement use the same annotation rules without a deferred rearrangement', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const marker = find(root, 'contextBody', 'mercury');
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  layer.publish(camera, viewport);
  layer.setRotationActive(true);
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  // An explicit policy change applies during motion, not in a burst on release.
  layer.setBodyVisibility({ labelSuppressed: ['mercury'] });
  expect(marker.dataset.contextLabelVisible).toBe('false');
  for (const angle of [.05, .1, 0]) {
    camera.pose.orientationXyzw = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
    layer.publish(camera, viewport);
    expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
    expect(marker.dataset.contextLabelVisible).toBe('false');
    expect(layer.opacityStats().active).toBe(0);
  }
  layer.setRotationActive(false);
  expect(marker.dataset.contextLabelVisible).toBe('false');
  layer.setBodyVisibility({ labelSuppressed: [] });
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  expect(marker.dataset.contextLabelVisible).toBe('true');
  layer.destroy();
});

test('hidden billboards settle without pseudo fades or depth writes and catch up before re-entry', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const marker = find(root, 'contextBody', 'mercury');
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  layer.publish(camera, viewport);
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  layer.setOverview(true);
  layer.setBodyVisibility({ bodyHidden: ['sun', 'mercury', 'venus'] });
  root.ownerDocument.defaultView.advance(1000);
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  const counts = all(root).map(node => [node.styleWrites, node.attributeWrites]);
  const publications = layer.publicationStats();
  for (const angle of [.05, .1, -.1, 0]) {
    camera.pose.orientationXyzw = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
    layer.publish(camera, viewport);
  }
  expect(all(root).map(node => [node.styleWrites, node.attributeWrites])).toEqual(counts);
  expect(layer.publicationStats()).toEqual(publications);
  layer.selectObject('mercury');
  layer.setOverview(false);
  layer.setBodyVisibility({ bodyHidden: [] });
  expect(marker.style.visibility).toBe('');
  expect(mover(marker).style.zIndex).toBe('0');
  expect(marker.dataset.contextSelected).toBe('true');
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  layer.publish(camera, viewport);
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  layer.destroy();
});

test('only interactive stationary hover arms transitions; every camera axis and flight cancels them', () => {
  const root = mount(1), layer = mounted.get(root)!, clock = root.ownerDocument.defaultView;
  const host = root.parentNode!, marker = find(root, 'contextBody', 'mercury');
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as [number, number, number], orientationXyzw: [0, 0, 0, 1] as [number, number, number, number] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as [number, number], widthPixels: 800, heightPixels: 600 };
  const hover = (value: boolean, interactive = true) => {
    marker.dataset.objectHovered = String(value);
    host.dispatchEvent(new CustomEvent('objecthoverchange', { detail: { interactive } }));
    clock.advance(16);
  };
  layer.publish(camera, viewport);
  hover(true, false);
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  hover(false, false);
  for (const move of [
    () => { camera.pose.positionM[2] += 50; },
    () => { camera.pose.positionM[0] += 5; },
    () => { camera.pose.orientationXyzw = [0, Math.sin(.01), 0, Math.cos(.01)]; },
    () => { viewport.focalPixels += 5; },
    () => { viewport.widthPixels += 5; },
    () => { viewport.principalOffsetPixels[0] += 5; },
    () => { layer.setNavigationInFlight(true); },
  ]) {
    hover(true);
    expect(marker.dataset.contextAnnotationsAnimate).toBe('true');
    move(); layer.publish(camera, viewport);
    expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
    expect(layer.opacityStats().active).toBe(0);
    layer.setNavigationInFlight(false); hover(false, false);
  }
  hover(true);
  expect(marker.dataset.contextAnnotationsAnimate).toBe('true');
  // A press cancels in the input event, before a worker or animation frame can
  // publish the hover-out state captured by the preceding pointer movement.
  clock.dispatchEvent(new Event('pointerdown'));
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  expect(layer.opacityStats().active).toBe(0);
  hover(false, false); hover(true);
  layer.setBodyVisibility({ labelSuppressed: ['mercury'] });
  expect(marker.dataset.contextLabelVisible).toBe('false');
  hover(false, false);
  expect(marker.dataset.contextLabelVisible).toBe('false');
  expect(marker.dataset.contextAnnotationsAnimate).toBe('false');
  layer.destroy();
});

test('switching selection leaves an unrelated visible billboard selection attribute untouched', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const sun = find(root, 'contextBody', 'sun');
  layer.previewSelection('mercury');
  expect(sun.dataset.contextSelected).toBe('false');
  const writes = sun.attributeWrites;
  layer.previewSelection('venus');
  expect(sun.dataset.contextSelected).toBe('false');
  expect(sun.attributeWrites).toBe(writes);
  layer.destroy();
});

test('CSSOM transform serialization cannot turn an unchanged publication into another setter call', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const marker = find(root, 'contextBody', 'mercury'), orbit = find(root, 'contextOrbit', 'mercury');
  let writes = 0;
  for (const element of [mover(marker), orbit]) {
    let transform = element.style.transform;
    Object.defineProperty(element.style, 'transform', {
      get: () => transform.replace(/,\s*/g, ', '),
      set: (value: string) => { transform = value; writes++; },
    });
  }
  const world = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const, widthPixels: 800, heightPixels: 600 };
  for (let i = 0; i < 10; i++) layer.publish(world, viewport);
  expect(writes).toBe(0);
  // Positions are relative to the stage centre, so a wider stage moves nothing; a longer focal length moves the marker. The
  // orbit root stays anchored at the centre and is not rewritten.
  viewport.widthPixels = 900;
  layer.publish(world, viewport);
  expect(writes).toBe(0);
  viewport.focalPixels = 500;
  layer.publish(world, viewport);
  expect(writes).toBe(1);
  layer.publish(world, viewport);
  expect(writes).toBe(1);
  layer.destroy();
});

test('the orbit banks decode to the orbits of the full prepared file, each vertex within half an Int32 step', async () => {
  const prepared = new URL('../../../../src/objects/sun/prepared/', import.meta.url);
  const full = parsePreparedWorldContext(JSON.parse(await readFile(new URL('world-context.json', prepared), 'utf8')));
  const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('world-context-summary.json', prepared), 'utf8')));
  const bankOf = async (id: string) => { const bytes = await readFile(new URL(`world-orbits/${id}.bin`, prepared)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };
  const banks = new Map(await Promise.all(Object.keys(summary.orbitBanks!).map(async id => [id, await bankOf(id)] as const)));
  const decoded = decodeWorldOrbits(summary, banks);
  expect(decoded.bodies.map(body => body.id)).toEqual(full.bodies.map(body => body.id));
  for (const [index, body] of decoded.bodies.entries()) {
    const truth = full.bodies[index]!.orbit;
    if (!truth) { expect(body.orbit, body.id).toBeUndefined(); continue; }
    const { verticesM, bounds, lod, ...rest } = body.orbit!;
    const { verticesM: trueVertices, bounds: trueBounds, lod: trueLod, ...trueRest } = truth;
    expect(rest, body.id).toEqual(trueRest);
    // The body's own vertex is the Int32 origin and decodes exactly; every other vertex lies within half a step on each axis,
    // plus the double rounding of adding the step count to a coordinate of order 1e11 m.
    const pinned = truth.closed === false ? truth.bodyVertexIndex! : 0;
    expect([...verticesM.subarray(pinned * 3, pinned * 3 + 3)], body.id).toEqual([...trueVertices.subarray(pinned * 3, pinned * 3 + 3)]);
    let reach = 0;
    for (let i = 0; i < trueVertices.length; i++) reach = Math.max(reach, Math.abs(trueVertices[i]! - trueVertices[pinned * 3 + i % 3]!));
    for (let i = 0; i < trueVertices.length; i++) expect(Math.abs(verticesM[i]! - trueVertices[i]!), body.id).toBeLessThanOrEqual(reach / 0x7fffffff / 2 + 4 * Number.EPSILON * Math.abs(trueVertices[i]!));
    // Culling spheres are rounded outward: each still holds the sphere it rounds.
    for (const [rounded, exact] of [[bounds, trueBounds], [lod?.bounds, trueLod?.bounds]] as const) {
      if (!exact) continue;
      expect(rounded!.radiusM, body.id).toBeGreaterThanOrEqual(exact.radiusM + Math.hypot(...rounded!.centerM.map((value, axis) => value - exact.centerM[axis]!)));
      expect(rounded!.radiusM, body.id).toBeLessThanOrEqual(exact.radiusM * (1 + 3e-6));
    }
    expect(lod?.levels, body.id).toEqual(trueLod?.levels);
  }
  // Each path is its own bank, named by its body. A bank of another size, one for a body the summary does not pin, or one
  // whose body carries another's path never decodes.
  expect(banks.size).toBe(summary.bodies.filter(body => body.orbit).length);
  const earth = banks.get('earth')!;
  expect([...decodeWorldOrbitBank(summary, 'earth', earth).keys()]).toEqual(['earth']);
  expect(() => decodeWorldOrbitBank(summary, 'earth', earth.slice(0, earth.byteLength - 8))).toThrow(/its summary says/);
  expect(() => decodeWorldOrbitBank(summary, 'nowhere', earth)).toThrow(/summary says undefined/);
  expect(() => decodeWorldOrbitBank({ ...summary, orbitBanks: { ...summary.orbitBanks, mars: earth.byteLength } }, 'mars', earth)).toThrow(/lacks its path/);
});

test('circle dots grow with radius from 1,000 km to the system star, and stop there', () => {
  const dot = (radiusM: number) => indicatorDotDiameter(radiusM, 1e9, 2.4);
  expect([dot(5e5), dot(1e6)]).toEqual([2.4, 2.4]);
  expect(dot(Math.sqrt(1e6 * 1e9))).toBeCloseTo((2.4 + INDICATOR_DOT_MAX_DIAMETER) / 2);
  expect([dot(1e9), dot(1e11)]).toEqual([INDICATOR_DOT_MAX_DIAMETER, INDICATOR_DOT_MAX_DIAMETER]);
  expect(dot(0)).toBeNull();
  // Real radii: Saturn reads clearly larger than Earth, and the Sun larger than Jupiter.
  const sun = (radiusM: number) => indicatorDotDiameter(radiusM, 695_700_000, 2.4)!;
  expect(sun(58_232_000) - sun(6_371_000)).toBeGreaterThan(2);
  expect(sun(695_700_000) - sun(69_911_000)).toBeGreaterThan(2);
});

test('a body circle holds a dot in the body colour until its own disc outgrows the dot', () => {
  // At this scale the plan's Mercury has a 1,000 km radius, the smallest dot, and its star a 10,000 km radius.
  const scale = 1e6, root = mount(scale), layer = mounted.get(root)!, marker = find(root, 'contextBody', 'mercury'), leaf = marker.children[0]!;
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100 * scale, 0, distance * scale], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  // Until its sprite first shows, a body sets no atlas image, so a page fetches only the atlas pages it draws.
  expect(leaf.style.backgroundImage).not.toContain('url(');
  // Mercury's 0.8px disc sits inside its circle.
  publish(1000);
  expect(marker.dataset.contextIndicatorVisible).toBe('true');
  expect([leaf.style.backgroundImage, leaf.style.backgroundColor, leaf.style.borderRadius]).toEqual(['none', '#9d9388', '50%']);
  expect(leaf.style.transform).toBe(`scale(${2.4 / 16})`);
  // Up close the circle retires and the prepared image returns at the disc's own size.
  publish(100);
  expect(marker.dataset.contextIndicatorVisible).toBe('false');
  expect([leaf.style.backgroundImage, leaf.style.backgroundColor, leaf.style.borderRadius]).toEqual(['url("/marker.png")', '', '']);
  layer.destroy();
});

test('inside the Solar System, moons without a circle stay inside their planet dot and other stars are dimmed', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id,
      labelImportance(object.classification, object.discovery.featured, object.discovery.orientationReference ?? 0)])),
    annotationLandmarks: ['io', 'europa', 'ganymede', 'callisto'],
  });
  layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, 20 * 149_597_870_700], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1100, principalOffsetPixels: [0, 0], widthPixels: 1280, heightPixels: 720 });
  const jupiter = find(layer.root as unknown as FakeElement, 'contextBody', 'jupiter');
  expect(jupiter.dataset.contextIndicatorVisible).toBe('true');
  expect(jupiter.children[0]!.style.backgroundColor).not.toBe('');
  for (const moon of ['io', 'europa', 'ganymede', 'callisto'])
    expect(find(layer.root as unknown as FakeElement, 'contextBody', moon).dataset.contextBodyVisible).toBe('false');
  const opacity = (id: string) => Number(layer.inspect().find(body => body.id === id)!.mover.style.opacity);
  expect(opacity('jupiter')).toBeGreaterThan(.9);
  expect(opacity('proxima-centauri')).toBeGreaterThan(0);
  expect(opacity('proxima-centauri')).toBeLessThanOrEqual(.3);
  layer.destroy();
});

// The inertia gate (docs/performance/motion-freezes-membership.md): while the camera coasts, retained DOM changes only
// transform and opacity, plus the orbit strokes' paint exception. Production shape: strokes, and a coast reports rotation.
async function orbitEarth(options: { coast: boolean }) {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 820; host.clientHeight = 1094; host.append(before);
  const layer = mountTestContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, orbitRenderer: 'strokes',
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(SCENE_OBJECTS.map(object => [object.id,
      labelImportance(object.classification, object.discovery.featured, object.discovery.orientationReference ?? 0)])) });
  const earth = context.bodies.find(body => body.id === 'earth')!;
  layer.selectObject('earth');
  // Orbit at 40 Earth radii: identity orientation looks down -Z, so rotating offset and orientation together about Y
  // keeps Earth centred while the Moon, Sun and planets sweep across the view.
  const publish = (angle: number) => layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt, pose: {
    positionM: [earth.positionM[0] + Math.sin(angle) * 40 * earth.radiusM, earth.positionM[1], earth.positionM[2] + Math.cos(angle) * 40 * earth.radiusM],
    orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)] } },
  { focalPixels: 900, principalOffsetPixels: [0, 0], widthPixels: 820, heightPixels: 1094 });
  publish(0);
  layer.setRotationActive(true);
  if (options.coast) layer.setCoasting(true);
  writeLog = [];
  // A quarter turn: the view it ends on differs from the one it began with.
  for (let frame = 1; frame <= 90; frame++) publish(frame * Math.PI / 2 / 90);
  const writes = writeLog; writeLog = null;
  return { layer, writes, publish, document };
}
const tally = (writes: readonly string[]) => Object.entries(writes.reduce<Record<string, number>>((all, write) => ({ ...all, [write]: (all[write] ?? 0) + 1 }), {}))
  .sort((a, b) => b[1] - a[1]).map(([write, count]) => `${count}x ${write}`);

test('a coast around Earth writes only transform and opacity, and the orbit strokes', async () => {
  const { layer, writes, publish } = await orbitEarth({ coast: true });
  const offPath = writes.filter(write => !/ style\.(transform|opacity|strokeOpacity)$| @points$/u.test(write));
  expect(tally(offPath), `${writes.length} writes over a 90-frame coast; off the fast path`).toEqual([]);
  // The coast stops: the membership it held lands.
  writeLog = [];
  layer.setCoasting(false);
  layer.setRotationActive(false);
  publish(Math.PI / 2);
  const settled = writeLog; writeLog = null;
  expect(settled.some(write => / style\.visibility$| data-contextLabelVisible$| data-contextIndicatorVisible$/u.test(write)), tally(settled).slice(0, 8).join(', ')).toBe(true);
  layer.destroy();
});

test('a driven drag around Earth keeps revealing and retiring bodies', async () => {
  const { layer, writes } = await orbitEarth({ coast: false });
  expect(writes.filter(write => / style\.visibility$/u.test(write)).length).toBeGreaterThan(0);
  layer.destroy();
});
