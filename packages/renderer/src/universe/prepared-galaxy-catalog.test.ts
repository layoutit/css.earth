import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
  assert.ok(Number(label.style.opacity) > 0);
  runtime.publish(world, viewport, 0, [], 0, 0, undefined, 1);
  assert.equal(label.style.transform, alternate);
  runtime.publish(world, viewport, 0, [{ left: -400, right: 400, top: -300, bottom: 300 }], 0, 0, undefined, 1);
  document.defaultView.advance(300);
  assert.ok(Number(label.style.opacity) > 0);
  assert.equal(label.style.transform, alternate);
  document.defaultView.advance(500);
  assert.equal(Number(label.style.opacity), 0);
  runtime.destroy();
});

test('nearby nebula labels wake and follow the camera while both extragalactic fades are zero', () => {
  const payload = { ...read('local-group/prepared/catalogue.json'), objects: [] };
  const nebulae = read('m42/source/nebula.json'), object = nebulae.objects[0];
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const onSelect = mock.fn(() => {}), runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement,
    before: before as unknown as HTMLElement, payload, nebulae, onSelect });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const camera = (z: number, x = 0) => ({ ...nebulae.frame, pose: {
    positionM: [object.positionM[0] + x, object.positionM[1], object.positionM[2] + z] as const,
    orientationXyzw: [0,0,0,1] as const } });
  const label = runtime.inspect().labels[object.id]!, nodes = document.count;
  runtime.publish(camera(-1e17), viewport, 0, [], 0);
  assert.equal(label.style.pointerEvents, 'none');
  runtime.publish(camera(1e17), viewport, 0, [], 0); document.defaultView.advance(250);
  assert.equal(label.style.pointerEvents, 'none');
  // Stellar context admits nebulae; planetary context does not.
  runtime.publish(camera(1e17), viewport, 0, [], 0, 0, undefined, 1); document.defaultView.advance(500);
  assert.equal(label.style.pointerEvents, 'auto'); assert.equal(Number(label.style.opacity), .65);
  const transform = label.style.transform;
  runtime.publish(camera(1e17, 1e16), viewport, 0, [], 0, 0, undefined, 1);
  assert.notEqual(label.style.transform, transform);
  label.dispatchEvent(new Event('click')); assert.ok(onSelect.mock.calls.some(call => isDeepStrictEqual(call.arguments, [object])));
  assert.equal(document.count, nodes); runtime.destroy();
});

test('nebula label and its single-click target sit below the prepared cloud', () => {
  const payload = { ...read('local-group/prepared/catalogue.json'), objects: [] };
  const nebulae = read('m42/source/nebula.json'), object = nebulae.objects[0];
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const onSelect = mock.fn(() => {}), runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement,
    before: before as unknown as HTMLElement, payload, nebulae, onSelect,
    nebulaFrames: new Map([[object.detailedObjectId, { ...nebulae.frame, originM: object.positionM,
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1e15,
      boundsUnits: { min: [-5, -10, -2], max: [5, 10, 2] } }]]) });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const pose = { ...nebulae.frame, pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + 1e17] as const,
    orientationXyzw: [0, 0, 0, 1] as const } };
  runtime.select(object.id);
  const rectangles = runtime.publish(pose, viewport, 0, [], 0, 0, undefined, 1), bottom = 600 * 1e16 / 9.8e16;
  assert.equal(rectangles.length, 1);
  assert.ok(Math.abs(rectangles[0]!.top - (bottom + 8)) < 10 ** -2 / 2, `${rectangles[0]!.top} is not close to ${bottom + 8}`);
  const picking = screenPicking(host as unknown as HTMLElement), label = runtime.inspect().labels[object.id]!;
  assert.equal(picking.pick(0, bottom + 12), label);
  assert.equal(picking.pick(0, -12), null);
  label.dispatchEvent(new Event('click')); assert.ok(onSelect.mock.calls.some(call => isDeepStrictEqual(call.arguments, [object])));
  runtime.destroy();
});

test('one retained catalogue combines both classes; cluster fades and source-aware focus follow the same observer, and a cluster is named without a marker or outline', () => {
  const payload = read('local-group/prepared/catalogue.json'), clusters = read('galaxy-clusters/prepared/catalogue.json');
  const galaxyCount = payload.objects.filter((row: { membership: { group: string }; detailedObjectId?: string }) => row.membership.group === 'local-group').length;
  const document = new Document(), host = document.createElement(), before = document.createElement(), pickingHost = document.createElement(); host.append(before);
  const picking = screenPicking(pickingHost as unknown as HTMLElement);
  const onSelect = mock.fn(() => {});
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, clusters, onSelect,
    pickingHost: pickingHost as unknown as HTMLElement });
  assert.equal(runtime.inspect().count, galaxyCount + clusters.objects.length);
  assert.equal(runtime.inspect().clusterCount, clusters.objects.length);
  const object = clusters.objects[0], nodes = document.count;
  const pose = { referenceFrame: clusters.frame.referenceFrame, epochJdTt: clusters.frame.epochJdTt,
    pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + object.aperture.comovingRadiusM * 4] as const,
      orientationXyzw: [0,0,0,1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const label = runtime.inspect().labels[object.id]!, root = runtime.root as unknown as Element;
  assert.equal(root.children.some(node => node.dataset.clusterAperture !== undefined || node.dataset.galaxyMarker === object.id), false, 'no outline or marker');
  runtime.select(object.id);
  runtime.publish(pose, viewport, 1, [], 0); document.defaultView.advance(250);
  assert.equal(Number(label.style.opacity), 0); assert.equal(label.style.pointerEvents, 'none');
  assert.notEqual(picking.pick(0, 15), label);
  runtime.publish(pose, viewport, 1, [], 1); document.defaultView.advance(350);
  assert.equal(picking.pick(0, 15), label);
  assert.equal(screenPicking(host as unknown as HTMLElement).pick(0, 15), null);
  assert.ok(Math.abs(Number(label.style.opacity) - (.325)) < 10 ** -2 / 2, `${Number(label.style.opacity)} is not close to ${.325}`);
  const firstTransform = label.style.transform;
  const shifted = { ...pose, pose: { ...pose.pose, positionM: [pose.pose.positionM[0] + object.aperture.comovingRadiusM, ...pose.pose.positionM.slice(1)] as [number,number,number] } };
  const blockers = runtime.publish(shifted, viewport, 1, [], 1);
  assert.notEqual(label.style.transform, firstTransform); assert.ok(blockers.length > 0);
  runtime.publish(shifted, viewport, 1, [{ left: -400, right: 400, top: -300, bottom: 300 }], 1);
  assert.equal(label.style.pointerEvents, 'none');
  assert.notEqual(picking.pick(-150, 15), label);
  label.dispatchEvent(new Event('click')); assert.equal(onSelect.mock.callCount(), 0);
  document.defaultView.advance(400); assert.ok(Number(label.style.opacity) > 0); assert.ok(Number(label.style.opacity) < .325);
  runtime.publish(shifted, viewport, 1, [], 1); document.defaultView.advance(600);
  assert.equal(Number(label.style.opacity), .65); label.dispatchEvent(new Event('click'));
  assert.ok(onSelect.mock.calls.some(call => isDeepStrictEqual(call.arguments, [object]))); assert.partialDeepStrictEqual(runtime.resolve(object.id), {kind: 'galaxy-cluster'});
  assert.equal(document.count, nodes);
  runtime.publish({ ...pose, pose: { ...pose.pose, positionM: [object.positionM[0], object.positionM[1], object.positionM[2] - object.aperture.comovingRadiusM * 4] } }, viewport, 1, [], 1);
  document.defaultView.advance(800); assert.equal(Number(label.style.opacity), 0);
  assert.notEqual(picking.pick(0, 15), label);
  runtime.publish(pose, viewport, 1, [], 1);
  assert.equal(picking.pick(0, 15), label);
  runtime.destroy(); assert.equal(document.defaultView.frames.size, 0); assert.deepEqual(host.children, [before]);
  assert.equal(picking.pick(0, 15), null);
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
  assert.equal(shown.length, Number(root.dataset.visibleLabels));
  // A cluster is named without a marker; every other shown label has one.
  const clusterIds = new Set(clusters.objects.map((object: { id: string }) => object.id));
  assert.ok(root.children.filter(node => node.dataset.galaxyMarker && node.style.transform).length >= shown.filter(label => !clusterIds.has(label.dataset.galaxyLabel)).length);
  assert.deepEqual(ids(labels.filter(label => label.style.transform)), ids(shown));
  // Covering the screen hides every label. Labels still fading out keep following their galaxies.
  const cover = [{ left: -400, right: 400, top: -300, bottom: 300 }], previous = transforms();
  runtime.publish(observer(1e21), viewport, 1, cover);
  const fading = transforms();
  assert.deepEqual(ids(labels.filter((_, index) => fading[index] !== previous[index])), ids(shown));
  document.defaultView.advance(900);
  runtime.publish(observer(2e21), viewport, 1, cover);
  assert.deepEqual(transforms(), fading);
  runtime.destroy();
});

test('catalogue-only rows remain dots without marker captions while saved catalogue links still resolve', () => {
  const payload = read('local-group/prepared/catalogue.json');
  const unsupported = payload.objects.find((row: {membership:{group:string};detailedObjectId?:string}) => row.membership.group === 'local-group' && !row.detailedObjectId);
  const supported = payload.objects.find((row: {detailedObjectId?:string}) => row.detailedObjectId);
  assert.ok(unsupported); assert.ok(supported);
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({host:host as unknown as HTMLElement, before:before as unknown as HTMLElement,
    payload, renderedObjectIds:new Set([supported.detailedObjectId])});
  assert.deepEqual(runtime.resolve(unsupported.id), unsupported);
  assert.notEqual(runtime.inspect().labels[unsupported.id], undefined);
  assert.deepEqual(runtime.resolve(supported.id), supported);
  assert.deepEqual(runtime.resolve(supported.detailedObjectId), supported);
  assert.equal(runtime.inspect().count, payload.objects.filter((row: {membership:{group:string}}) => row.membership.group === 'local-group').length);
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const world = { ...payload.frame, pose: { positionM: [0,0,1e24] as const, orientationXyzw: [0,0,0,1] as const } };
  runtime.publish(world, viewport, 1); document.defaultView.advance(300);
  const root = runtime.root as unknown as Element;
  const dots = root.children.filter(node => node.dataset.galaxyDot && Number(node.style.opacity) > 0);
  assert.ok(dots.length > 10);
  assert.ok(Number(root.dataset.visibleLabels) <= 12);
  const unsupportedLabel = runtime.inspect().labels[unsupported.id]!;
  const unsupportedMarker = root.children.find(node => node.dataset.galaxyMarker === unsupported.id);
  assert.equal(unsupportedLabel.style.pointerEvents, 'none');
  assert.equal(Number(unsupportedLabel.style.opacity), 0);
  assert.equal(root.children.some(node => node.dataset.galaxyLabel === unsupported.id), false);
  assert.equal(unsupportedMarker, undefined);
  for (const id of ['hydra_1', 'leo_a', 'sagittarius_1']) {
    const row = payload.objects.find((object: {id: string}) => object.id === id);
    assert.equal(row?.detailedObjectId, undefined);
    assert.equal(root.children.some(node => node.dataset.galaxyDot === id), true);
    assert.equal(root.children.some(node => node.dataset.galaxyLabel === id || node.dataset.galaxyMarker === id), false);
  }
  assert.equal(root.children.some(node => node.dataset.galaxyLabel === supported.id), true);
  runtime.publish(world, viewport, 0); document.defaultView.advance(600);
  assert.equal(dots.every(dot => Number(dot.style.opacity) === 0), true);
  runtime.destroy();
});

test('baked sparse sample shows dots before names without enabling unsupported navigation', () => {
  const payload = read('local-group/prepared/catalogue.json');
  const galaxySample = read('local-group/prepared/display-sample.json');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const onSelect = mock.fn(() => {});
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement,
    payload, galaxySample, onSelect });
  assert.equal(galaxySample.ids.length, 48);
  assert.equal(runtime.inspect().count, 52);
  const world = { ...payload.frame, pose: { positionM: [0,0,1e24] as const, orientationXyzw: [0,0,0,1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  runtime.publish(world, viewport, 0, [], 0, 1); document.defaultView.advance(300);
  const root = runtime.root as unknown as Element;
  assert.ok(root.children.filter(node => node.dataset.galaxyDot && Number(node.style.opacity) > 0).length > 20);
  assert.equal(Number(root.dataset.visibleLabels), 0);
  runtime.publish(world, viewport, 1, [], 0, 1); document.defaultView.advance(600);
  assert.ok(Number(root.dataset.visibleLabels) > 0);
  assert.ok(Number(root.dataset.visibleLabels) <= 12);
  for (const id of galaxySample.ids) {
    assert.equal(runtime.resolve(id)?.id, id);
    assert.equal(runtime.inspect().labels[id]!.dataset.objectNavigate, undefined);
    // Without data-object-navigate the label keeps the stylesheet's default cursor (world-context.css), never an inline one.
    assert.equal(runtime.inspect().labels[id]!.style.cursor, undefined);
    runtime.inspect().labels[id]!.dispatchEvent(new Event('click'));
  }
  assert.equal(onSelect.mock.callCount(), 0); runtime.destroy();
  const css = readFileSync(new URL('../styles/world-context.css', import.meta.url), 'utf8');
  assert.match(css, /\.prepared-galaxy-catalog \[data-galaxy-label\] \{\s*cursor: default;\s*\}/u);
  assert.match(css, /\.prepared-galaxy-catalog \[data-galaxy-label\]\[data-object-navigate\] \{\s*cursor: pointer;\s*\}/u);
});

test('a focused catalogue-only row outside the display sample does not fabricate a marker and caption', () => {
  const payload = read('local-group/prepared/catalogue.json');
  const galaxySample = read('local-group/prepared/display-sample.json');
  const object = payload.objects.find((row: { id: string }) => row.id === 'draco_2');
  assert.ok(object); assert.ok(!galaxySample.ids.includes('draco_2'));
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, galaxySample, onSelect() {} });
  const captions = () => { const found: Element[] = []; const walk = (node: Element) => { if (node.textContent === 'Draco II') found.push(node); node.children.forEach(walk); }; walk(host); return found; };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  const world = { ...payload.frame, pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + 3.5e19] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const shown = () => captions().some(label => Number(label.style.opacity) > 0);
  runtime.publish(world, viewport, 1); document.defaultView.advance(400);
  assert.equal(shown(), false);
  runtime.select('draco_2');
  runtime.publish(world, viewport, 1); document.defaultView.advance(800);
  assert.equal(shown(), false);
  runtime.select(null);
  runtime.publish(world, viewport, 1); document.defaultView.advance(900); document.defaultView.advance(1400);
  assert.equal(shown(), false);
  runtime.destroy();
});

test('a galaxy with a published stellar extent hangs its caption under its drawn sphere and hides it inside the extent', () => {
  const payload = read('local-group/prepared/catalogue.json'), lmc = payload.objects.find((row: { id: string }) => row.id === 'lmc');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const kpc = 3.0856775814913673e19;
  const frame = { referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt, originM: lmc.positionM,
    localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: kpc, boundsUnits: { min: [-8, -8, -8] as const, max: [8, 8, 8] as const } };
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload,
    renderedObjectIds: new Set(['lmc']), billboardedObjectIds: new Set(['lmc']),
    galaxyCaptions: new Map([['lmc', { frame, drawnRadiusUnits: 5, extentRadiusUnits: 18.5 }]]) });
  const viewport = { focalPixels: 600, principalOffsetPixels: [0, 0] as const, widthPixels: 1600, heightPixels: 1200 };
  const camera = (kpcAway: number) => ({ ...payload.frame, pose: { positionM: [lmc.positionM[0], lmc.positionM[1], lmc.positionM[2] + kpcAway * kpc] as const, orientationXyzw: [0, 0, 0, 1] as const } });
  const label = runtime.inspect().labels.lmc!;
  // 5 kpc seen from 200 kpc at a 600 px focal length drops 15 px; the caption's bottom is 8 px gap and 14 px of text below.
  runtime.publish(camera(200), viewport, 1);
  document.defaultView.advance(250);
  assert.equal(label.style.transform, 'translate(0px,37px) translate(-50%,-100%)');
  assert.ok(Number(label.style.opacity) > 0);
  // Inside the 18.5 kpc extent the caption hides.
  runtime.publish(camera(10), viewport, 1);
  document.defaultView.advance(500);
  assert.equal(Number(label.style.opacity), 0);
  runtime.destroy();
});
test('a header pill category shows its labels at full strength and fades the other classes to a third', () => {
  const payload = { ...read('local-group/prepared/catalogue.json'), objects: [] }, clusters = read('galaxy-clusters/prepared/catalogue.json');
  const nebulae = read('m42/source/nebula.json');
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.append(before);
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, clusters, nebulae });
  const object = clusters.objects[0], label = runtime.inspect().labels[object.id]!, root = runtime.root as unknown as Element;
  const pose = { referenceFrame: clusters.frame.referenceFrame, epochJdTt: clusters.frame.epochJdTt,
    pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + object.aperture.comovingRadiusM * 4] as const,
      orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
  const settle = (time: number) => { runtime.publish(pose, viewport, 1, [], 1); document.defaultView.advance(time); return Number(label.style.opacity); };
  assert.equal(settle(400), .65);
  runtime.highlight('galaxy-cluster');
  assert.equal(root.dataset.highlighted, String(clusters.objects.length));
  assert.equal(settle(800), 1);
  // A category this layer does not draw leaves it as it was; the body markers carry that highlight.
  runtime.highlight('galaxy');
  assert.equal(root.dataset.highlighted, '0');
  assert.equal(settle(1200), .65);
  runtime.highlight('nebula');
  assert.equal(root.dataset.highlighted, String(nebulae.objects.length));
  assert.ok(Math.abs(settle(1600) - (.65 * .3)) < 10 ** -2 / 2, `${settle(1600)} is not close to ${.65 * .3}`);
  runtime.highlight(null);
  assert.equal(settle(2000), .65);
  runtime.destroy();
});
