import { createHash } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import { parseObjectDescriptor, prepareObject } from '@cssearth/objects';
import { createPreparedVolumeLenses, loadPreparedVolumeLenses, validatePreparedVolumeLenses,
  volumeLensCompositeOpacity } from './prepared-volume-lenses.js';
import type { PreparedVolumeLenses } from './prepared-volume-lenses.js';
import type { PreparedCssVolume, VolumeCameraPublication, VolumeVector } from './types.js';
import { mountPreparedCataloguePoints, validatePreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import type { PreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import { prepareObjectResources } from '../runtime/prepared-resource-lease.js';
import { createPreparedResidency } from '../rendering/prepared-residency.js';
import { cloudCompositeOpacity } from '../../../../labs/nebula/src/viewer/cloud-inspection.js';

class FakeElement {
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = ''; hidden = false; clientWidth = 400; clientHeight = 300;
  readonly ownerDocument: FakeDocument;
  constructor(ownerDocument: FakeDocument) { this.ownerDocument = ownerDocument;
    Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } });
  }
  append(child: FakeElement): void { this.insertBefore(child, null); }
  insertBefore(child: FakeElement, before: FakeElement | null): void {
    if (before && before.parentNode !== this) throw new TypeError('Invalid insertion point');
    child.remove(); child.parentNode = this;
    this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child);
  }
  remove(): void { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
}
class FakeDocument {
  count = 0;
  createElement(): FakeElement { this.count++; return new FakeElement(this); }
}
const frame = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0] as const,
  localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const points = (): PreparedCataloguePoints => ({ frame, points: [
  { id: 'catalogue:a', positionUnits: [-1, 1, 0], sizePx: 2, colorCss: '#ffeecc', opacity: .7 },
  { id: 'catalogue:behind', positionUnits: [0, 0, 20], sizePx: 2, colorCss: '#ffffff', opacity: 1 },
  { id: 'catalogue:removed', positionUnits: [0, 0, 0], sizePx: 2, colorCss: '#ffffff', opacity: 0 },
] });
const volume = (id: string): PreparedCssVolume => ({ schema: 'cssearth-css-volume@1', id, frame, anchors: [],
  stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
    texturePath: `${id}/${axis}.webp`, widthPx: 1, heightPx: 1,
    style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
      backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
  resources: ['x', 'y', 'z'].map(axis => ({ path: `${id}/${axis}.webp`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
  provenance: {}, approximation: {},
});
const payload = (): PreparedVolumeLenses => ({ schema: 'cssearth-volume-lenses@1', id: 'fixture', defaultLens: 'first', framingRadiusUnits: 1,
  lenses: ['first', 'second', 'third'].map(id => ({ id, label: id, title: `${id} dataset`, description: 'Prepared observation',
    sourceUrl: 'https://example.org/source', volume: volume(id), brightness: { overall: .8, x: .2, y: .5, z: .9 }, stars: points() })),
});
function publication(distance = 4, direction: VolumeVector = [0, 0, 1]): VolumeCameraPublication {
  const length = Math.hypot(...direction), [x, y, z] = direction.map(value => value / length);
  const quaternion: readonly [number, number, number, number] = z < -.999999999 ? [0, 1, 0, 0] :
    [-y / Math.sqrt(2 * (1 + z)), x / Math.sqrt(2 * (1 + z)), 0, Math.sqrt((1 + z) / 2)];
  return { world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, distance], orientationXyzw: quaternion } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 } };
}
function dom() {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.append(before);
  return { document, host, before, options: { host: host as unknown as HTMLElement, before: before as unknown as Element } };
}
const descendants = (root: FakeElement): FakeElement[] => [root, ...root.children.flatMap(descendants)];
afterEach(() => vi.unstubAllGlobals());

test('catalogue points project prepared positions, cull hidden support and keep nodes when presentation changes', () => {
  const f = dom(), initial = points();
  const mount = mountPreparedCataloguePoints({ ...f.options, payload: initial });
  const root = mount.root as unknown as FakeElement, nodes = [...root.children];
  mount.publish(publication(10));
  expect(nodes[0].style.transform).toBe('translate(-11px,9px)');
  expect(nodes.map(node => node.style.visibility)).toEqual(['visible', 'hidden', 'hidden']);
  expect(root.dataset.visiblePoints).toBe('1');
  const changed = { ...initial, points: initial.points.map(point => ({ ...point, sizePx: 4, opacity: .3 })).reverse() };
  mount.setPresentation(changed);
  expect(root.children).toEqual(nodes); expect(nodes[0].style.transform).toBe('translate(-12px,8px)');
  expect(nodes[0].style.opacity).toBe('0.3'); expect(nodes[0].style.width).toBe('4px');
  expect(root.dataset.visiblePoints).toBe('2');
  const moved = { ...changed, points: changed.points.map(point => ({ ...point, positionUnits: [1, 1, 1] as VolumeVector })) };
  expect(() => mount.setPresentation(moved)).toThrow('same prepared point geometry');
  expect(nodes[0].style.transform).toBe('translate(-12px,8px)');
  expect(() => mount.publish({ ...publication(), world: { ...publication().world, epochJdTt: 124 } })).toThrow('frame and epoch');
  mount.destroy(); mount.destroy(); expect(f.host.children).toEqual([f.before]);
});

test('malformed point payloads and lens-specific catalogue geometry are rejected before mounting', () => {
  const p = points();
  for (const altered of [{ ...p, points: [p.points[0], p.points[0]] },
    { ...p, points: [{ ...p.points[0], sizePx: NaN }] }, { ...p, points: [{ ...p.points[0], opacity: 1.1 }] },
    { ...p, points: [{ ...p.points[0], colorCss: 'url(unsafe)' }] }]) expect(() => validatePreparedCataloguePoints(altered)).toThrow();
  const data = payload(), second = data.lenses[1];
  const moved = { ...second.stars, points: second.stars.points.map(point => ({ ...point, positionUnits: [1, 2, 3] as VolumeVector })) };
  expect(() => validatePreparedVolumeLenses({ ...data, lenses: [data.lenses[0], { ...second, stars: moved }] })).toThrow('same catalogue geometry');
  expect(() => validatePreparedVolumeLenses({ ...data, defaultLens: 'absent' })).toThrow('default');
  expect(() => validatePreparedVolumeLenses({ ...data, lenses: [data.lenses[0], data.lenses[0]] })).toThrow('content');
  expect(() => validatePreparedVolumeLenses({ ...data, pointVisibility: { hiddenBelowRadiusPixels: 24, fullAboveRadiusPixels: 2 } })).toThrow('thresholds');
  expect(() => validatePreparedVolumeLenses({ ...data, lenses: [{ ...data.lenses[0], brightness: { overall: 2, x: 1, y: 1, z: 1 } }] })).toThrow('brightness');
});

test('switching selects one retained cloud, keeps one catalogue and never resolves another asset', () => {
  const f = dom(), data = payload();
  const prepared = createPreparedVolumeLenses({ payload: data, resolveResource: vi.fn(path => `/prepared/${path}`) });
  const runtime = prepared.mount(f.options), root = runtime.root as unknown as FakeElement;
  const initial = descendants(root), cloudRoots = root.children.filter(node => node.className === 'prepared-volume-lens-cloud');
  const catalogue = root.children.find(node => node.className === 'prepared-catalogue-points')!;
  const pointsBefore = [...catalogue.children], leaves = initial.filter(node => node.style.backgroundImage);
  const textures = leaves.map(node => node.style.backgroundImage), geometry = leaves.map(node => node.style.transform);
  runtime.publish(publication());
  for (const id of ['second', 'third', 'first']) {
    runtime.selectLens(id);
    expect(cloudRoots.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeLens)).toEqual([id]);
    expect(runtime.state().id).toBe(id); expect(root.dataset.selectedLens).toBe(id);
    expect(descendants(root)).toEqual(initial); expect(catalogue.children).toEqual(pointsBefore);
    expect(leaves.map(node => node.style.backgroundImage)).toEqual(textures);
    expect(leaves.map(node => node.style.transform)).toEqual(geometry);
  }
  expect(() => runtime.selectLens('missing')).toThrow('Unknown'); expect(runtime.state().id).toBe('first');
  expect(initial.filter(node => node.className === 'css-volume-projection').every(node => node.style.background === 'transparent')).toBe(true);
  expect(cloudRoots.every(node => !node.style.background)).toBe(true);
  expect(initial.filter(node => ['css-volume-camera', 'css-volume-scene', 'css-volume-mesh'].includes(node.className))
    .every(node => node.style.opacity === undefined)).toBe(true);
  runtime.destroy(); runtime.publish(publication()); runtime.selectLens('third');
  expect(f.host.children).toEqual([f.before]);
});

test('axis brightness matches the lab completed-image oracle through handoffs and stays outside cloud geometry', () => {
  const f = dom(), data = payload(), runtime = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  const surface = root.children.find(node => node.dataset.volumeLens === 'first')!;
  const axes = surface.children.filter(node => node.className === 'css-volume-projection');
  for (let degrees = 0; degrees <= 180; degrees += 3) {
    const angle = degrees * Math.PI / 180;
    runtime.publish(publication(4, [Math.sin(angle), Math.sin(angle) / 2, Math.cos(angle)]));
    const banks = axes.map((node, index) => ({ axis: (['x', 'y', 'z'] as const)[index], opacity: Number(node.style.opacity), visible: node.style.visibility !== 'hidden' }));
    const expected = cloudCompositeOpacity(banks, data.lenses[0].brightness);
    expect(Number(surface.style.opacity)).toBeCloseTo(expected, 12);
    expect(volumeLensCompositeOpacity(banks, data.lenses[0].brightness)).toBeCloseTo(expected, 12);
  }
  runtime.destroy();
});

test('unresolved catalogue points fade away without changing prepared resolved size or exposure', () => {
  const f = dom(), runtime = createPreparedVolumeLenses({ payload: payload(), resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement, stars = root.children.find(node => node.className === 'prepared-catalogue-points')!;
  runtime.publish(publication(4)); // 25 px radius: fully resolved using default policy.
  expect(stars.style.opacity).toBe('1'); expect(stars.style.display).toBe('block');
  const material = stars.children.map(node => [node.style.width, node.style.opacity]);
  runtime.publish(publication(10)); // 10 px: smooth transition.
  expect(Number(stars.style.opacity)).toBeGreaterThan(0); expect(Number(stars.style.opacity)).toBeLessThan(1);
  runtime.publish(publication(100)); // 1 px: do not merge the fixed catalogue into an artificial bright dot.
  expect(stars.style.opacity).toBe('0'); expect(stars.style.display).toBe('none');
  expect(stars.children.map(node => [node.style.width, node.style.opacity])).toEqual(material);
  runtime.publish(publication(4)); expect(stars.style.opacity).toBe('1'); expect(stars.style.display).toBe('block');
  runtime.destroy();
});

test('saved star visibility stays toggleable with retained points and committed lens subscriptions', () => {
  const f = dom(), prepared = createPreparedVolumeLenses({ payload: { ...payload(), starsEnabled: false }, resolveResource: path => `/prepared/${path}` });
  const runtime = prepared.mount(f.options), root = runtime.root as unknown as FakeElement;
  const stars = root.children.find(node => node.className === 'prepared-catalogue-points')!, nodes = [...stars.children];
  const notify = vi.fn(), unsubscribe = runtime.subscribe(notify);
  expect(runtime.state().defaultLens).toBe('first');
  runtime.publish(publication(4)); expect(stars.style.display).toBe('none'); expect(runtime.state().starsVisible).toBe(false);
  runtime.setStarsVisible(true); expect(stars.style.display).toBe('block'); expect(runtime.state().starsVisible).toBe(true);
  expect(stars.children).toEqual(nodes); expect(nodes[0].style.opacity).toBe('0.7');
  runtime.selectLens('second');
  expect(notify.mock.calls.map(([state]) => [state.selectedLens, state.starsVisible])).toEqual([['first', true], ['second', true]]);
  expect(runtime.state().lenses.map(lens => lens.label)).toEqual(['first', 'second', 'third']);
  runtime.setStarsVisible(true); expect(notify).toHaveBeenCalledTimes(2);
  runtime.publish(publication(100)); runtime.setStarsVisible(false); runtime.setStarsVisible(true);
  expect(stars.style.display).toBe('none'); // Toggle cannot defeat the unresolved-point fade.
  unsubscribe(); const count = notify.mock.calls.length; runtime.selectLens('third'); expect(notify).toHaveBeenCalledTimes(count);
  runtime.destroy(); runtime.setStarsVisible(false); expect(notify).toHaveBeenCalledTimes(count);
});

test('the complete fixed lens resource bank participates in asynchronous resource readiness', async () => {
  const resolve = vi.fn((path: string) => `/prepared/${path}`);
  const prepared = createPreparedVolumeLenses({ payload: payload(), resolveResource: resolve });
  const decodes = new Map<string, () => void>();
  const createResources: typeof createPreparedResidency = options => createPreparedResidency({ ...options,
    createImage: () => ({ src: '', decoding: 'async', naturalWidth: 1, naturalHeight: 1,
      decode() { return new Promise<void>(done => decodes.set(this.src, done)); } }),
  });
  const lease = prepareObjectResources(prepared.assets, { createResources });
  let ready = false; void lease.ready.then(() => { ready = true; });
  expect(prepared.assets.startup).toHaveLength(9); expect(resolve).toHaveBeenCalledTimes(9);
  expect(prepared.assets.pools[0]).toMatchObject({ retention: 'mount', capacity: 9 });
  await vi.waitFor(() => expect(decodes.size).toBe(4)); expect(ready).toBe(false);
  const resolved = new Set<string>();
  while (resolved.size < 9) {
    await vi.waitFor(() => expect(decodes.size).toBeGreaterThan(resolved.size));
    for (const [url, finish] of decodes) if (!resolved.has(url)) { resolved.add(url); finish(); }
  }
  await lease.ready; expect(ready).toBe(true);
  const f = dom(), runtime = prepared.mount(f.options);
  runtime.publish(publication()); runtime.selectLens('third');
  expect(resolve).toHaveBeenCalledTimes(9); expect(decodes.size).toBe(9);
  runtime.destroy(); lease.destroy();
});

async function transportFixture(data = payload()) {
  const descriptor = parseObjectDescriptor({ schema: 'cssearth-object@1', id: data.id, type: 'volume-lens-bank',
    properties: { frame, preparation: { source: 'source/lenses.json', sha256: 'b'.repeat(64) } } });
  const wrapped = await prepareObject(descriptor, { type: descriptor.type, format: 'cssearth-volume-lenses@1', parse: value => value, bake: () => data }, {});
  const bytes = new TextEncoder().encode(JSON.stringify(wrapped)).buffer;
  return { bytes, descriptor: { ...descriptor, prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json',
    sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex') } } };
}
test('generic descriptor loader verifies pinned bytes, wrapper identity and all volume frames', async () => {
  const f = await transportFixture(), read = vi.fn(async () => f.bytes);
  const loaded = await loadPreparedVolumeLenses(f.descriptor, { read });
  expect(loaded.id).toBe('fixture'); expect(loaded.lenses).toHaveLength(3);
  expect(read).toHaveBeenCalledExactlyOnceWith('prepared/lenses.json');
  const stale = new TextEncoder().encode(new TextDecoder().decode(f.bytes) + '\n').buffer;
  await expect(loadPreparedVolumeLenses(f.descriptor, { read: async () => stale })).rejects.toThrow('SHA-256');
  const drift = { ...f.descriptor, properties: { ...f.descriptor.properties, frame: { ...frame, originM: [1, 0, 0] } } };
  await expect(loadPreparedVolumeLenses(drift, { read })).rejects.toThrow('identity/frame');
  await expect(loadPreparedVolumeLenses({ ...f.descriptor, id: 'different' }, { read })).rejects.toThrow('identity');
});
