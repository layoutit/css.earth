import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { mountPreparedWorldContext, parsePreparedWorldContext, preparedVolumeOpacity } from './prepared-world-context.js';
import { labelRectsOverlap } from '../labels/screen-label-layout.js';

class FakeElement extends EventTarget {
  readonly children: FakeElement[] = [];
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null;
  className = ''; textContent = ''; hidden = false; clientWidth = 0; clientHeight = 0;
  measurements = 0;
  constructor(readonly ownerDocument: FakeDocument, readonly tagName: string) { super(); }
  setAttribute(): void {}
  removeAttribute(): void {}
  getBoundingClientRect() { this.measurements++; return { width: this.textContent.length * 7, height: 14 }; }
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
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 2_000].map(value => value * scale), orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [30, -20] });
  mounted.set(layer.root as unknown as FakeElement, layer);
  return layer.root as unknown as FakeElement;
}

test('accepts the generated Sun context and rejects detached or malformed prepared data', async () => {
  const source = JSON.parse(await readFile(fileURLToPath(new URL('../../../planets/sun/prepared/world-context.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
  const authored = JSON.parse(await readFile(new URL('../../../planets/sun/source/navigation/universe.json', import.meta.url), 'utf8')) as { bodies: { id: string }[] };
  expect(parsePreparedWorldContext(source).bodies.map(body => body.id))
    .toEqual(authored.bodies.map(body => body.id));
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
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 2000], orientationXyzw: [0, 0, 0, 1] } },
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
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: { positionM: [0, 0, 2000], orientationXyzw: [0, 0, 0, 1] } },
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
  const label = focus.label as unknown as FakeElement, locator = focus.locator as unknown as FakeElement;
  const retained = all(host);
  expect(label.textContent).toBe('Anchor');
  expect(label.parentNode).not.toBe(root);
  expect(all(host).filter(node => node.dataset.contextLabel === 'anchor')).toEqual([label]);
  const viewport = { focalPixels: 400, principalOffsetPixels: [30, -20] as const };
  const camera = (distance: number) => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } });
  for (const [distance, locatorOpacity] of [[50, 0], [Math.sqrt(1000 * 10000), .5], [1e21, 1], [50, 0]]) {
    layer.publish(camera(distance!), viewport);
    document.defaultView.advance(200);
    expect(Number(locator.style.opacity)).toBeCloseTo(locatorOpacity!, 12);
    expect(locator.style.visibility).toBe(locatorOpacity! > 0 ? '' : 'hidden');
    expect(label.style.visibility).toBe(distance! > 1000 ? '' : 'hidden');
    expect(all(host)).toEqual(retained);
  }
  const distant = camera(1e21);
  distant.pose.positionM = [-1e20, 5e19, 1e21];
  layer.publish(distant, viewport);
  document.defaultView.advance(200);
  expect(root.hidden).toBe(true);
  expect(label.parentNode!.hidden).toBe(false);
  expect(label.style.visibility).toBe(''); expect(label.style.opacity).toBe('1');
  expect(locator.style.visibility).toBe(''); expect(locator.style.opacity).toBe('1');
  expect(locator.style.transform).toBe('translate(67px,-43px)');
  expect(label.style.transform).toBe('translate(79px,-47px)');
  expect(locator.dataset.objectNavigate).toBe('anchor');
  const selections: string[] = [];
  host.addEventListener('objectnavigate', event => selections.push((event as CustomEvent<{ objectId: string }>).detail.objectId));
  label.dispatchEvent(new Event('click')); expect(selections).toEqual([]);
  label.dispatchEvent(new Event('dblclick')); expect(selections).toEqual(['anchor']);
  // Roll moves the physical projected location; a reversed view must cull it.
  distant.pose.orientationXyzw = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  layer.publish(distant, viewport);
  expect(locator.style.transform).not.toBe('translate(67px,-43px)');
  for (const pose of [
    { ...camera(1e21).pose, orientationXyzw: [0, 1, 0, 0] },
    { ...camera(1e21).pose, positionM: [-2e21, 0, 1e21] },
  ]) {
    layer.publish({ ...distant, pose }, viewport);
    expect(locator.style.visibility).toBe('hidden'); expect(label.style.visibility).toBe('hidden');
    expect(locator.style.pointerEvents).toBe('none'); expect(label.style.pointerEvents).toBe('none');
    label.dispatchEvent(new Event('dblclick')); expect(selections).toEqual(['anchor']);
  }
  layer.destroy(); expect(host.children).toEqual([before]);
  label.dispatchEvent(new Event('dblclick')); expect(selections).toEqual(['anchor']);
  expect(label.measurements).toBe(1, 'camera publication must never remeasure label layout');
});

test('satellite labels wait for a resolved parent while markers remain visible and accepted text blocks background labels', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const base = plan(1), parent = { ...base.bodies[0]!, radiusM: 5 }, satellite = base.bodies[1]!;
  const positionM = [250, 0, 0];
  const context = parsePreparedWorldContext({ ...base, system: { fadeOutStartDistanceM: 1e10, hiddenDistanceM: 1e11 },
    bodies: [parent, { ...satellite, positionM, orbit: { ...satellite.orbit, centerBodyId: parent.id,
      centerPositionM: parent.positionM, verticesM: Array.from({ length: 8 }, () => positionM) } }] });
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
  expect(label.dataset.objectNavigateActivation).toBe('dblclick'); expect(label.style.pointerEvents).toBe('auto');
  const left = 400 * 150 / 180 + 8;
  expect(layer.labelExclusionRects()).toContainEqual({ left, top: -8, right: left + 37, bottom: 8 });
  layer.publish(camera(1000), viewport);
  document.defaultView.advance(200);
  expect(marker.style.visibility).toBe(''); expect(label.style.visibility).toBe('hidden');
  expect(label.style.pointerEvents).toBe('none'); expect(label.measurements).toBe(1);
  layer.destroy(); expect(layer.labelExclusionRects()).toEqual([]);
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

test('solar text fades through collision and distance changes, reverses continuously, and disables fading targets immediately', () => {
  const document = new FakeDocument(), host = document.createElement('section'), before = document.createElement('i');
  host.clientWidth = 800; host.clientHeight = 600; host.append(before);
  const context = parsePreparedWorldContext({ ...plan(1), system: { fadeOutStartDistanceM: 1e10, hiddenDistanceM: 1e11 } });
  const layer = mountPreparedWorldContext({ host: host as unknown as HTMLElement, before: before as unknown as Element,
    plan: context, sprites: { sun: sprite, mercury: sprite, venus: sprite } });
  const label = layer.inspect().find(body => body.id === 'mercury')!.label as unknown as FakeElement;
  const nodes = all(host), clock = document.defaultView;
  const publish = (distance: number) => layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 400, principalOffsetPixels: [0, 0] });
  publish(1000); expect(label.style.opacity).toBe('0');
  clock.advance(100); expect(Number(label.style.opacity)).toBeCloseTo(.5, 12);
  clock.advance(100); expect(label.style.opacity).toBe('1');
  publish(2000); // Mercury's text now overlaps the higher-priority Sun label.
  expect(label.style.visibility).toBe(''); expect(label.style.opacity).toBe('1');
  expect(label.style.pointerEvents).toBe('none');
  clock.advance(100); expect(Number(label.style.opacity)).toBeCloseTo(.5, 12);
  publish(1000); expect(Number(label.style.opacity)).toBeCloseTo(.5, 12);
  expect(clock.timers.size).toBe(0);
  clock.advance(100); expect(Number(label.style.opacity)).toBeCloseTo(.75, 12);
  clock.advance(100); expect(label.style.opacity).toBe('1');
  publish(2000); clock.advance(200);
  expect(label.style.visibility).toBe('hidden'); expect(label.style.opacity).toBe('0');
  publish(1000); clock.advance(200); publish(1e21);
  expect((layer.root as unknown as FakeElement).hidden).toBe(true);
  expect(label.parentNode!.hidden).toBe(false); expect(label.style.visibility).toBe('');
  clock.advance(100); expect(Number(label.style.opacity)).toBeCloseTo(.5, 12);
  clock.advance(100); expect(label.style.visibility).toBe('hidden');
  publish(1000); clock.advance(100); publish(2000);
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
  const locator = focus.locator as unknown as FakeElement;
  const viewport = { focalPixels: 400, principalOffsetPixels: [0, 0] as const };
  for (let degrees = 0; degrees < 360; degrees++) {
    const angle = degrees * Math.PI / 180;
    layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
      positionM: [distance * Math.sin(angle), 0, distance * Math.cos(angle)],
      orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
    } }, viewport);
    document.defaultView.advance(200);
    expect(label.style.visibility, `${degrees} degrees`).toBe(''); expect(label.style.opacity).toBe('1');
    expect(locator.style.visibility, `${degrees} degrees`).toBe(''); expect(locator.style.opacity).toBe('1');
  }
  layer.publish({ referenceFrame: 'sun-icrf', epochJdTt: 1, pose: {
    positionM: [3e12 + 1e8, 0, 0], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
  } }, viewport);
  expect(label.style.pointerEvents).toBe('none');
  document.defaultView.advance(200);
  expect(label.style.visibility).toBe('hidden'); expect(label.style.opacity).toBe('0');
  layer.destroy();
});
