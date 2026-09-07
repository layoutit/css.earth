import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import { mountPreparedWorldContext, parsePreparedWorldContext, preparedVolumeOpacity } from './prepared-world-context.js';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import { OBJECTS } from '../../../../site/objects.mjs';

class FakeElement extends EventTarget {
  readonly children: FakeElement[] = [];
  readonly style = Object.assign({} as Record<string, string>, {
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
function mount(scale: number) {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element, plan: plan(scale), sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 1_000].map(value => value * scale), orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
  mounted.set(layer.root as unknown as FakeElement, layer);
  return layer.root as unknown as FakeElement;
}

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
    { ...(body.orbit as object), runtimeEphemeris: true }]) {
    expect(() => parsePreparedWorldContext({ ...source, bodies: [{ ...body, orbit }, ...bodies.slice(1)] })).toThrow();
  }
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
      expect((mercury.orbit[0].parentNode as unknown as FakeElement).style['--context-line-width']).toBe(width);
      expect(find(root, 'contextIndicator', 'sun').style['--context-line-width']).toBe(width);
      return parseFloat(width);
    };
    expect(strokeAt(512)).toBe(1);
    expect(strokeAt(Math.sqrt(64 * 512))).toBe(1);
    expect(strokeAt(64)).toBeCloseTo(1);
    expect(strokeAt(24)).toBe(1);
    expect(layer.inspect().find(body => body.id === 'mercury')!.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
    layer.destroy();
  }
});

test('visible labels keep clearance from every orbit, including other bodies orbits', () => {
  const root = mount(1), layer = mounted.get(root)!;
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 400, principalOffsetPixels: [30, -20] });
  const visible = layer.inspect().filter(body => body.label.style.visibility === '');
  const lines = layer.inspect().flatMap(body => body.orbit).filter(line => line.style.visibility === '');
  expect(visible.length).toBeGreaterThan(0);
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
      expect(enter > leave, `${label.textContent} intersects an orbit`).toBe(true);
    }
  }
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
  layer.selectObject('venus'); publish(2000);
  expect(venus.style.visibility).toBe('');
  expect(mercury.style.visibility).toBe('hidden');
  publish(160);
  expect(mercury.style.visibility).toBe('');
  expect(venus.style.visibility).toBe('');
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
  publish(); expect(shown()).toEqual(['Mercury']);
  delete find(root, 'contextBody', 'mercury').dataset.objectHovered;
  layer.selectObject('sun');
  publish(9200); expect(shown()).toEqual(['Mercury']);
  publish(10000); expect(shown()).toEqual(['Mercury', 'Venus']);
  publish(9200); expect(shown()).toEqual(['Mercury', 'Venus']);
  publish(8800); expect(shown()).toEqual(['Mercury']);
  publish(9200); expect(shown()).toEqual(['Mercury']);
  expect(mercury.measurements).toBe(1); expect(venus.measurements).toBe(1);
  expect(all(root)).toEqual(nodes);
  layer.destroy();
});


test('the Sun caption hides while crowded and returns below the marker as the view widens', () => {
  const root = mount(1), layer = mounted.get(root)!;
  const label = find(root, 'contextLabel', 'sun');
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: {positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1]} },
    {focalPixels: 400, principalOffsetPixels: [0, 0]});
  publish(1200);
  expect(label.style.visibility).toBe('hidden');
  publish(4000);
  expect(label.style.visibility).toBe('');
  expect(label.style.transform).toBe('translate(-9px,12px)');
  publish(1200);
  expect(label.style.visibility).toBe('hidden');
  publish(8000);
  expect(label.style.visibility).toBe('');
  expect(label.style.transform).toBe('translate(-9px,12px)');
  layer.destroy();
});

test.each([
  { reason: 'an orbit clears the visible stroke', y: 81.5, extent: 200, weight: 1, shown: true },
  { reason: 'a visible orbit crosses the text', y: 50, extent: 200, weight: 1, shown: false },
  { reason: 'the crossing orbit trail is faded away', y: 50, extent: 200, weight: .01, shown: true },
  { reason: 'the crossing orbit is unresolved at this zoom', y: 50, extent: 65, weight: 1, shown: true },
])('the fixed Sun caption respects visible space when $reason', ({ y, extent, weight, shown }) => {
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


test('crowded inner bodies hide their billboards, circles, labels and orbits together behind the Sun marker', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const source = plan(1);
  const context = parsePreparedWorldContext({ ...source, bodies: source.bodies.map((body, index) => {
    const positionM = [20 + index * 10, 0, 0];
    return { ...body, radiusM: .1, positionM, orbit: { ...body.orbit,
      verticesM: [positionM, [0,500,0], [-500,0,0], [0,-500,0], [500,0,0], [0,500,0], [-500,0,0], [0,-500,0]] } };
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
    for (const element of [body.marker, body.indicator, body.label]) {
      expect(element.style.visibility).toBe('hidden');
      expect(element.style.pointerEvents).toBe('none');
    }
    expect(body.orbit.every(piece => piece.style.visibility === 'hidden')).toBe(true);
  }
  publish(100);
  for (const body of entries.slice(1)) {
    expect(body.marker.style.visibility).toBe('');
    expect(body.indicator.style.visibility).toBe('');
    expect(body.orbit.some(piece => piece.style.visibility === '')).toBe(true);
  }
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
  for (const [distance, locatorOpacity] of [[50, 0], [Math.sqrt(1000 * 10000), 1], [1e21, 1], [50, 0]]) {
    layer.publish(camera(distance!), viewport);
    document.defaultView.advance(200);
    if (locatorOpacity) expect(locator.style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
    expect(locator.style.visibility).toBe(locatorOpacity! > 0 ? '' : 'hidden');
    expect(label.style.visibility).toBe(distance! > 1000 ? '' : 'hidden');
    expect(all(host)).toEqual(retained);
  }
  const distant = camera(1e21);
  distant.pose.positionM = [-1e20, 5e19, 1e21];
  layer.publish(distant, viewport);
  document.defaultView.advance(200);
  expect(layer.inspect().filter(body => body.id !== 'anchor').every(body => body.marker.style.visibility === 'hidden')).toBe(true);
  expect(label.parentNode!.hidden).toBe(false);
  expect(label.style.visibility).toBe(''); expect(label.style.getPropertyValue('--context-label-alpha')).toBe('1');
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

test('unresolved satellite labels wait for a resolved parent while markers remain visible and accepted text blocks background labels', () => {
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
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('hidden');
  expect(label.style.pointerEvents).toBe('none');
  layer.publish(camera(180), viewport);
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('');
  expect(label.dataset.objectNavigateActivation).toBe('click'); expect(label.style.pointerEvents).toBe('auto');
  const [left, top] = label.style.transform.match(/-?[\d.]+/g)!.map(Number);
  expect(layer.labelExclusionRects()).toContainEqual({ left, top, right: left + label.textContent.length * 6, bottom: top + 14 });
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('hidden');
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
  expect(layer.inspect().find(body => body.id === 'sun')!.label.style.visibility).toBe('hidden');
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
  const alpha = () => Number(label.style.getPropertyValue('--context-label-alpha'));
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
    expect(label.style.visibility, `${degrees} degrees`).toBe(''); expect(label.style.getPropertyValue('--context-label-alpha')).toBe('1');
    expect(locator.style.visibility, `${degrees} degrees`).toBe(''); expect(locator.style.opacity).toBe('calc(1 * var(--context-line-opacity, 1))');
  }
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
    positionM: [3e12 + 1e8, 0, 0], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  } }, viewport);
  expect(label.style.pointerEvents).toBe('none');
  document.defaultView.advance(200);
  expect(label.style.visibility).toBe('hidden'); expect(label.style.getPropertyValue('--context-label-alpha')).toBe('0');
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
