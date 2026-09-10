import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import { mountPreparedWorldContext, parsePreparedWorldContext, preparedVolumeOpacity } from './prepared-world-context.js';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import { screenPicking } from '../navigation/screen-picking.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import { OBJECTS } from '../../../../site/objects.mjs';
import { CONTEXT_ANNOTATION_PRIORITY } from '../../../../site/runtime-policy.mjs';
import { SYSTEM_VIEWS, systemFramingRect, systemViewTarget } from '../../../../site/system-framing.mjs';

class FakeElement extends EventTarget {
  readonly children: FakeElement[] = [];
  readonly style = Object.assign({ opacity: '' } as Record<string, string>, {
    getPropertyValue: (name: string) => this.style[name] ?? '',
    setProperty: (name: string, value: string) => { this.style[name] = value; },
  });
  readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null;
  className = ''; textContent = ''; hidden = false; clientWidth = 0; clientHeight = 0;
  constructor(readonly ownerDocument: FakeDocument, readonly tagName: string) { super(); }
  measurements = 0;
  getBoundingClientRect() { this.measurements++; return { width: this.textContent.length * 6, height: 14 }; }
  setAttribute(): void {}
  removeAttribute(): void {}
  append(...entries: FakeElement[]): void { for (const entry of entries) this.insertBefore(entry, null); }
  appendChild(entry: FakeElement): FakeElement { this.append(entry); return entry; }
  insertBefore(entry: FakeElement, before: FakeElement | null): void {
    entry.remove(); entry.parentNode = this;
    const index = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(index < 0 ? this.children.length : index, 0, entry);
  }
  remove(): void { if (this.parentNode) { const index = this.parentNode.children.indexOf(this); if (index >= 0) this.parentNode.children.splice(index, 1); this.parentNode = null; } }
}
class Clock {
  now = 0; next = 0; frames = new Map<number, (time: number) => void>(); timers = new Map<number, { at: number; callback: () => void }>();
  performance = { now: () => this.now };
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
class FakeDocument { defaultView = new Clock(); createElement(tagName: string): FakeElement { return new FakeElement(this, tagName); } }

const mounted = new WeakMap<FakeElement, ReturnType<typeof mountPreparedWorldContext>>();
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
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1], metersPerUnit: scale, bodyRadiusM: 10 * scale },
    focus, bodies: [{ ...front, orbit: orbit([100, 0, 0], scale) }, { ...hidden, orbit: orbit([0, 0, -20], scale) }],
    camera: { minimumDistanceM: 12 * scale, maximumDistanceM: 10_000 * scale, framingReferenceZoom: 1, presentation },
    volume: { objectId: 'milky-way', fadeStartDistanceM: 100 * scale, fullDistanceM: 1_000 * scale }, system: { fadeOutStartDistanceM: 1, hiddenDistanceM: 1e30 },
    stars: { objectId: 'stellar-neighbourhood', fadeStartDistanceM: 10 * scale, fullDistanceM: 50 * scale },
    sky: { sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' },
  });
}
function find(root: FakeElement, key: string, value: string): FakeElement {
  const found = [root, ...all(root)].find(element => element.dataset[key] === value);
  if (!found) throw new Error(`Missing ${key}=${value}`); return found;
}
function all(root: FakeElement): FakeElement[] { return root.children.flatMap(child => [child, ...all(child)]); }
function mount(scale: number, requestPublication?: () => boolean) {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(scale), sprites: { sun: sprite, mercury: sprite, venus: sprite }, requestPublication });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1_000].map(value => value * scale), orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
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
  expect(parsePreparedWorldContext(input).bodies[0]!.orbit).toEqual(orbit);
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
  for (const change of [() => layer.setOverview(true), () => layer.setHiddenOrbits(['mercury']),
    () => layer.setHiddenLabels(['venus']), () => layer.previewSelection('mercury')]) {
    const stale = layer.captureFrame(world, viewport), before = drawing(), calls = request.mock.calls.length;
    change();
    expect(stale.current()).toBe(false);
    expect(request.mock.calls.length).toBe(calls + 1);
    expect(drawing()).toBe(before);
    const fresh = layer.captureFrame(world, viewport);
    layer.publish(world, viewport, planner(fresh.view));
    clock.advance(1000);
  }
  const before = drawing(), stale = layer.captureFrame(world, viewport);
  find(root, 'contextGroup', 'mercury').dataset.objectHovered = 'true';
  root.parentNode!.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16);
  expect(stale.current()).toBe(false);
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
  const shown = layer.inspect().filter(body => body.indicator.style.visibility !== 'hidden');
  expect(shown.length).toBeGreaterThan(0);
  for (const body of shown) expect(find(root, 'contextGroup', body.id).dataset.contextSelected).toBe('overview');
  expect(all(root)).toEqual(nodes);
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
  layer.publish(world, viewport); clock.advance(1000);
  expect(mercury.indicator.style.visibility).toBe('hidden');
  expect(Number.parseFloat(mercury.indicator.style.opacity.slice(5))).toBeGreaterThan(0);
  const retained = group.dataset.contextSelected;
  layer.setOverview(true); layer.publish(world, viewport);
  expect(group.dataset.contextSelected).toBe(retained);
  layer.publish(world, { ...viewport, widthPixels: 800, heightPixels: 600 });
  expect(mercury.indicator.style.visibility).toBe('');
  expect(group.dataset.contextSelected).toBe('overview');
  layer.destroy();
});

test('a resolved background sprite does not pick through its transparent square corners', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.selectObject('mercury');
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 100], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  const registry = screenPicking(root.parentNode! as unknown as HTMLElement);
  const sun = layer.inspect().find(body => body.id === 'sun')!.marker;
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
  expect(mercury.indicator.style.visibility).toBe('');
  publish(40, 600);
  expect(mercury.indicator.style.visibility).toBe('hidden');
  publish(800, 600);
  expect(mercury.indicator.style.visibility).toBe('');
  publish(800, 10);
  expect(mercury.indicator.style.visibility).toBe('hidden');
  layer.destroy();
});

test('hidden orbit selection leaves other orbits intact and retains the same body nodes', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const target = find(root, 'contextOrbit', 'mercury'), other = find(root, 'contextOrbit', 'venus');
  const visibleTarget = target.style.opacity, visibleOther = other.style.opacity;
  expect(visibleTarget).not.toBe('calc(0 * var(--context-line-opacity, 1))');
  layer.setHiddenOrbits(['mercury']);
  root.ownerDocument.defaultView.advance(200);
  expect(target.style.opacity).toBe('calc(0 * var(--context-line-opacity, 1))');
  expect(target.style.pointerEvents).toBe('none');
  expect(target.dataset.objectNavigate).toBeUndefined();
  expect(other.style.opacity).toBe(visibleOther);
  expect(find(root, 'contextLabel', 'mercury').style.visibility).toBe('');
  expect(find(root, 'contextIndicator', 'mercury').style.visibility).toBe('');
  expect(all(root)).toEqual(nodes);
  layer.setNavigationInFlight(true);
  layer.setHiddenOrbits([]);
  expect(target.style.opacity).toBe(visibleTarget);
  expect(target.dataset.objectNavigate).toBeUndefined();
  layer.setNavigationInFlight(false);
  expect(target.style.opacity).toBe(visibleTarget);
  expect(target.dataset.objectNavigate).toBe('mercury');
  expect(other.style.opacity).toBe(visibleOther);
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('hover-only trails reveal the full orbit and keep their circle and label before and after hover', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map(body => ({ ...body,
    orbit: { ...body.orbit, trail: [0, 0, 0, .2, .4, .6, .8, 1], activeChords: [3, 4, 5, 6, 7] },
  })) });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.setHiddenOrbits(['mercury', 'venus']);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const circle = find(root, 'contextIndicator', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const orbit = find(root, 'contextOrbit', 'mercury'), other = find(root, 'contextOrbit', 'venus');
  for (const hovered of [false, true, false]) {
    circle.dataset.objectHovered = String(hovered);
    host.dispatchEvent(new Event('objecthoverchange'));
    document.defaultView.advance(16); document.defaultView.advance(200);
    expect(circle.style.visibility).toBe('');
    expect(label.style.visibility).toBe('');
    expect(orbit.style.opacity === 'calc(0 * var(--context-line-opacity, 1))').toBe(!hovered);
    if (hovered) {
      const visiblePieces = layer.inspect().find(body => body.id === 'mercury')!.orbit.filter(piece => piece.style.visibility === '');
      expect(visiblePieces.length).toBeGreaterThan(5);
      expect(visiblePieces.every(piece => Number(piece.style.opacity) === 1)).toBe(true);
    }
    expect(orbit.dataset.objectNavigate).toBeUndefined();
    expect(orbit.style.pointerEvents).toBe('none');
    expect(other.style.opacity).toBe('calc(0 * var(--context-line-opacity, 1))');
  }
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('hidden labels keep circles pickable and hover reveals only that label and orbit without camera movement', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const clock = root.ownerDocument.defaultView, host = root.parentNode!;
  const circle = find(root, 'contextIndicator', 'mercury');
  const label = find(root, 'contextLabel', 'mercury');
  const orbit = find(root, 'contextOrbit', 'mercury');
  const other = find(root, 'contextOrbit', 'venus');
  const sunLabel = find(root, 'contextLabel', 'sun');
  layer.setHiddenOrbits(['mercury', 'venus']);
  layer.setHiddenLabels(['mercury', 'venus']);
  clock.advance(200);
  expect(label.style.visibility).toBe('hidden');
  expect(circle.style.visibility).toBe('');
  expect(circle.dataset.objectNavigate).toBe('mercury');
  expect(sunLabel.style.visibility).toBe('');
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16); clock.advance(200);
  expect(label.style.visibility).toBe('');
  expect(label.dataset.objectNavigate).toBe('mercury');
  expect(orbit.style.opacity).not.toBe('calc(0 * var(--context-line-opacity, 1))');
  expect(all(orbit).some(piece => piece.tagName === 's' && piece.style.visibility === '' &&
    piece.parentNode?.style.display === 'contents')).toBe(true);
  // A temporarily revealed orbit cannot keep itself hovered after leaving the circle.
  expect(orbit.dataset.objectNavigate).toBeUndefined();
  expect(orbit.style.pointerEvents).toBe('none');
  expect(other.style.opacity).toBe('calc(0 * var(--context-line-opacity, 1))');
  delete circle.dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  clock.advance(16); clock.advance(200);
  expect(label.style.visibility).toBe('hidden');
  expect(orbit.style.opacity).toBe('calc(0 * var(--context-line-opacity, 1))');
  expect(circle.dataset.objectNavigate).toBe('mercury');
  layer.setHiddenLabels([]); clock.advance(200);
  expect(label.style.visibility).toBe('');
  expect(orbit.style.opacity).toBe('calc(0 * var(--context-line-opacity, 1))');
  layer.setHiddenOrbits([]);
  layer.setHiddenLabels(['mercury']); clock.advance(200);
  expect(label.style.visibility).toBe('hidden');
  expect(orbit.dataset.objectNavigate).toBe('mercury');
  expect(all(root)).toEqual(nodes);
  layer.destroy();
  host.dispatchEvent(new Event('objecthoverchange'));
  expect(clock.frames.size).toBe(0);
});

test('keyboard focus also reveals a hidden label and orbit, then retires them on blur', () => {
  const root = mount(1), layer = mounted.get(root)!, host = root.parentNode!;
  const circle = find(root, 'contextIndicator', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  const clock = root.ownerDocument.defaultView;
  layer.setHiddenOrbits(['mercury']); layer.setHiddenLabels(['mercury']);
  Object.assign(root.ownerDocument, { activeElement: circle });
  host.dispatchEvent(new Event('focusin')); clock.advance(16); clock.advance(200);
  expect(label.style.visibility).toBe('');
  Object.assign(root.ownerDocument, { activeElement: null });
  host.dispatchEvent(new Event('focusout')); clock.advance(16); clock.advance(200);
  expect(label.style.visibility).toBe('hidden');
  layer.destroy();
});

test('camera publication consumes interaction changes without polling retained DOM state', () => {
  const root = mount(1), layer = mounted.get(root)!, host = root.parentNode!;
  const group = find(root, 'contextGroup', 'mercury');
  const label = find(root, 'contextLabel', 'mercury');
  const circle = find(root, 'contextIndicator', 'mercury');
  let hovered: string | undefined, focused: FakeElement | null = null;
  let hoverReads = 0, focusReads = 0;
  Object.defineProperty(group.dataset, 'objectHovered', { get() { hoverReads++; return hovered; } });
  Object.defineProperty(root.ownerDocument, 'activeElement', { get() { focusReads++; return focused; } });
  const publish = (distance = 1_000) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels: 800, heightPixels: 600 });
  layer.setHiddenLabels(['mercury']);
  for (let distance = 1_000; distance < 1_020; distance++) publish(distance);
  expect(hoverReads).toBe(0); expect(focusReads).toBe(0);
  hovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  // A camera sample can arrive before the scheduled annotation callback.
  publish();
  expect(label.style.visibility).toBe('');
  expect(hoverReads).toBe(1); expect(focusReads).toBe(1);
  root.ownerDocument.defaultView.advance(16);
  expect(hoverReads).toBe(1); expect(focusReads).toBe(1);
  publish(1e31); // Retire non-anchor publication.
  hovered = undefined; focused = circle;
  host.dispatchEvent(new Event('objecthoverchange'));
  host.dispatchEvent(new Event('focusin'));
  publish(1e31); publish();
  expect(label.style.visibility).toBe('');
  expect(hoverReads).toBe(2); expect(focusReads).toBe(2);
  focused = null; host.dispatchEvent(new Event('focusout'));
  publish(); root.ownerDocument.defaultView.advance(200);
  expect(label.style.visibility).toBe('hidden');
  expect(hoverReads).toBe(3); expect(focusReads).toBe(3);
  layer.destroy();
  host.dispatchEvent(new Event('objecthoverchange'));
  root.ownerDocument.defaultView.advance(200);
  expect(hoverReads).toBe(3); expect(focusReads).toBe(3);
});

test('accepts the generated Sun context and rejects detached or malformed prepared data', async () => {
  const source = JSON.parse(await readFile(fileURLToPath(new URL('../../../planets/sun/prepared/world-context.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
  expect(parsePreparedWorldContext(source).bodies.map(body => body.id).sort())
    .toEqual(OBJECTS.filter(object => object.id !== 'sun' && object.worldFrame).map(object => object.id).sort());
  const authored = JSON.parse(await readFile(new URL('../../../planets/sun/source/navigation/universe.json', import.meta.url), 'utf8')) as { bodies: { id: string }[] };
  expect(parsePreparedWorldContext(source).bodies.map(body => body.id))
    .toEqual(authored.bodies.map(body => body.id));
  for (const body of parsePreparedWorldContext(source).bodies) {
    const frame = OBJECTS.find(object => object.id === body.id)!.worldFrame!;
    expect(body.radiusM, `${body.id} context must match the selectable detail radius`).toBe(frame.bodyRadiusM);
    expect(body.positionM, `${body.id} context must match the selectable detail origin`).toEqual(frame.originM);
    expect(body.orbit?.bounds, `${body.id} orbit bounds are owned by preparation`).toBeDefined();
    expect(body.orbit?.activeChords).toEqual(body.orbit?.trail.flatMap((weight, index) => weight > 0 ? [index] : []));
    expect([...(body.orbit?.extentChords ?? [])].sort((a, b) => a - b)).toEqual(body.orbit?.activeChords);
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

test('prepared planetary systems retain moon orbits with a small selected planet', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../planets/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])) });
  for (const [planet, moon] of [['saturn', 'titan'], ['jupiter', 'europa'], ['uranus', 'titania']]) {
    const body = context.bodies.find(body => body.id === planet)!;
    layer.selectObject(planet);
    const publish = (radii: number) => layer.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [body.positionM[0], body.positionM[1], body.positionM[2] + radii * body.radiusM], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 });
    const orbit = layer.inspect().find(body => body.id === moon)!.orbit;
    // The planet spans about 20px, or 3.3% of this viewport: the moon system is readable.
    publish(40);
    expect(orbit.some(piece => piece.style.visibility === ''), `${planet} moon system at overview distance`).toBe(true);
    // A close-up still retires orbit lines when the selected planet fills the screen.
    publish(2);
    expect(orbit.every(piece => piece.style.visibility === 'hidden'), `${planet} close-up`).toBe(true);
  }
  layer.destroy();
});

test.each([...SYSTEM_VIEWS.keys()].filter(id => id !== 'sun'))('%s moon orbits stay complete across selection, hover, flight and zoom', async planet => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../planets/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const viewport = { focalPixels: 1100, framingRadiusPixels: 200, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1280, heightPixels: 720 };
  const frame = OBJECTS.find(object => object.id === planet)!.worldFrame;
  const target = systemViewTarget({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: [0, 0, 1e15], orientationXyzw: [0, 0, 0, 1] } },
    frame, viewport, SYSTEM_VIEWS.get(planet), systemFramingRect(viewport, {}));
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])) });
  const memberIds = new Set(context.bodies.filter(body => body.orbit?.centerBodyId === planet).map(body => body.id));
  const moons = layer.inspect().filter(body => memberIds.has(body.id));
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.selectObject(planet);
  layer.publish(target, viewport);
  for (const zoom of [.8, 1, 1.4]) {
    layer.publish({ ...target, pose: { ...target.pose,
      positionM: target.pose.positionM.map((value, axis) => frame.originM[axis] + (value - frame.originM[axis]) * zoom) as [number, number, number],
    } }, viewport);
    for (const selection of [null, planet, [...memberIds][0], undefined]) {
      layer.previewSelection(selection);
      for (const active of [true, false]) {
        layer.setNavigationInFlight(active);
        const circle = find(root, 'contextIndicator', [...memberIds][0]!);
        circle.dataset.objectHovered = String(active);
        host.dispatchEvent(new Event('objecthoverchange'));
        document.defaultView.advance(16);
        const pieces = moons.flatMap(moon => moon.orbit.filter(piece => piece.style.visibility === ''));
        expect(pieces.length).toBeGreaterThan(0);
        expect(pieces.every(piece => Number(piece.style.opacity) === 1)).toBe(true);
      }
    }
  }
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('initial Jupiter system framing makes the four large moons and their labels readable', async () => {
  const context = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../planets/sun/prepared/world-context.json', import.meta.url), 'utf8')));
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 1280; host.clientHeight = 720; host.append(before);
  const viewport = { focalPixels: 1100, framingRadiusPixels: 200, principalOffsetPixels: [0, 0] as const,
    widthPixels: 1280, heightPixels: 720 };
  const frame = OBJECTS.find(object => object.id === 'jupiter')!.worldFrame;
  const target = systemViewTarget({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: [0, 0, 1e15], orientationXyzw: [0, 0, 0, 1] } },
    frame, viewport, SYSTEM_VIEWS.get('jupiter'), systemFramingRect(viewport, {}));
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries([context.focus, ...context.bodies].map(body => [body.id, sprite])),
    annotationPriorities: Object.fromEntries(OBJECTS.map(object => [object.id, CONTEXT_ANNOTATION_PRIORITY[object.classification] ?? 0])),
  });
  layer.selectObject('jupiter');
  layer.publish(target, viewport); document.defaultView.advance(200);
  for (const id of ['io', 'europa', 'ganymede', 'callisto']) {
    const moon = layer.inspect().find(body => body.id === id)!;
    expect(moon.indicator.style.visibility, `${id} circle`).toBe('');
    expect(moon.label.style.visibility, `${id} label`).toBe('');
    expect(moon.orbit.some(piece => piece.style.visibility === ''), `${id} orbit`).toBe(true);
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
      verticesM: [positionM, ...child.orbit!.verticesM.slice(1)] } }] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
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
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, 'new-object': sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  expect(find(root, 'contextBody', 'new-object').dataset.objectNavigate).toBe('new-object');
  layer.selectObject('new-object');
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('an orbitless prepared object renders and navigates without manufacturing orbital geometry', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1), { orbit: _orbit, ...point } = source.bodies[0]!;
  const body = { ...point, id: 'future-object', name: 'Future object' };
  const context = parsePreparedWorldContext({ ...source, bodies: [body] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
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
  expect(all(root)).toEqual(nodes);
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
  expect(nearSun.style.transform).toContain('translate(30px,-20px)');
  expect(nearMercury.style.visibility).toBe('');
  expect(nearVenus.style.visibility).toBe('hidden');
  const nearOrbit = mounted.get(near)!.inspect().find(body => body.id === 'mercury')!.orbit.filter(element => element.style.visibility === '');
  expect(nearOrbit.length).toBeGreaterThan(0);
  for (const piece of nearOrbit) {
    const values = piece.style.transform.match(/-?[0-9.]+/g)!.map(Number);
    expect(Math.abs(values[4]!)).toBeLessThanOrEqual(400);
    expect(Math.abs(values[5]!)).toBeLessThanOrEqual(300);
  }
  expect(nearMercury.style.transform).toBe(find(far, 'contextBody', 'mercury').style.transform);
  expect(nearOrbit.length).toBe(mounted.get(far)!.inspect().find(body => body.id === 'mercury')!.orbit.filter(element => element.style.visibility === '').length);
});

test('camera updates retain fixed stroke styles and only publish changed orbit picking policy', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const orbit = find(root, 'contextOrbit', 'mercury');
  const indicator = find(root, 'contextIndicator', 'mercury');
  const orbitWrites = vi.spyOn(orbit.style, 'setProperty');
  const indicatorWrites = vi.spyOn(indicator.style, 'setProperty');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  publish(1100); publish(1200);
  expect(orbitWrites).not.toHaveBeenCalled(); expect(indicatorWrites).not.toHaveBeenCalled();
  expect(orbit.dataset.objectNavigate).toBe('mercury');
  layer.setHiddenOrbits(['mercury']);
  expect(orbitWrites).not.toHaveBeenCalled();
  expect(orbit.dataset.objectNavigate).toBeUndefined(); orbitWrites.mockClear();
  publish(1250);
  expect(orbitWrites).not.toHaveBeenCalled();
  layer.setHiddenOrbits([]);
  expect(orbitWrites).not.toHaveBeenCalled();
  orbitWrites.mockClear();
  layer.setNavigationInFlight(true); layer.setNavigationInFlight(false);
  expect(orbitWrites).not.toHaveBeenCalled();
  expect(orbit.dataset.objectNavigate).toBe('mercury');
  layer.destroy();
});

test('orbit chords stop at the circular indicator on both sides of the centered body', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const mercury = layer.inspect().find(body => body.id === 'mercury')!;
  expect(mercury.indicator.style.visibility).toBe('');
  expect(mercury.indicator.style.width).toBe('16px');
  expect(mercury.indicator.style.transform).toBe('translate(70px,-20px) translate(-50%,-50%)');
  expect(mercury.marker.style.transform).toContain('translate(70px,-20px)');
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
  expect(find(root, 'contextIndicator', 'venus').style.visibility).toBe('hidden');
  layer.destroy();
});

test('body circles fade with apparent size, remain clickable, and reuse their nodes', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const indicator = find(root, 'contextIndicator', 'mercury');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [100, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(100);
  expect(indicator.style.visibility).toBe('hidden');
  expect(indicator.style.pointerEvents).toBe('none');
  publish(140);
  expect(parseFloat(indicator.style.opacity.replace('calc(', ''))).toBeGreaterThan(0);
  expect(parseFloat(indicator.style.opacity.replace('calc(', ''))).toBeLessThan(1);
  publish(200);
  expect(parseFloat(indicator.style.opacity.replace('calc(', ''))).toBeGreaterThan(0.98);
  expect(indicator.dataset.objectNavigate).toBe('mercury');
  const selections: string[] = [];
  root.parentNode!.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  indicator.dispatchEvent(new Event('click'));
  expect(selections).toEqual(['mercury']);
  expect(all(root)).toEqual(nodes);
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
      const width = (mercury.indicator as unknown as FakeElement).style['--context-line-width'];
      expect((mercury.orbit[0].parentNode as unknown as FakeElement).parentNode!.style['--context-line-width']).toBe(width);
      expect(find(root, 'contextIndicator', 'sun').style['--context-line-width']).toBe(width);
      return parseFloat(width);
    };
    expect(strokeAt(512)).toBe(1);
    expect(strokeAt(Math.sqrt(64 * 512))).toBe(1);
    expect(strokeAt(64)).toBeCloseTo(1);
    expect(strokeAt(24)).toBe(1);
    const crowded = layer.inspect().find(body => body.id === 'mercury')!;
    expect(crowded.indicator.style.visibility).toBe('hidden');
    expect(crowded.orbit.some(piece => piece.style.visibility === '')).toBe(true);
    expect(strokeAt(8)).toBe(1);
    expect(layer.inspect().find(body => body.id === 'mercury')!.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
    layer.destroy();
  }
});

test('planet labels remain visible when their placement crosses an orbit', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const visible = layer.inspect().filter(body => body.label.style.visibility === '');
  const lines = layer.inspect().flatMap(body => body.orbit).filter(line => line.style.visibility === '');
  expect(visible.length).toBeGreaterThan(0);
  let crossings = 0;
  for (const { label } of visible) {
    const [lx, ly] = label.style.transform.match(/-?[\d.]+/g)!.map(Number);
    const width = label.textContent!.length * 6, height = 14;
    for (const line of lines) {
      const [dx, dy, , , x, y] = line.style.transform.slice(7, -1).split(',').map(Number);
      let enter = 0, leave = 1;
      for (const [start, delta, low, high] of [[x, dx, lx - 2, lx + width + 2], [y, dy, ly - 2, ly + height + 2]]) {
        if (Math.abs(delta) < 1e-9) { if (start < low || start > high) { enter = 1; leave = 0; break; } }
        else {
          const a = (low - start) / delta, b = (high - start) / delta;
          enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
        }
      }
      if (enter <= leave) crossings++;
    }
  }
  expect(crossings).toBeGreaterThan(0);
  layer.destroy();
});

test('overlapping circles retain selection priority and reappear when separated', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 1000; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: 0.1, positionM: [400 + index * 10, 0, 0],
  })) });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const mercury = find(root, 'contextIndicator', 'mercury'), venus = find(root, 'contextIndicator', 'venus');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(2000);
  expect(mercury.style.visibility).toBe('');
  expect(venus.style.visibility).toBe('hidden');
  expect(venus.style.pointerEvents).toBe('none');
  const venusMarker = find(root, 'contextBody', 'venus');
  expect(venusMarker.style.visibility).toBe(''); // Decluttering only hides annotations.
  let writes = 0;
  for (const node of [venus, venusMarker]) {
    let transform = node.style.transform;
    Object.defineProperty(node.style, 'transform', {
      get: () => transform, set: value => { writes++; transform = value; },
    });
  }
  publish(2200); publish(2500);
  expect(writes).toBe(2); // The visible physical sprite follows both camera samples.
  layer.selectObject('venus'); publish(2000);
  expect(writes).toBe(4);
  expect(venus.style.transform).toContain('translate(82px,0px)');
  expect(venusMarker.style.transform).toContain('translate(82px,0px)');
  expect(venus.style.visibility).toBe('');
  expect(mercury.style.visibility).toBe('hidden');
  publish(160);
  expect(mercury.style.visibility).toBe('');
  expect(venus.style.visibility).toBe('');
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test.each([
  ['planet', 'dwarf-planet'], ['planet', 'comet'], ['planet', 'asteroid'],
  ['dwarf-planet', 'comet'], ['dwarf-planet', 'asteroid'], ['comet', 'asteroid'],
])('%s annotations outrank %s through zoom, even after the lower class was visible first', (higher, lower) => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 1000; host.append(before);
  const source = plan(1);
  const objects = [lower, higher].map(classification => OBJECTS.find(object => object.classification === classification)!);
  const context = parsePreparedWorldContext({ ...source,
    system: { fadeOutStartDistanceM: 10_000, hiddenDistanceM: 1e30 },
    bodies: objects.map((object, index) => ({
    ...source.bodies[0], id: object.id, name: object.name, radiusM: .1,
    positionM: [400 + index * 30, 0, 0],
    orbit: { ...source.bodies[0].orbit, verticesM: orbit([100, 0, 0], 1).verticesM.map(([x, y, z]) => [x + 300 + index * 30, y, z]) },
  })) });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: Object.fromEntries(['sun', ...objects.map(object => object.id)].map(id => [id, sprite])),
    annotationPriorities: Object.fromEntries(objects.map(object => [object.id, CONTEXT_ANNOTATION_PRIORITY[object.classification]])),
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
  expect(minor.indicator.style.visibility).toBe('');
  layer.previewSelection(null);
  const distances = Array.from({ length: 61 }, (_, index) => 400 + index * 20);
  for (const distance of [...distances, ...distances.toReversed()]) {
    publish(distance);
    expect(major.indicator.style.visibility).toBe('');
    expect(major.label.style.visibility).toBe('');
    for (const body of [minor, major]) {
      expect(body.marker.style.visibility).toBe('');
      expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
      expect(find(root, 'contextOrbit', body.id).style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
    }
  }
  publish(1000);
  expect(minor.indicator.style.visibility).toBe('hidden');
  // Direct interaction can still reveal a lower-priority body and its label.
  (minor.marker as unknown as FakeElement).dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange')); publish(1000);
  expect(minor.indicator.style.visibility).toBe('');
  expect(minor.label.style.visibility).toBe('');
  delete (minor.marker as unknown as FakeElement).dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  layer.previewSelection(objects[0].id); publish(1000);
  expect(minor.indicator.style.visibility).toBe('');
  expect(minor.label.style.visibility).toBe('');
  layer.previewSelection(null); publish(1000);
  expect(major.indicator.style.visibility).toBe('');
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('the Sun circle and label remain visible after all planetary context fades at maximum range', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, camera: { ...source.camera, maximumDistanceM: 1e12 },
    system: { fadeOutStartDistanceM: 100, hiddenDistanceM: 1000 } });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  for (const distance of [10000, context.camera.maximumDistanceM]) {
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
      { focalPixels: 400, principalOffsetPixels: [30, -20] });
    expect(root.hidden).toBe(false);
    expect(find(root, 'contextIndicator', 'sun').style.visibility).toBe('');
    expect(find(root, 'contextIndicator', 'sun').style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
    expect(find(root, 'contextLabel', 'sun').style.visibility).toBe('');
    expect(find(root, 'contextLabel', 'sun').dataset.objectNavigate).toBe('sun');
    expect(find(root, 'contextIndicator', 'mercury').style.visibility).toBe('hidden');
    expect(find(root, 'contextLabel', 'mercury').style.visibility).toBe('hidden');
    expect(layer.inspect().flatMap(body => body.orbit).every(piece => piece.style.visibility === 'hidden')).toBe(true);
  }
  expect(all(root)).toEqual(nodes);
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
  for (const node of [group, ...all(group)]) for (const key of Object.keys(node.style)) {
    let value = node.style[key];
    if (typeof value !== 'string') continue;
    Object.defineProperty(node.style, key, { get: () => value, set: next => { writes.push(key); value = next; }, configurable: true });
  }
  publish(2e31); publish(3e31);
  expect(writes).toEqual([]);
  expect(find(root, 'contextLabel', 'sun').dataset.objectNavigate).toBe('sun');
  expect(mercury.indicator.dataset.objectNavigate).toBeUndefined();
  expect(layer.backgroundExclusionRects()).toEqual(layer.labelExclusionRects());
  publish(1000);
  expect(writes.length).toBeGreaterThan(0);
  expect(mercury.indicator.dataset.objectNavigate).toBe('mercury');
  expect(mercury.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  // Hiding overlays before retirement must not restore their old visible state
  // when the controls are re-enabled at galaxy distance.
  layer.setNavigationInFlight(true); publish(1e31); publish(2e31);
  layer.setNavigationInFlight(false);
  expect(mercury.indicator.style.visibility).toBe('hidden');
  expect(mercury.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
  expect(mercury.label.dataset.objectNavigate).toBeUndefined();
  publish(1000);
  expect(mercury.indicator.dataset.objectNavigate).toBe('mercury');
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('retired depth groups defer rotation and selection writes until same-pose re-entry', () => {
  const root = mount(1), layer = mounted.get(root)!, nodes = all(root);
  const publish = (z: number, orientationXyzw = [0, 0, 0, 1]) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, z], orientationXyzw },
  }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1e31); root.ownerDocument.defaultView.advance(200);
  let writes = 0;
  for (const id of ['mercury', 'venus']) {
    const style = find(root, 'contextGroup', id).style;
    let zIndex = style.zIndex;
    Object.defineProperty(style, 'zIndex', { get: () => zIndex, set: value => { writes++; zIndex = value; } });
  }
  const halfTurn = [0, 1, 0, 0];
  publish(-1e31, halfTurn);
  layer.selectObject('venus'); publish(-2e31, halfTurn);
  expect(writes).toBe(0);
  const depth = (id: string) => Number(find(root, 'contextGroup', id).style.zIndex);
  expect(depth('sun')).toBeLessThan(0);
  // Distance alone resumes the system; the cached orientation/selection are
  // unchanged, so re-entry itself must invalidate the depth publication scope.
  publish(-1000, halfTurn);
  expect(writes).toBeGreaterThan(0);
  expect(depth('venus')).toBe(0);
  expect(depth('mercury')).toBeGreaterThan(depth('sun'));
  expect(depth('mercury')).toBeLessThan(0);
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('dolly motion leaves depth styles untouched while selection and rotation still reorder retained groups', () => {
  const root = mount(1), layer = mounted.get(root)!;
  let writes = 0;
  for (const id of ['sun', 'mercury', 'venus']) {
    const style = find(root, 'contextGroup', id).style;
    let zIndex = style.zIndex;
    Object.defineProperty(style, 'zIndex', { get: () => zIndex, set: value => { writes++; zIndex = value; } });
  }
  const publish = (distance: number, orientationXyzw = [0, 0, 0, 1]) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  for (const distance of [200, 2000, 1e8, 2e8]) publish(distance);
  expect(writes).toBe(0);
  layer.selectObject('venus'); publish(2000);
  expect(writes).toBeGreaterThan(0);
  expect(find(root, 'contextGroup', 'venus').style.zIndex).toBe('0');
  expect(Number(find(root, 'contextGroup', 'sun').style.zIndex)).toBeGreaterThan(3);
  writes = 0; publish(3000); expect(writes).toBe(0);
  publish(-3000, [0, 1, 0, 0]);
  expect(writes).toBeGreaterThan(0);
  expect(Number(find(root, 'contextGroup', 'sun').style.zIndex)).toBeLessThan(0);
  layer.destroy();
});

test('selection transfers the detail handoff to the destination while retaining every orbit and marker', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
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
  expect(all(root)).toEqual(nodes);
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
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const mercury = find(root, 'contextLabel', 'mercury'), venus = find(root, 'contextLabel', 'venus');
  const publish = (focalPixels = 400) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [400, 0, 2000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels, principalOffsetPixels: [0, 0] });
  const shown = () => [mercury, venus].filter(label => label.style.visibility === '').map(label => label.textContent);
  publish(); expect(shown()).toEqual(['Mercury']);
  expect(venus.style.pointerEvents).toBe('none');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  venus.dispatchEvent(new Event('click')); expect(selections).toEqual([]);
  layer.selectObject('venus'); publish(); expect(shown()).toEqual(['Venus']);
  find(root, 'contextBody', 'mercury').dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  publish(); expect(shown()).toEqual(['Mercury']); // Hover takes priority over selection.
  delete find(root, 'contextBody', 'mercury').dataset.objectHovered;
  host.dispatchEvent(new Event('objecthoverchange'));
  layer.selectObject('sun');
  publish(9200); expect(shown()).toEqual(['Mercury']); // Keep the previously visible label until there is clearance.
  publish(10000); expect(shown()).toEqual(['Mercury', 'Venus']);
  publish(9200); expect(shown()).toEqual(['Mercury', 'Venus']);
  publish(8800); expect(shown()).toEqual(['Mercury']);
  publish(9200); expect(shown()).toEqual(['Mercury']);
  expect(mercury.measurements).toBe(1); expect(venus.measurements).toBe(1);
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});


test.each(['pointer', 'keyboard'])('a small moon circle reveals its label on %s interaction', interaction => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [
    { ...source.bodies[0], positionM: [400, 0, 0], orbit: orbit([400, 0, 0], 1) },
    { ...source.bodies[1], positionM: [460, 0, 0], radiusM: .1,
      orbit: { ...orbit([460, 0, 0], 1), centerBodyId: 'mercury', centerPositionM: [400, 0, 0] } },
  ] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.setHiddenOrbits(['venus']);
  layer.setHiddenLabels(['venus']);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  const circle = find(root, 'contextIndicator', 'venus'), label = find(root, 'contextLabel', 'venus');
  expect(circle.style.visibility).toBe('');
  expect(label.style.visibility).toBe('hidden');
  for (const active of [true, false]) {
    if (interaction === 'pointer') circle.dataset.objectHovered = String(active);
    else Object.assign(document, { activeElement: active ? circle : null });
    host.dispatchEvent(new Event(interaction === 'pointer' ? 'objecthoverchange' : active ? 'focusin' : 'focusout'));
    document.defaultView.advance(16); document.defaultView.advance(200);
    expect(circle.style.visibility).toBe('');
    expect(label.style.visibility).toBe(active ? '' : 'hidden');
    if (active) expect(label.style.opacity).toBe('calc(1 * var(--context-label-opacity, 1))');
  }
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('hover keeps a circle label inside the viewport when every normal placement is clipped', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0], positionM: [990, 740, 0], orbit: orbit([990, 740, 0], 1) }] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.setHiddenOrbits(['mercury']);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const root = layer.root as unknown as FakeElement;
  const circle = find(root, 'contextIndicator', 'mercury'), label = find(root, 'contextLabel', 'mercury');
  expect(circle.style.visibility).toBe('');
  expect(label.style.visibility).toBe('hidden');
  circle.dataset.objectHovered = 'true';
  host.dispatchEvent(new Event('objecthoverchange'));
  document.defaultView.advance(16); document.defaultView.advance(200);
  expect(label.style.visibility).toBe('');
  const [x, y] = label.style.transform.match(/-?[\d.]+/g)!.map(Number);
  expect(x).toBeGreaterThanOrEqual(-396); expect(x + label.textContent.length * 6).toBeLessThanOrEqual(396);
  expect(y).toBeGreaterThanOrEqual(-296); expect(y + 14).toBeLessThanOrEqual(296);
  layer.destroy();
});

test('the Sun caption stays below its marker as orbit strokes cross during zoom', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const label = find(root, 'contextLabel', 'sun');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(1200);
  expect(label.style.visibility).toBe('');
  publish(4000);
  expect(label.style.visibility).toBe('');
  expect(label.style.transform).toBe('translate(-9px,12px)');
  publish(1200);
  expect(label.style.visibility).toBe('');
  publish(8000);
  expect(label.style.visibility).toBe('');
  expect(label.style.transform).toBe('translate(-9px,12px)');
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
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.setOverview(true);
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const label = find(layer.root as unknown as FakeElement, 'contextLabel', 'sun');
  expect(label.style.visibility).toBe(shown ? '' : 'hidden');
  expect(label.style.pointerEvents).toBe(shown ? 'auto' : 'none');
  if (shown) expect(label.style.transform).toBe('translate(-9px,12px)');
  layer.destroy();
});


test('switching to the Solar System card immediately reveals the Sun ring without another camera frame', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 500], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  const ring = find(root, 'contextIndicator', 'sun');
  expect(ring.style.visibility).toBe('hidden');
  layer.setOverview(true);
  expect(ring.style.visibility).toBe('');
  expect(ring.dataset.objectNavigate).toBe('sun');
  expect(ring.style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
  layer.setOverview(false);
  expect(ring.style.visibility).toBe('hidden');
  layer.destroy();
});


test.each([true, false])('circle crowding leaves physical bodies and orbits visible (closed=%s)', closed => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => {
    const positionM = [20 + index * 10, 0, 0];
    return { ...body, radiusM: .1, positionM, orbit: { ...body.orbit,
      verticesM: [positionM, [0,500,0], [-500,0,0], [0,-500,0], [500,0,0], [0,500,0], [-500,0,0], [0,-500,0]],
      trail: closed ? body.orbit!.trail : body.orbit!.trail.map(() => .75) } };
  }) });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite} });
  layer.setOverview(true);
  const publish = (distance: number) => layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]}}, {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(2000);
  const entries = layer.inspect();
  expect(entries[0].indicator.style.visibility).toBe('');
  for (const body of entries.slice(1)) {
    for (const element of [body.indicator, body.label]) {
      expect(element.style.visibility).toBe('hidden');
      expect(element.style.pointerEvents).toBe('none');
    }
    expect(body.marker.style.visibility).toBe('');
    expect(body.marker.style.pointerEvents).toBe('auto');
    expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  }
  publish(100);
  for (const body of entries.slice(1)) {
    expect(body.marker.style.visibility).toBe('');
    expect(body.indicator.style.visibility).toBe('');
    expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  }
  layer.destroy();
});

test.each([true, false])('rings and trails share their circle fade across zoom in both directions (closed=%s)', closed => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 5000; host.clientHeight = 5000; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0],
    positionM: [500, 0, 0], radiusM: .1,
    orbit: { ...source.bodies[0].orbit,
      verticesM: [[500,0,0], [550,50,0], [600,0,0], [550,-50,0], [500,0,0], [550,50,0], [600,0,0], [550,-50,0]],
      trail: Array(8).fill(closed ? 1 : .75) },
  }] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
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
    if (extent > 12) expect(body.indicator.style.opacity).toBe(orbitRoot.style.opacity);
    expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(extent > 12);
    expect(body.indicator.style.visibility).toBe(extent > 12 ? '' : 'hidden');
    expect(body.indicator.style.pointerEvents).toBe(extent > 12 ? 'auto' : 'none');
  }
  expect(all(layer.root as unknown as FakeElement)).toEqual(nodes);
  layer.destroy();
});

test('a trail remains visible when its body is outside the viewport', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: [{ ...source.bodies[0],
    positionM: [2000, 0, 0],
    orbit: { ...source.bodies[0].orbit,
      verticesM: [[2000,0,0], [100,100,0], [-100,100,0], [-200,0,0], [-100,-100,0], [100,-100,0], [1000,-50,0], [1500,-20,0]],
      trail: Array(8).fill(.75) },
  }] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite} });
  layer.setOverview(true);
  layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1]}},
    {focalPixels: 400, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600});
  const body = layer.inspect().find(entry => entry.id === 'mercury')!;
  expect(body.indicator.style.visibility).toBe('hidden');
  expect(body.marker.style.visibility).toBe('hidden');
  expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  layer.destroy();
});

test('a label cannot cover a neighbouring circle even when the two labels fit', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => ({
    id: body.id, name: body.name, color: body.color, radiusM: .1, positionM: [100 + index * 34, 0, 0],
  })) });
  const layer = mountPreparedWorldContext({host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite}});
  layer.publish({referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, 400], orientationXyzw: [0, 0, 0, 1]}}, {focalPixels: 400, principalOffsetPixels: [0, 0]});
  const entries = layer.inspect();
  expect(entries.filter(body => body.label.style.visibility === '').length).toBeGreaterThan(1);
  for (const body of entries.filter(body => body.label.style.visibility === '')) {
    const [x, y] = body.label.style.transform.match(/-?[\d.]+/g)!.map(Number);
    const width = body.label.textContent!.length * 6;
    for (const other of entries.filter(other => other !== body && other.indicator.style.visibility === '')) {
      const [cx, cy] = other.indicator.style.transform.match(/-?[\d.]+/g)!.map(Number);
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
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { anchor: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement;
  const focus = layer.inspect().find(body => body.id === 'anchor')!;
  const label = focus.label as unknown as FakeElement, locator = focus.indicator as unknown as FakeElement;
  const retained = all(host);
  expect(label.textContent).toBe('Anchor');
  expect(label.parentNode).not.toBe(root);
  expect(all(host).filter(node => node.dataset.contextLabel === 'anchor')).toEqual([label]);
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const camera = (distance: number) => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } });
  // The caption remains visible when the intermediate orbit crosses it.
  for (const [distance, locatorOpacity, captionVisible] of [[50, 0, false], [Math.sqrt(1000 * 10000), 1, true], [8000, 1, true], [1e21, 1, true], [50, 0, false]] as const) {
    layer.publish(camera(distance!), viewport);
    document.defaultView.advance(200);
    if (locatorOpacity) expect(locator.style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
    expect(locator.style.visibility).toBe(locatorOpacity! > 0 ? '' : 'hidden');
    expect(label.style.visibility).toBe(captionVisible ? '' : 'hidden');
    expect(all(host)).toEqual(retained);
  }
  const distant = camera(1e21);
  distant.pose.positionM = [-1e20, 5e19, 1e21];
  layer.publish(distant, viewport);
  document.defaultView.advance(200);
  expect(layer.inspect().filter(body => body.id !== 'anchor').every(body => body.marker.style.visibility === 'hidden')).toBe(true);
  expect(label.parentNode!.hidden).toBe(false);
  expect(label.style.visibility).toBe(''); expect(label.style.opacity).toBe('calc(1 * var(--context-label-opacity, 1))');
  expect(locator.style.visibility).toBe(''); expect(locator.style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
  expect(locator.style.transform).toBe('translate(70px,-40px) translate(-50%,-50%)');
  expect(label.style.transform).toBe('translate(52px,-28px)');
  expect(locator.dataset.objectNavigate).toBe('anchor');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  label.dispatchEvent(new Event('click')); expect(selections).toEqual(['anchor']);
  // Roll moves the physical projected location; a reversed view must cull it.
  distant.pose.orientationXyzw = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  layer.publish(distant, viewport);
  expect(locator.style.transform).not.toBe('translate(70px,-40px) translate(-50%,-50%)');
  for (const pose of [
    { ...camera(1e21).pose, orientationXyzw: [0, 1, 0, 0] },
    { ...camera(1e21).pose, positionM: [-2e21, 0, 1e21] },
  ]) {
    layer.publish({ ...distant, pose }, viewport);
    expect(locator.style.visibility).toBe('hidden'); expect(label.style.visibility).toBe('hidden');
    expect(locator.style.pointerEvents).toBe('none'); expect(label.style.pointerEvents).toBe('none');
    label.dispatchEvent(new Event('click')); expect(selections).toEqual(['anchor']);
  }
  layer.destroy(); expect(host.children).toEqual([before]);
  label.dispatchEvent(new Event('click')); expect(selections).toEqual(['anchor']);
  expect(label.measurements).toBe(1, 'camera publication must never remeasure label layout');
});

test('readable satellite orbits show labels even with an unresolved parent, then fade at system distance', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), parent = { ...base.bodies[0]!, radiusM: 5 }, satellite = base.bodies[1]!;
  const positionM = [250, 0, 0];
  const context = parsePreparedWorldContext({ ...base, system: { fadeOutStartDistanceM: 1e10, hiddenDistanceM: 1e11 },
    bodies: [parent, { ...satellite, positionM, orbit: { ...satellite.orbit, centerBodyId: parent.id,
      centerPositionM: parent.positionM, verticesM: [[250,0,0],[200,100,0],[100,150,0],[0,100,0],[-50,0,0],[0,-100,0],[100,-150,0],[200,-100,0]] } }] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const child = layer.inspect().find(body => body.id === satellite.id)!;
  const marker = child.marker as unknown as FakeElement, label = child.label as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  const camera = (z: number) => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [100, 0, z], orientationXyzw: [0, 0, 0, 1] } });
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('');
  expect(label.style.pointerEvents).toBe('auto');
  layer.publish(camera(180), viewport);
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('');
  expect(label.dataset.objectNavigateActivation).toBe('click'); expect(label.style.pointerEvents).toBe('auto');
  const [left, top] = label.style.transform.match(/-?[\d.]+/g)!.map(Number);
  expect(layer.labelExclusionRects()).toContainEqual({ left, top, right: left + label.textContent.length * 6, bottom: top + 14 });
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('');
  layer.publish(camera(12000), viewport);
  document.defaultView.advance(200);
  expect(label.style.visibility).toBe('hidden');
  expect(label.style.pointerEvents).toBe('none'); expect(label.measurements).toBe(1);
  layer.destroy(); expect(layer.labelExclusionRects()).toEqual([]);
});

test('resolved body labels remain visible when close-up framing hides orbit lines', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), position = [35, 0, -60] as const;
  const context = parsePreparedWorldContext({ ...base, bodies: [{ ...base.bodies[0],
    positionM: position, radiusM: 8, orbit: orbit(position, 1) }] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 40], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const body = layer.inspect().find(body => body.id === 'mercury')!;
  expect(body.marker.style.visibility).toBe('');
  expect(body.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
  expect(body.label.style.visibility).toBe('');
  expect(body.label.dataset.objectNavigate).toBe('mercury');
  const [labelX, labelY] = body.label.style.transform.match(/-?[\d.]+/g)!.map(Number);
  expect(labelX + 'Mercury'.length * 6 / 2).toBeCloseTo(140);
  expect(labelY).toBeGreaterThan(32);
  layer.destroy();
});

test('a moon label tries the other side when its first position overlaps the selected parent label', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1);
  const parent = { ...base.bodies[0], name: 'Jupiter', radiusM: 7, positionM: [400, 0, 0], orbit: orbit([400, 0, 0], 1) };
  const moon = { ...base.bodies[1], name: 'Ganymede', radiusM: .1, positionM: [326, 32, 0],
    orbit: { ...base.bodies[1].orbit, centerBodyId: parent.id, centerPositionM: parent.positionM,
      verticesM: [[326,32,0], [400,150,0], [550,0,0], [400,-150,0], [250,0,0], [400,150,0], [550,0,0], [400,-150,0]] } };
  const context = parsePreparedWorldContext({ ...base, bodies: [parent, moon] });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: {sun: sprite, mercury: sprite, venus: sprite} });
  layer.selectObject(parent.id);
  const camera = { referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: {positionM: [400, 0, 400], orientationXyzw: [0, 0, 0, 1]} };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let frame = 0; frame < 3; frame++) {
    layer.publish(camera, viewport); document.defaultView.advance(200);
    const label = layer.inspect().find(body => body.id === moon.id)!.label;
    expect(label.style.visibility).toBe('');
    expect(Number(label.style.transform.match(/translate\(([-\d.]+)/)![1])).toBeLessThan(-74);
    const rects = layer.labelExclusionRects();
    expect(rects).toHaveLength(2);
    expect(labelRectsOverlap(rects[0], rects[1], 4)).toBe(false);
  }
  layer.destroy();
});

test('a background star label inside the orbit footprint is excluded even outside every accepted body label', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: plan(1), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const camera = { referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } };
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  layer.publish(camera, viewport);
  const backgroundText = { left: -10, top: -30, right: 10, bottom: -20 };
  expect(layer.labelExclusionRects().every(rect => !labelRectsOverlap(backgroundText, rect))).toBe(true);
  expect(layer.backgroundExclusionRects().some(rect => labelRectsOverlap(backgroundText, rect))).toBe(true);
  expect(layer.inspect().find(body => body.id === 'sun')!.label.style.visibility).toBe('');
  // Close orbits clip the viewport; they must not claim the entire background.
  layer.publish({ ...camera, pose: { ...camera.pose, positionM: [0, 0, 50] } }, viewport);
  expect(layer.backgroundExclusionRects()).toEqual(layer.labelExclusionRects());
  layer.destroy();
});

test('solar text fades through system retirement, reverses continuously, and disables fading targets immediately', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1);
  const context = parsePreparedWorldContext({ ...base, system: { fadeOutStartDistanceM: 1e10, hiddenDistanceM: 1e11 },
    bodies: base.bodies.map(({ orbit: _orbit, ...body }) => body) });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const label = layer.inspect().find(body => body.id === 'mercury')!.label as unknown as FakeElement;
  const nodes = all(host), clock = document.defaultView;
  const alpha = () => Number.parseFloat(label.style.opacity.replace('calc(', ''));
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1000); expect(alpha()).toBe(0);
  clock.advance(100); expect(alpha()).toBeCloseTo(.5, 12);
  clock.advance(100); expect(alpha()).toBe(1);
  publish(1e21);
  expect(label.style.visibility).toBe(''); expect(alpha()).toBe(1);
  expect(label.style.pointerEvents).toBe('none');
  clock.advance(100); expect(alpha()).toBeCloseTo(.5, 12);
  publish(1000); expect(alpha()).toBeCloseTo(.5, 12);
  expect(clock.timers.size).toBe(0);
  clock.advance(100); expect(alpha()).toBeCloseTo(.75, 12);
  clock.advance(100); expect(alpha()).toBe(1);
  publish(1e21); clock.advance(200);
  expect(label.style.visibility).toBe('hidden'); expect(alpha()).toBe(0);
  publish(1000); clock.advance(100); publish(1e21);
  expect(clock.timers.size).toBeGreaterThan(0); expect(clock.frames.size).toBeGreaterThan(0);
  expect(all(host)).toEqual(nodes);
  layer.destroy(); expect(clock.frames.size).toBe(0); expect(clock.timers.size).toBe(0);
});

test('flight annotations fade correctly even when a label fade is in progress', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: parsePreparedWorldContext({ ...plan(1), bodies: plan(1).bodies.map(({ orbit: _orbit, ...body }) => body) }), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  const label = layer.inspect().find(body => body.id === 'mercury')!.label;
  document.defaultView.advance(100);
  const partialAlpha = Number.parseFloat(label.style.opacity.slice(5));
  expect(partialAlpha).toBeGreaterThan(0); expect(partialAlpha).toBeLessThan(1);
  layer.setNavigationInFlight(true);
  document.defaultView.advance(400);
  expect(Number.parseFloat(label.style.opacity.slice(5))).toBe(0);
  layer.setNavigationInFlight(false);
  document.defaultView.advance(200);
  expect(Number.parseFloat(label.style.opacity.slice(5))).toBeCloseTo(partialAlpha * 2);
  layer.setHiddenLabels(['mercury']);
  expect(document.defaultView.timers.size).toBeGreaterThan(0);
  document.defaultView.advance(50);
  layer.setNavigationInFlight(true);
  document.defaultView.advance(400);
  expect(Number.parseFloat(label.style.opacity.slice(5))).toBe(0);
  layer.setNavigationInFlight(false);
  document.defaultView.advance(200);
  expect(Number.parseFloat(label.style.opacity.slice(5))).toBe(0);
  layer.destroy();
});

test('the Sun locator stays visible across galactic observer rotations while resolved occluders still hide it', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), distance = 3.085677581491367e19;
  const context = parsePreparedWorldContext({ ...base,
    focus: { ...base.focus, radiusM: 6.957e8 }, frame: { ...base.frame, bodyRadiusM: 6.957e8 },
    bodies: [{ id: 'uranus', name: 'Uranus', positionM: [3e12, 0, 0], radiusM: 2.5e7, color: '#99bbcc' }],
    system: { fadeOutStartDistanceM: 1e14, hiddenDistanceM: 1e15 } });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, uranus: sprite } });
  layer.selectObject('uranus');
  const focus = layer.inspect().find(body => body.id === 'sun')!, label = focus.label as unknown as FakeElement;
  const locator = focus.indicator as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let degrees = 0; degrees < 360; degrees++) {
    const angle = degrees * Math.PI / 180;
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
      positionM: [distance * Math.sin(angle), 0, distance * Math.cos(angle)],
      orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
    } }, viewport);
    document.defaultView.advance(200);
    expect(label.style.visibility, `${degrees} degrees`).toBe(''); expect(label.style.opacity).toBe('calc(1 * var(--context-label-opacity, 1))');
    expect(locator.style.visibility, `${degrees} degrees`).toBe(''); expect(locator.style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
  }
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
    positionM: [3e12 + 1e8, 0, 0], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  } }, viewport);
  expect(label.style.pointerEvents).toBe('none');
  document.defaultView.advance(200);
  expect(label.style.visibility).toBe('hidden'); expect(label.style.opacity).toBe('calc(0 * var(--context-label-opacity, 1))');
  layer.destroy();
});

test('billboards straddle the selected detail in camera-depth order without replacing nodes', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = { ...source, bodies: source.bodies.map((body, index) => ({ ...body,
    positionM: (index === 0 ? [20, 0, 30] : [-20, 0, -30]) as [number, number, number] })) };
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const root = layer.root as unknown as FakeElement, nodes = all(root);
  // The container must not trap foreground children behind the detailed body.
  expect(root.style.cssText).not.toContain('z-index');
  const depth = (id: string) => Number(find(root, 'contextGroup', id).style.zIndex);
  const publish = (z: number, orientationXyzw: [number, number, number, number]) => layer.publish({
    referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, z], orientationXyzw },
  }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(100, [0, 0, 0, 1]);
  expect(depth('venus')).toBeLessThan(0);
  expect(depth('sun')).toBe(0);
  expect(depth('mercury')).toBeGreaterThan(3);
  publish(-100, [0, 1, 0, 0]);
  expect(depth('mercury')).toBeLessThan(0);
  expect(depth('venus')).toBeGreaterThan(3);
  layer.selectObject('venus');
  publish(-100, [0, 1, 0, 0]);
  expect(depth('venus')).toBe(0);
  expect(depth('mercury')).toBeLessThan(depth('sun'));
  expect(depth('sun')).toBeLessThan(0);
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('orbit endpoints follow the rendered circle through growth and shrink without camera publication', () => {
  let notify: ResizeObserverCallback;
  let disconnected = false;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { notify = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  });
  let layer: ReturnType<typeof mountPreparedWorldContext> | undefined;
  try {
    const root = mount(1);
    layer = mounted.get(root)!;
    const body = layer.inspect().find(entry => entry.id === 'mercury')!;
    const nodes = [...body.orbit];
    const [cx, cy] = body.indicator.style.transform.match(/-?[\d.]+/g)!.map(Number);
    const gap = () => Math.min(...body.orbit.filter(line => line.style.visibility === '').flatMap(line => {
      const [dx, dy, , , x, y] = line.style.transform.slice(7, -1).split(',').map(Number);
      return [Math.hypot(x - cx, y - cy), Math.hypot(x + dx - cx, y + dy - cy)];
    }));
    const measurements = all(root).reduce((sum, element) => sum + element.measurements, 0);
    expect(gap()).toBeCloseTo(8, 3);
    for (const diameter of [18, 20, 19, 16]) {
      notify!([{ target: body.indicator, borderBoxSize: [{ inlineSize: diameter, blockSize: diameter }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      expect(gap()).toBeCloseTo(diameter / 2, 3);
      expect(layer.inspect().find(entry => entry.id === 'mercury')!.orbit).toEqual(nodes);
    }
    expect(all(root).reduce((sum, element) => sum + element.measurements, 0)).toBe(measurements);
    layer.destroy();
    expect(disconnected).toBe(true);
  } finally {
    layer?.destroy();
    vi.unstubAllGlobals();
  }
});

test('flights keep orbit projection live, fade unrelated annotations and retain destination annotations', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const mercury = layer.inspect().find(entry => entry.id === 'mercury')!;
  const sun = layer.inspect().find(entry => entry.id === 'sun')!;
  const nodes = all(root), orbit = mercury.orbit.map(node => ({ ...node.style }));
  const markerTransform = mercury.marker.style.transform;
  layer.setOverview(true);
  layer.previewSelection('mercury');
  layer.setNavigationInFlight(true);
  root.ownerDocument.defaultView.advance(200);
  const measurements = nodes.reduce((sum, node) => sum + node.measurements, 0);
  expect(Number.parseFloat(sun.label.style.opacity.slice(5))).toBe(0);
  expect(sun.indicator.style.opacity).toBe('calc(0 * var(--context-line-opacity, 1))');
  expect(Number.parseFloat(mercury.label.style.opacity.slice(5))).toBeGreaterThan(0);
  expect(mercury.indicator.style.opacity).not.toBe('calc(0 * var(--context-line-opacity, 1))');
  const orbitRoot = find(root, 'contextOrbit', 'mercury');
  expect(orbitRoot.style.opacity).not.toBe('0');
  expect(orbitRoot.dataset.objectNavigate).toBeUndefined();
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [50, 0, 1_000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20], widthPixels: 800, heightPixels: 600 });
  expect(nodes.reduce((sum, node) => sum + node.measurements, 0)).toBe(measurements);
  expect(mercury.marker.style.transform).not.toBe(markerTransform);
  expect(mercury.orbit.map(node => ({ ...node.style }))).not.toEqual(orbit);
  expect(mercury.indicator.style.transform).toContain('50px');
  expect(orbitRoot.style.opacity).not.toBe('calc(0 * var(--context-line-opacity, 1))');
  layer.setNavigationInFlight(false);
  root.ownerDocument.defaultView.advance(200);
  expect(Number.parseFloat(sun.label.style.opacity.slice(5))).toBeGreaterThan(0);
  expect(sun.indicator.style.opacity).not.toBe('calc(0 * var(--context-line-opacity, 1))');
  expect(orbitRoot.dataset.objectNavigate).toBe('mercury');
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('overview flights retain system annotations and orbit cutouts without enabling picking', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const nodes = all(root);
  layer.previewSelection(null);
  const before = layer.inspect().map(entry => ({ id: entry.id, label: entry.label.style.opacity,
    indicator: entry.indicator.style.opacity, orbit: entry.orbit.map(node => ({ ...node.style })) }));
  layer.setNavigationInFlight(true);
  for (const previous of before) {
    const entry = layer.inspect().find(entry => entry.id === previous.id)!;
    expect(entry.label.style.opacity).toBe(previous.label);
    expect(entry.indicator.style.opacity).toBe(previous.indicator);
    expect(entry.orbit.map(node => ({ ...node.style }))).toEqual(previous.orbit);
    expect(entry.indicator.dataset.objectNavigate).toBeUndefined();
  }
  layer.setOverview(true);
  layer.setNavigationInFlight(false);
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});

test('selection emphasis previews immediately without changing the detailed occluder', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const sun = find(root, 'contextGroup', 'sun'), mercury = find(root, 'contextGroup', 'mercury');
  layer.previewSelection('mercury');
  expect(mercury.dataset.contextSelected).toBe('true');
  expect(sun.dataset.contextSelected).toBe('false');
  layer.previewSelection(null);
  expect(mercury.dataset.contextSelected).toBe('overview');
  expect(sun.dataset.contextSelected).toBe('overview');
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
  const neutral = () => {
    expect([sun, mercury].map(body => body.dataset.contextSelected)).toEqual(['overview', 'overview']);
  };

  layer.setOverview(true);
  neutral();
  const normalOpacity = Number(sprite.style.opacity);
  expect(normalOpacity).toBeGreaterThan(0);

  // The selection preview updates the frame state and peer opacity together.
  layer.previewSelection('sun');
  expect(sun.dataset.contextSelected).toBe('true');
  expect(mercury.dataset.contextSelected).toBe('false');
  expect(Number(sprite.style.opacity)).toBeCloseTo(normalOpacity * .75);
  layer.setOverview(false);
  layer.previewSelection();
  expect(sun.dataset.contextSelected).toBe('true');
  expect(Number(sprite.style.opacity)).toBeCloseTo(normalOpacity * .75);

  // Returning to the overview clears both effects before recentering completes.
  layer.previewSelection(null);
  neutral();
  expect(Number(sprite.style.opacity)).toBeCloseTo(normalOpacity);
  layer.setOverview(true);
  layer.previewSelection();
  neutral();
  expect(Number(sprite.style.opacity)).toBeCloseTo(normalOpacity);

  // A cancelled object selection restores the overview, not a Sun selection.
  layer.previewSelection('mercury');
  expect(mercury.dataset.contextSelected).toBe('true');
  layer.previewSelection();
  neutral();
  expect(Number(sprite.style.opacity)).toBeCloseTo(normalOpacity);
  expect(all(root)).toEqual(nodes);
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
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
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
