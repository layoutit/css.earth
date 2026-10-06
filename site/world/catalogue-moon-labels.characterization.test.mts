import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createLabelBudget } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { admitStableLabels as admit } from '@cssearth/renderer/labels/stable-label-layout.ts';
let candidates: Parameters<typeof admit>[0] = [];
mock.module('@cssearth/renderer/labels/stable-label-layout.ts', { namedExports: {
  admitStableLabels: (...args: Parameters<typeof admit>) => { candidates = args[0]; return admit(...args); },
} });
import type { WorldCameraPose } from '@cssearth/engine';
mock.module(new URL('../prepared/moon-labels.prepared.json', import.meta.url).href, { defaultExport: {
  schema: 'cssearth-moon-labels@1', referenceFrame: 'world', epochJdTt: 1,
  moons: [{ id: 'moon-a', name: 'Moon A', parentId: 'planet', positionM: [100, 0, 0], parentDistanceM: 100 }],
} });
const { parseMoonLabels, projectMoonLabels, mountCatalogueMoonLabels } = await import('./catalogue-moon-labels.mts');
const world: WorldCameraPose = { referenceFrame: 'world', epochJdTt: 1, pose: { positionM: [0, 0, 1000], orientationXyzw: [0, 0, 0, 1] } };
const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 800, heightPixels: 600 };
const parent = { id: 'planet', positionM: [0, 0, 0], radiusM: 1 };
const moon = { id: 'moon-a', name: 'Moon A', parentId: 'planet', positionM: [100, 0, 0], parentDistanceM: 100 };
test('moon parser omits null positions and rejects malformed coordinates, ranges and duplicate ids', () => {
  const input = { schema: 'cssearth-moon-labels@1', moons: [moon, { id: 'unplaced', positionM: null }] };
  assert.deepEqual(parseMoonLabels(input), [moon]);
  assert.throws(() => parseMoonLabels({ ...input, schema: 'bad' }), /Invalid prepared moon labels/);
  for (const value of [NaN, '1']) assert.throws(() => parseMoonLabels({ ...input, moons: [{ ...moon, positionM: [value, 0, 0] }] }), /Invalid prepared moon coordinate/);
  for (const change of [{ positionM: [0, 0] }, { parentDistanceM: 0 }]) assert.throws(() => parseMoonLabels({ ...input, moons: [{ ...moon, ...change }] }), /Invalid prepared moon position/);
  assert.throws(() => parseMoonLabels({ ...input, moons: [moon, moon] }), /Duplicate/);
});
test('projection reports demand for unmeasured visible captions and excludes absent, occluded and offscreen parents', () => {
  const parents = new Map([['planet', parent]]); const points = new Map<number, { x: number; y: number }>(); const demand = new Set<number>();
  assert.deepEqual(projectMoonLabels([moon], [0], parents, parent, world, viewport, [], undefined, undefined, points, demand), []);
  assert.deepEqual([...demand], [0]);
  assert.deepEqual(points.get(0), { x: 100, y: -9 });
  assert.deepEqual(projectMoonLabels([moon], [20], parents, parent, world, viewport, []), [{ index: 0, x: 90, y: -9, opacity: .4 }]);
  for (const candidate of [{ ...moon, parentId: 'other' }, { ...moon, positionM: [0, 0, 2000] }, { ...moon, positionM: [0, 0, 0] }, { ...moon, positionM: [1e6, 0, 0] }, { ...moon, parentDistanceM: 1 }]) assert.deepEqual(projectMoonLabels([candidate], [20], parents, parent, world, viewport, []), []);
  assert.deepEqual(projectMoonLabels([moon], [20], new Map(), parent, world, viewport, []), []);
});
test('mounted captions wait for measurement, move while coasting, fade on incompatible frames and release ownership', t => {
  const { document, window } = parseHTML('<html><body><main></main></body></html>'); const host = document.querySelector<HTMLElement>('main')!;
  let resize = (_entries: { target: Element; contentRect: { width: number } }[]) => {}; let disconnected = false;
  const observed: Element[] = []; const frames: FrameRequestCallback[] = []; let now = 0, publication = 0;
  const Observer = class { constructor(callback: typeof resize) { resize = callback; } observe(element: Element) { observed.push(element); } disconnect() { disconnected = true; } };
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: Observer }); t.after(() => Reflect.deleteProperty(globalThis, 'ResizeObserver'));
  Object.assign(window, { requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return frames.length; }, cancelAnimationFrame() {}, performance: { now: () => now } });
  const labels = mountCatalogueMoonLabels(host, () => [parent], parent, undefined, () => { publication++; return true; }, 7);
  const budget = () => createLabelBudget(800, 600, [], []);
  labels.publish(world, viewport, budget());
  assert.equal(observed.length, 1);
  assert.equal(host.querySelectorAll('span').length, 1);
  const label = host.querySelector<HTMLElement>('span')!;
  assert.equal(label.textContent, 'Moon A');
  assert.equal(label.getAttribute('aria-disabled'), 'true');
  assert.equal(host.firstElementChild?.getAttribute('style'), 'z-index:7');
  resize([{ target: document.body, contentRect: { width: 10 } }, { target: label, contentRect: { width: 0 } }]);
  assert.equal(publication, 0);
  resize([{ target: label, contentRect: { width: 20 } }]);
  assert.equal(publication, 1);
  resize([{ target: label, contentRect: { width: 0 } }]);
  assert.equal(publication, 1);
  resize([{ target: label, contentRect: { width: 20 } }]);
  assert.equal(publication, 1);
  labels.selectObject('missing'); labels.publish(world, viewport, budget()); now = 250; frames.shift()!(250);
  assert.equal(label.style.opacity, '0.4');
  assert.equal(label.style.transform, 'translate(90px,-9px)');
  assert.equal(label.ariaHidden, 'false');
  labels.setCoasting(true); labels.publish({ ...world, pose: { ...world.pose, positionM: [10, 0, 1000] } }, viewport, budget());
  assert.equal(label.style.transform, 'translate(80px,-9px)');
  assert.equal(host.querySelector('span') === label, true);
  assert.equal(label.style.opacity, '0.4');
  labels.setCoasting(false); labels.publish({ ...world, referenceFrame: 'different' }, viewport, budget()); now = 500; frames.shift()!(500);
  assert.equal(label.ariaHidden, 'true');
  assert.equal(label.style.opacity, '0');
   labels.destroy();
  assert.equal(disconnected, true);
  assert.equal(host.children.length, 0);
});

test('the selected orbiting body occludes captions independently of their parent', () => {
  const parents = new Map([['planet', parent]]);
  const selected = { id: 'other-moon', positionM: [50, 0, 500], radiusM: 10, orbit: { centerBodyId: 'planet' } };
  assert.deepEqual(projectMoonLabels([moon], [20], parents, selected, world, viewport, []), []);
  const clear = { ...selected, positionM: [0, 100, 500] };
  assert.deepEqual(projectMoonLabels([moon], [20], parents, clear, world, viewport, []), [{ index: 0, x: 90, y: -9, opacity: .4 }]);
});
test('caption admission requires opacity above .55, while shown captions retire at .5', () => {
  const parents = new Map([['planet', parent]]);
  const project = (extent: number, previous: ReadonlySet<number>) => projectMoonLabels([{ ...moon, parentDistanceM: extent }], [20], parents, parent, world, viewport, [], undefined, previous);
  const onExtent = 12 + 36 * (.5 + Math.sin(Math.asin(.1) / 3));
  assert.deepEqual(project(onExtent - 1e-9, new Set()), []);
  const on = project(onExtent + 1e-9, new Set());
  assert.equal(on.length, 1);
  assert.equal(on[0].index, 0);
  assert.equal(on[0].x, 90);
  assert.equal(on[0].y, -9);
  assert.ok(Math.abs(on[0].opacity - .22) < 1e-10);
  assert.deepEqual(project(30, new Set([0])), []);
  assert.deepEqual(project(30 - 1e-9, new Set([0])), []);
  const staying = project(31.2, new Set([0]));
  assert.deepEqual(staying, [{ index: 0, x: 90, y: -9, opacity: .21997037037037037 }]);
  assert.deepEqual(project(31.2, new Set()), []);
});

test('eye-plane points are rejected before recording any projected coordinates', () => {
  const points = new Map<number, { x: number; y: number }>();
  assert.deepEqual(projectMoonLabels([{ ...moon, positionM: [100, 0, 1000] }], [20], new Map([['planet', parent]]), parent, world, viewport, [], undefined, undefined, points), []);
  assert.deepEqual([...points], []);
});
test('captions touching the left viewport edge remain admitted', () => {
  assert.deepEqual(projectMoonLabels([{ ...moon, positionM: [-390, 0, 0] }], [20], new Map([['planet', parent]]), parent, world, viewport, []), [
    { index: 0, x: -400, y: -9, opacity: .4 },
  ]);
});
test('equal-distance moons use id ordering and send negative distances to admission', () => {
  const moons = [
    { ...moon, id: 'z', positionM: [100, 0, 0], parentDistanceM: 100 },
    { ...moon, id: 'a', positionM: [200, 0, 0], parentDistanceM: 100 },
    { ...moon, id: 'near', positionM: [300, 0, 0], parentDistanceM: 80 },
  ];
  assert.deepEqual(projectMoonLabels(moons, [20, 20, 20], new Map([['planet', parent]]), parent, world, viewport, []).map(item => item.index), [2, 1, 0]);
  assert.deepEqual(candidates.map(item => [item.id, item.priority]), [['near', -80], ['a', -100], ['z', -100]]);
});
