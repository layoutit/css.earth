import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import { screenPicking } from '../navigation/screen-picking.js';

class Window {
  time = 0; next = 0; frames = new Map<number, (time: number) => void>();
  performance = { now: () => this.time };
  requestAnimationFrame = (callback: (time: number) => void) => { this.frames.set(++this.next, callback); return this.next; };
  cancelAnimationFrame = (id: number) => { this.frames.delete(id); };
  advance(time: number) { this.time = time; const frames = [...this.frames.values()]; this.frames.clear(); frames.forEach(frame => frame(time)); }
}
class Element extends EventTarget {
  children: Element[] = []; parent: Element | null = null; style: Record<string, string> = {}; dataset: Record<string, string> = {};
  textContent = ''; clientWidth = 800; clientHeight = 600;
  readonly ownerDocument: Document;
  constructor(ownerDocument: Document) { super(); this.ownerDocument = ownerDocument; }
  get offsetWidth() { return this.textContent.length * 6; } get offsetHeight() { return 14; }
  setAttribute() {}
  append(...children: Element[]) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child: Element, before: Element | null) { child.remove(); child.parent = this; this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
}
class Document { count = 0; defaultView = new Window(); createElement() { this.count++; return new Element(this); } }
const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../../src/objects/${path}`, import.meta.url), 'utf8'));

test('alternate catalogue labels keep their side when space opens and throughout rejection fade', () => {
  const payload = { ...read('local-group/prepared/catalogue.json'), objects: [] };
  const nebulae = read('m42/source/nebula.json'), object = nebulae.objects[0];
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement,
    before: before as unknown as HTMLElement, payload, nebulae, onSelect() {} });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  const world = { ...nebulae.frame, pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + 1e17] as const,
    orientationXyzw: [0, 0, 0, 1] as const } };
  const label = runtime.inspect().labels[object.id]!;
  runtime.publish(world, viewport, 0, [{ left: -150, right: 150, top: 5, bottom: 50 }], 0, 0, undefined, 1);
  document.defaultView.advance(250);
  const alternate = label.style.transform;
  expect(Number(label.style.opacity)).toBeGreaterThan(0);
  runtime.publish(world, viewport, 0, [], 0, 0, undefined, 1);
  expect(label.style.transform).toBe(alternate);
  runtime.publish(world, viewport, 0, [{ left: -400, right: 400, top: -300, bottom: 300 }], 0, 0, undefined, 1);
  document.defaultView.advance(300);
  expect(Number(label.style.opacity)).toBeGreaterThan(0);
  expect(label.style.transform).toBe(alternate);
  document.defaultView.advance(500);
  expect(Number(label.style.opacity)).toBe(0);
  runtime.destroy();
});

test('nearby nebula labels wake and follow the camera while both extragalactic fades are zero', () => {
  const payload = { ...read('local-group/prepared/catalogue.json'), objects: [] };
  const nebulae = read('m42/source/nebula.json'), object = nebulae.objects[0];
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const onSelect = vi.fn(), runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement,
    before: before as unknown as HTMLElement, payload, nebulae, onSelect });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const camera = (z: number, x = 0) => ({ ...nebulae.frame, pose: {
    positionM: [object.positionM[0] + x, object.positionM[1], object.positionM[2] + z] as const,
    orientationXyzw: [0,0,0,1] as const } });
  const label = runtime.inspect().labels[object.id]!, nodes = document.count;
  runtime.publish(camera(-1e17), viewport, 0, [], 0);
  expect(label.style.pointerEvents).toBe('none');
  runtime.publish(camera(1e17), viewport, 0, [], 0); document.defaultView.advance(250);
  expect(label.style.pointerEvents).toBe('none');
  // Stellar context admits nebulae; planetary context does not.
  runtime.publish(camera(1e17), viewport, 0, [], 0, 0, undefined, 1); document.defaultView.advance(500);
  expect(label.style.pointerEvents).toBe('auto'); expect(Number(label.style.opacity)).toBe(.65);
  const transform = label.style.transform;
  runtime.publish(camera(1e17, 1e16), viewport, 0, [], 0, 0, undefined, 1);
  expect(label.style.transform).not.toBe(transform);
  label.dispatchEvent(new Event('click')); expect(onSelect).toHaveBeenCalledWith(object);
  expect(document.count).toBe(nodes); runtime.destroy();
});

test('nebula label and its single-click target sit below the prepared cloud', () => {
  const payload = { ...read('local-group/prepared/catalogue.json'), objects: [] };
  const nebulae = read('m42/source/nebula.json'), object = nebulae.objects[0];
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const onSelect = vi.fn(), runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement,
    before: before as unknown as HTMLElement, payload, nebulae, onSelect,
    nebulaFrames: new Map([[object.detailedObjectId, { ...nebulae.frame, originM: object.positionM,
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1e15,
      boundsUnits: { min: [-5, -10, -2], max: [5, 10, 2] } }]]) });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const pose = { ...nebulae.frame, pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + 1e17] as const,
    orientationXyzw: [0, 0, 0, 1] as const } };
  runtime.select(object.id);
  const rectangles = runtime.publish(pose, viewport, 0, [], 0, 0, undefined, 1), bottom = 600 * 1e16 / 9.8e16;
  expect(rectangles).toHaveLength(1);
  expect(rectangles[0]!.top).toBeCloseTo(bottom + 8);
  const picking = screenPicking(host as unknown as HTMLElement), label = runtime.inspect().labels[object.id]!;
  expect(picking.pick(0, bottom + 12)).toBe(label);
  expect(picking.pick(0, -12)).toBeNull();
  label.dispatchEvent(new Event('click')); expect(onSelect).toHaveBeenCalledWith(object);
  runtime.destroy();
});

test('one retained catalogue combines both classes; cluster fades, source-aware focus and aperture follow the same observer', () => {
  const payload = read('local-group/prepared/catalogue.json'), clusters = read('galaxy-clusters/prepared/catalogue.json');
  const galaxyCount = payload.objects.filter((row: { membership: { group: string }; detailedObjectId?: string }) => row.membership.group === 'local-group').length;
  const document = new Document(), host = document.createElement(), before = document.createElement(), pickingHost = document.createElement(); host.append(before);
  const picking = screenPicking(pickingHost as unknown as HTMLElement);
  const onSelect = vi.fn();
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, clusters, onSelect,
    pickingHost: pickingHost as unknown as HTMLElement });
  expect(runtime.inspect().count).toBe(galaxyCount + clusters.objects.length);
  expect(runtime.inspect().clusterCount).toBe(clusters.objects.length);
  const object = clusters.objects[0], nodes = document.count;
  const pose = { referenceFrame: clusters.frame.referenceFrame, epochJdTt: clusters.frame.epochJdTt,
    pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + object.aperture.comovingRadiusM * 4] as const,
      orientationXyzw: [0,0,0,1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const label = runtime.inspect().labels[object.id]!, root = runtime.root as unknown as Element;
  const aperture = root.children.find(node => node.dataset.clusterAperture === object.id)!;
  runtime.select(object.id);
  runtime.publish(pose, viewport, 1, [], 0); document.defaultView.advance(250);
  expect(Number(label.style.opacity)).toBe(0); expect(label.style.pointerEvents).toBe('none');
  expect(picking.pick(0, 15)).not.toBe(label);
  runtime.publish(pose, viewport, 1, [], 1); document.defaultView.advance(350);
  expect(picking.pick(0, 15)).toBe(label);
  expect(screenPicking(host as unknown as HTMLElement).pick(0, 15)).toBeNull();
  expect(Number(label.style.opacity)).toBeCloseTo(.325); expect(Number(aperture.style.opacity)).toBeCloseTo(.1);
  const firstTransform = aperture.style.transform;
  const shifted = { ...pose, pose: { ...pose.pose, positionM: [pose.pose.positionM[0] + object.aperture.comovingRadiusM, ...pose.pose.positionM.slice(1)] as [number,number,number] } };
  const blockers = runtime.publish(shifted, viewport, 1, [], 1);
  expect(aperture.style.transform).not.toBe(firstTransform); expect(blockers.length).toBeGreaterThan(0);
  runtime.publish(shifted, viewport, 1, [{ left: -400, right: 400, top: -300, bottom: 300 }], 1);
  expect(label.style.pointerEvents).toBe('none');
  expect(picking.pick(-150, 15)).not.toBe(label);
  label.dispatchEvent(new Event('click')); expect(onSelect).not.toHaveBeenCalled();
  document.defaultView.advance(400); expect(Number(label.style.opacity)).toBeGreaterThan(0); expect(Number(label.style.opacity)).toBeLessThan(.325);
  runtime.publish(shifted, viewport, 1, [], 1); document.defaultView.advance(600);
  expect(Number(label.style.opacity)).toBe(.65); label.dispatchEvent(new Event('click'));
  expect(onSelect).toHaveBeenCalledWith(object); expect(runtime.resolve(object.id)).toMatchObject({kind: 'galaxy-cluster'});
  expect(document.count).toBe(nodes);
  runtime.publish({ ...pose, pose: { ...pose.pose, positionM: [object.positionM[0], object.positionM[1], object.positionM[2] - object.aperture.comovingRadiusM * 4] } }, viewport, 1, [], 1);
  document.defaultView.advance(800); expect(Number(label.style.opacity)).toBe(0); expect(Number(aperture.style.opacity)).toBe(0);
  expect(picking.pick(0, 15)).not.toBe(label);
  runtime.publish(pose, viewport, 1, [], 1);
  expect(picking.pick(0, 15)).toBe(label);
  runtime.destroy(); expect(document.defaultView.frames.size).toBe(0); expect(host.children).toEqual([before]);
  expect(picking.pick(0, 15)).toBeNull();
});

test('only labels that show or are still fading out follow the camera', () => {
  const payload = read('local-group/prepared/catalogue.json'), clusters = read('galaxy-clusters/prepared/catalogue.json');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, clusters });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const observer = (x: number) => ({ referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
    pose: { positionM: [x, 0, 1e23] as const, orientationXyzw: [0,0,0,1] as const } });
  const root = runtime.root as unknown as Element, labels = Object.values(runtime.inspect().labels) as unknown as Element[];
  const ids = (list: Element[]) => list.map(label => label.dataset.galaxyLabel);
  const transforms = () => labels.map(label => label.style.transform);
  runtime.publish(observer(0), viewport, 1); document.defaultView.advance(300);
  const shown = labels.filter(label => Number(label.style.opacity) > 0);
  expect(shown.length).toBe(Number(root.dataset.visibleLabels));
  expect(root.children.filter(node => node.dataset.galaxyMarker && node.style.transform).length).toBeGreaterThanOrEqual(shown.length);
  expect(ids(labels.filter(label => label.style.transform))).toEqual(ids(shown));
  // Covering the screen hides every label. Labels still fading out keep following their galaxies.
  const cover = [{ left: -400, right: 400, top: -300, bottom: 300 }], previous = transforms();
  runtime.publish(observer(1e21), viewport, 1, cover);
  const fading = transforms();
  expect(ids(labels.filter((_, index) => fading[index] !== previous[index]))).toEqual(ids(shown));
  document.defaultView.advance(900);
  runtime.publish(observer(2e21), viewport, 1, cover);
  expect(transforms()).toEqual(fading);
  runtime.destroy();
});

test('catalogue-only rows remain dots without marker captions while saved catalogue links still resolve', () => {
  const payload = read('local-group/prepared/catalogue.json');
  const unsupported = payload.objects.find((row: {membership:{group:string};detailedObjectId?:string}) => row.membership.group === 'local-group' && !row.detailedObjectId);
  const supported = payload.objects.find((row: {detailedObjectId?:string}) => row.detailedObjectId);
  expect(unsupported).toBeTruthy(); expect(supported).toBeTruthy();
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({host:host as unknown as HTMLElement, before:before as unknown as HTMLElement,
    payload, renderedObjectIds:new Set([supported.detailedObjectId])});
  expect(runtime.resolve(unsupported.id)).toEqual(unsupported);
  expect(runtime.inspect().labels[unsupported.id]).toBeDefined();
  expect(runtime.resolve(supported.id)).toEqual(supported);
  expect(runtime.resolve(supported.detailedObjectId)).toEqual(supported);
  expect(runtime.inspect().count).toBe(payload.objects.filter((row: {membership:{group:string}}) => row.membership.group === 'local-group').length);
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const world = { ...payload.frame, pose: { positionM: [0,0,1e24] as const, orientationXyzw: [0,0,0,1] as const } };
  runtime.publish(world, viewport, 1); document.defaultView.advance(300);
  const root = runtime.root as unknown as Element;
  const dots = root.children.filter(node => node.dataset.galaxyDot && Number(node.style.opacity) > 0);
  expect(dots.length).toBeGreaterThan(10);
  expect(Number(root.dataset.visibleLabels)).toBeLessThanOrEqual(12);
  const unsupportedLabel = runtime.inspect().labels[unsupported.id]!;
  const unsupportedMarker = root.children.find(node => node.dataset.galaxyMarker === unsupported.id);
  expect(unsupportedLabel.style.pointerEvents).toBe('none');
  expect(Number(unsupportedLabel.style.opacity)).toBe(0);
  expect(root.children.some(node => node.dataset.galaxyLabel === unsupported.id)).toBe(false);
  expect(unsupportedMarker).toBeUndefined();
  for (const id of ['hydra_1', 'leo_a', 'sagittarius_1']) {
    const row = payload.objects.find((object: {id: string}) => object.id === id);
    expect(row?.detailedObjectId).toBeUndefined();
    expect(root.children.some(node => node.dataset.galaxyDot === id)).toBe(true);
    expect(root.children.some(node => node.dataset.galaxyLabel === id || node.dataset.galaxyMarker === id)).toBe(false);
  }
  expect(root.children.some(node => node.dataset.galaxyLabel === supported.id)).toBe(true);
  runtime.publish(world, viewport, 0); document.defaultView.advance(600);
  expect(dots.every(dot => Number(dot.style.opacity) === 0)).toBe(true);
  runtime.destroy();
});

test('baked sparse sample shows dots before names without enabling unsupported navigation', () => {
  const payload = read('local-group/prepared/catalogue.json');
  const galaxySample = read('local-group/prepared/display-sample.json');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const onSelect = vi.fn();
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement,
    payload, galaxySample, onSelect });
  expect(galaxySample.ids).toHaveLength(48);
  expect(runtime.inspect().count).toBe(52);
  const world = { ...payload.frame, pose: { positionM: [0,0,1e24] as const, orientationXyzw: [0,0,0,1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  runtime.publish(world, viewport, 0, [], 0, 1); document.defaultView.advance(300);
  const root = runtime.root as unknown as Element;
  expect(root.children.filter(node => node.dataset.galaxyDot && Number(node.style.opacity) > 0).length).toBeGreaterThan(20);
  expect(Number(root.dataset.visibleLabels)).toBe(0);
  runtime.publish(world, viewport, 1, [], 0, 1); document.defaultView.advance(600);
  expect(Number(root.dataset.visibleLabels)).toBeGreaterThan(0);
  expect(Number(root.dataset.visibleLabels)).toBeLessThanOrEqual(12);
  for (const id of galaxySample.ids) {
    expect(runtime.resolve(id)?.id).toBe(id);
    expect(runtime.inspect().labels[id]!.dataset.objectNavigate).toBeUndefined();
    expect(runtime.inspect().labels[id]!.style.cursor).toBe('default');
    runtime.inspect().labels[id]!.dispatchEvent(new Event('click'));
  }
  expect(onSelect).not.toHaveBeenCalled(); runtime.destroy();
});

test('a focused catalogue-only row outside the display sample does not fabricate a marker and caption', () => {
  const payload = read('local-group/prepared/catalogue.json');
  const galaxySample = read('local-group/prepared/display-sample.json');
  const object = payload.objects.find((row: { id: string }) => row.id === 'draco_2');
  expect(object).toBeTruthy(); expect(galaxySample.ids).not.toContain('draco_2');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, galaxySample, onSelect() {} });
  const captions = () => { const found: Element[] = []; const walk = (node: Element) => { if (node.textContent === 'Draco II') found.push(node); node.children.forEach(walk); }; walk(host); return found; };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  const world = { ...payload.frame, pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + 3.5e19] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const shown = () => captions().some(label => Number(label.style.opacity) > 0);
  runtime.publish(world, viewport, 1); document.defaultView.advance(400);
  expect(shown()).toBe(false);
  runtime.select('draco_2');
  runtime.publish(world, viewport, 1); document.defaultView.advance(800);
  expect(shown()).toBe(false);
  runtime.select(null);
  runtime.publish(world, viewport, 1); document.defaultView.advance(900); document.defaultView.advance(1400);
  expect(shown()).toBe(false);
  runtime.destroy();
});
