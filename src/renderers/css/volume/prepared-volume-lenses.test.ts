import { afterEach, expect, test, vi } from 'vitest';
import { parseObjectDescriptor, prepareObject } from '@cssearth/objects';
import { createPreparedVolumeLenses, loadPreparedVolumeLenses, validatePreparedVolumeLenses,
  volumeLensCompositeOpacity } from './prepared-volume-lenses.js';
import { mountPreparedVolumeLod, samePreparedVolumeTopology } from './prepared-volume-lod.js';
import type { PreparedVolumeLenses } from './prepared-volume-lenses.js';
import type { PreparedCssVolume, VolumeCameraPublication, VolumeVector } from './types.js';
import { mountPreparedCataloguePoints, validatePreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import type { PreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import { prepareObjectResources } from '../runtime/prepared-resource-lease.js';
import { createPreparedResidency } from '../rendering/prepared-residency.js';
import { cloudCompositeOpacity } from '@cssearth/volume-viewer/scene/cloud-inspection';
import { CSS_COMPILER_RENDER_BUDGET } from './compiler-render-budget.js';
import { createRenderElementBudget } from '@cssearth/bake/volume';

class FakeElement {
  readonly nodeType = 1;
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = ''; hidden = false; clientWidth = 400; clientHeight = 300;
  readonly ownerDocument: FakeDocument;
  readonly localName: string;
  constructor(ownerDocument: FakeDocument, localName = 'div') { this.ownerDocument = ownerDocument; this.localName = localName;
    Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } });
  }
  getAttributeNames(): string[] { return []; }
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
  querySelectorAll(_selector: string): FakeElement[] { return []; }
  createElement(tag = 'div'): FakeElement { this.count++; return new FakeElement(this, tag); }
}
const frame = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0] as const,
  localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const points = (): PreparedCataloguePoints => ({ frame, points: [
  { id: 'catalogue:a', positionUnits: [-1, 1, 0], sizePx: 2, colorCss: '#ffeecc', opacity: .7 },
  { id: 'catalogue:behind', positionUnits: [0, 0, 20], sizePx: 2, colorCss: '#ffffff', opacity: 1 },
  { id: 'catalogue:removed', positionUnits: [0, 0, 0], sizePx: 2, colorCss: '#ffffff', opacity: 0 },
] });
const volume = (id: string, atlasOffset = 0, geometryOffset = 0): PreparedCssVolume => ({ schema: 'cssearth-css-volume@1', id, frame, anchors: [],
  stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
    texturePath: `${id}/${axis}.webp`, widthPx: 1, heightPx: 1,
    style: { width: '1px', height: '1px', transform: `matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,${axis === 'x' ? geometryOffset : 0},0,0,1)`,
      backgroundSize: '3px 1px', backgroundPosition: `${atlasOffset}px 0px` } }] })),
  resources: ['x', 'y', 'z'].map(axis => ({ path: `${id}/${axis}.webp`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
  provenance: {}, approximation: {},
});
const payload = (): PreparedVolumeLenses => ({ schema: 'cssearth-volume-lenses@1', id: 'fixture', defaultLens: 'first', framingRadiusUnits: 1,
  lenses: ['first', 'second', 'third'].map((id, index) => ({ id, label: id, title: `${id} dataset`, description: 'Prepared observation',
    sourceUrl: 'https://example.org/source', volume: volume(id, -index), brightness: { overall: .8, x: .2, y: .5, z: .9 }, stars: points() })),
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

/** A complete retained topology, including the 26 camera directions used by app preparation. */
function budgetPayload(slabCount: number, starCount: number): PreparedVolumeLenses {
  const normalize = (v: VolumeVector): VolumeVector => {
    const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length];
  };
  const cross = (a: VolumeVector, b: VolumeVector): VolumeVector =>
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const directions: { id: string; back: VolumeVector; right: VolumeVector; down: VolumeVector }[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (!x && !y && !z) continue;
    const back = normalize([x, y, z]), right = normalize(cross(Math.abs(back[1]) > .99 ? [0, 0, 1] : [0, 1, 0], back));
    directions.push({ id: `view-${directions.length}`, back, right, down: cross(right, back) });
  }
  const original = payload();
  return { ...original, starsEnabled: false, lenses: original.lenses.map(lens => {
    const source = lens.volume;
    const views = directions.map(view => ({ ...view, texturePath: `${lens.id}/${view.id}.png` }));
    return { ...lens, stars: { frame, points: points().points.slice(0, starCount) }, volume: { ...source,
      stacks: source.stacks.map((stack, axis) => ({ ...stack,
        leaves: Array.from({ length: Math.floor(slabCount / 3) + (axis < slabCount % 3 ? 1 : 0) }, (_, index) =>
          ({ ...stack.leaves[0]!, id: `${stack.axis}-${index}` })) })),
      impostors: { schema: 'cssearth-volume-impostors@1', radiusUnits: 1,
        fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32, views },
      resources: [...source.resources, ...views.map(view => ({ path: view.texturePath, sha256: 'b'.repeat(64), bytes: 1, width: 1, height: 1 }))],
    } };
  }) };
}

test.each([[151, 0], [150, 3]])('the compiler DOM quota includes every retained XYZ copy, star and impostor (%i slabs, %i stars)', (slabCount, starCount) => {
  const f = dom(), data = budgetPayload(slabCount, starCount);
  const runtime = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  // Mounted distant, the bank holds its impostors and stars only; the slice leaves wait for the first close publication.
  const mounted = descendants(root);
  expect(mounted.filter(node => node.parentNode?.className === 'css-volume-mesh')).toHaveLength(0);
  expect(mounted.filter(node => node.dataset.volumeImpostor !== undefined).length).toBe(26);
  runtime.setStarsVisible(true); runtime.publish(publication(4));
  const initial = descendants(root);
  const predicted = createRenderElementBudget(CSS_COMPILER_RENDER_BUDGET, starCount, slabCount).totalElements;
  expect(data.lenses[0]!.volume.stacks.map(stack => stack.leaves.length).reduce((a, b) => a + b, 0)).toBe(slabCount);
  expect(initial.filter(node => node.parentNode?.className === 'css-volume-mesh').length).toBe(slabCount * 3);
  expect(initial.filter(node => node.dataset.volumeImpostor !== undefined).length).toBe(26);
  expect(initial.filter(node => node.dataset.catalogueSource !== undefined).length).toBe(starCount);
  expect(initial.length).toBe(499); // Includes the bank root, markers, empty star wrapper and hidden nodes.
  expect(initial.length - slabCount * 3 - starCount).toBe(46);
  expect(predicted).toBe(CSS_COMPILER_RENDER_BUDGET.maximumElements);
  expect(initial.length).toBeLessThanOrEqual(predicted);
  expect(Number(root.dataset.volumeResidentDomNodes)).toBe(initial.length);
  for (const id of ['second', 'third', 'first']) for (const distance of [4, 100]) {
    runtime.selectLens(id);
    for (const direction of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1], [1, 1, .4], [0, 0, -1]] as const) {
      runtime.publish(publication(distance, direction));
      runtime.setStarsVisible(true); runtime.setStarsVisible(false);
      const current = descendants(root);
      expect(current.length).toBeLessThanOrEqual(CSS_COMPILER_RENDER_BUDGET.maximumElements);
      expect(current.every((node, index) => node === initial[index])).toBe(true);
      expect(current.length).toBe(initial.length);
      expect(root.dataset.volumeResidentTopologyCount).toBe('1');
    }
  }
  expect(initial.some(node => node.style.display === 'none' || node.style.visibility === 'hidden' || node.hidden)).toBe(true);
  runtime.destroy(); expect(f.host.children).toEqual([f.before]);
});

test('catalogue points project prepared positions, cull hidden support and keep nodes when presentation changes', () => {
  const f = dom(), initial = points();
  const mount = mountPreparedCataloguePoints({ ...f.options, payload: initial });
  const root = mount.root as unknown as FakeElement, nodes = [...root.children];
  mount.publish(publication(10));
  expect(nodes[0].style.transform).toBe('translate(-11px,-11px)');
  expect(nodes.map(node => node.style.visibility)).toEqual(['visible', 'hidden', 'hidden']);
  expect(root.dataset.visiblePoints).toBe('1');
  const changed = { ...initial, points: initial.points.map(point => ({ ...point, sizePx: 4, opacity: .3 })).reverse() };
  mount.setPresentation(changed);
  expect(root.children).toEqual(nodes); expect(nodes[0].style.transform).toBe('translate(-12px,-12px)');
  expect(nodes[0].style.opacity).toBe('0.3'); expect(nodes[0].style.width).toBe('4px');
  expect(root.dataset.visiblePoints).toBe('2');
  const moved = { ...changed, points: changed.points.map(point => ({ ...point, positionUnits: [1, 1, 1] as VolumeVector })) };
  expect(() => mount.setPresentation(moved)).toThrow('same prepared point geometry');
  expect(nodes[0].style.transform).toBe('translate(-12px,-12px)');
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

test('same-topology lenses reuse one retained cloud and replace all selected material', () => {
  const f = dom(), data = payload();
  const prepared = createPreparedVolumeLenses({ payload: data, resolveResource: vi.fn(path => `/prepared/${path}`) });
  const runtime = prepared.mount(f.options), root = runtime.root as unknown as FakeElement;
  runtime.publish(publication());
  const initial = descendants(root), cloudRoots = root.children.filter(node => node.className === 'prepared-volume-lens-cloud');
  const catalogue = root.children.find(node => node.className === 'prepared-catalogue-points')!;
  const pointsBefore = [...catalogue.children], leaves = initial.filter(node => node.style.backgroundImage);
  expect(cloudRoots).toHaveLength(1); expect(leaves).toHaveLength(3);
  expect(root.dataset).toMatchObject({ volumeLensCount: '3', volumeTopologyCount: '1', volumeResidentTopologyCount: '1' });
  const geometry = leaves.map(node => node.style.transform);
  for (const id of ['second', 'third', 'first']) {
    runtime.selectLens(id);
    expect(cloudRoots.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeLens)).toEqual([id]);
    expect(runtime.state().id).toBe(id); expect(root.dataset.selectedLens).toBe(id);
    const current = descendants(root);
    expect(current.length).toBe(initial.length); expect(current.every((node, index) => node === initial[index])).toBe(true);
    expect(catalogue.children.length).toBe(pointsBefore.length);
    expect(catalogue.children.every((node, index) => node === pointsBefore[index])).toBe(true);
    expect([...new Set(leaves.map(node => node.style.backgroundImage))]).toEqual([`url("/prepared/${id}/z.webp")`]);
    expect([...new Set(initial.filter(node => node.localName === 's' && node.style.backgroundSize).map(node => node.style.backgroundPosition))])
      .toEqual([`${id === 'first' ? 0 : id === 'second' ? -1 : -2}px 0px`]);
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

test('a distinct topology is allocated only on first selection and then retained hidden', () => {
  const base = payload(), second = base.lenses[1]!;
  const data = { ...base, lenses: [base.lenses[0]!, { ...second, volume: volume(second.id, -1, 1) }, base.lenses[2]!] };
  const f = dom(), runtime = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  runtime.publish(publication());
  expect(root.children.filter(node => node.className === 'prepared-volume-lens-cloud')).toHaveLength(1);
  expect(root.dataset).toMatchObject({ volumeTopologyCount: '2', volumeResidentTopologyCount: '1' });
  expect(descendants(root)).toHaveLength(29); // Three shared stars and one three-slab topology, all optical copies retained.
  runtime.selectLens('second');
  const families = root.children.filter(node => node.className === 'prepared-volume-lens-cloud');
  expect(families).toHaveLength(2); expect(root.dataset.volumeResidentTopologyCount).toBe('2');
  expect(descendants(root)).toHaveLength(52); // A second topology costs its wrappers and leaves even when hidden.
  expect(root.dataset.volumeResidentDomNodes).toBe('52');
  expect(families.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeLens)).toEqual(['second']);
  runtime.selectLens('third');
  expect(root.children.filter(node => node.className === 'prepared-volume-lens-cloud')).toEqual(families);
  expect(families.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeLens)).toEqual(['third']);
  expect(descendants(root)).toHaveLength(52);
  runtime.destroy();
});

test('axis brightness matches the lab completed-image oracle through handoffs and stays outside cloud geometry', () => {
  const f = dom(), data = payload(), runtime = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  const surface = root.children.find(node => node.dataset.volumeLens === 'first')!;
  expect(surface.children.filter(node => node.className === 'css-volume-projection')).toHaveLength(0);
  runtime.publish(publication(4));
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
  const root = runtime.root as unknown as FakeElement;
  runtime.publish(publication(4)); // 25 px radius: fully resolved using default policy.
  const stars = root.children.find(node => node.className === 'prepared-catalogue-points')!;
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

test('distant prepared images suspend the retained slice renderer and hand off by projected size', () => {
  const f = dom(), original = payload(), lens = original.lenses[0]!;
  const directions = [
    { id: 'front', back: [0, 0, 1] as const, right: [1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'back', back: [0, 0, -1] as const, right: [-1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'right', back: [1, 0, 0] as const, right: [0, 0, -1] as const, down: [0, -1, 0] as const },
    { id: 'left', back: [-1, 0, 0] as const, right: [0, 0, 1] as const, down: [0, -1, 0] as const },
  ];
  const impostors = { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: 1,
    fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32,
    views: directions.map(view => ({ ...view, texturePath: `${view.id}.png` })) };
  const data = { ...original, lenses: [{ ...lens, volume: { ...lens.volume, impostors,
    resources: [...lens.volume.resources, ...impostors.views.map(view => ({ path: view.texturePath, sha256: 'b'.repeat(64), bytes: 1, width: 1, height: 1 }))] } }] };
  const runtime = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement, initial = descendants(root);
  const detail = initial.find(node => node.className === 'css-volume-detail')!;
  const distant = initial.find(node => node.className === 'css-volume-impostors')!;
  const sceneNodes = () => descendants(root).filter(node => node.className === 'css-volume-scene');
  expect(descendants(root).filter(node => node.style.backgroundImage)).toHaveLength(0);
  // While only impostors contribute, the slice renderer is not built at all.
  expect(sceneNodes().length).toBe(0);
  runtime.publish(publication(100));
  expect(descendants(root).filter(node => node.style.backgroundImage && !node.dataset.volumeImpostor)).toHaveLength(0);
  expect(detail.style.display).toBe('none'); expect(distant.style.display).toBe('block');
  expect(distant.dataset.activeViews).toBe('1');
  runtime.publish(publication(50));
  expect(sceneNodes().length).toBe(0);
  runtime.publish(publication(200 / 24));
  const scenes = sceneNodes(), built = descendants(root);
  expect(scenes).toHaveLength(3);
  expect(detail.style.display).toBe('block'); expect(distant.style.display).toBe('block');
  expect(Number(distant.style.opacity)).toBeCloseTo(.5);
  expect(Number(detail.style.opacity)).toBeCloseTo(.5 * .8 * .9);
  runtime.publish(publication(4));
  expect(distant.style.display).toBe('none'); expect(detail.style.display).toBe('block');
  const visibleTransforms = scenes.map(scene => scene.style.transform);
  runtime.publish(publication(100));
  expect(scenes.map(scene => scene.style.transform)).toEqual(visibleTransforms);
  // Once built, the slice renderer stays retained when the cloud recedes.
  expect(descendants(root)).toEqual(built);
  runtime.destroy(); expect(f.host.children).toEqual([f.before]);
});

test('saved star visibility stays toggleable with retained points and committed lens subscriptions', () => {
  const f = dom(), prepared = createPreparedVolumeLenses({ payload: { ...payload(), starsEnabled: false }, resolveResource: path => `/prepared/${path}` });
  const runtime = prepared.mount(f.options), root = runtime.root as unknown as FakeElement;
  const findStars = () => root.children.find(node => node.className === 'prepared-catalogue-points');
  const notify = vi.fn(), unsubscribe = runtime.subscribe(notify);
  expect(runtime.state().defaultLens).toBe('first');
  // Disabled points are not built at all; enabling them builds them once and they are retained from then on.
  runtime.publish(publication(4)); expect(findStars()).toBeUndefined(); expect(runtime.state().starsVisible).toBe(false);
  runtime.setStarsVisible(true);
  const stars = findStars()!, nodes = [...stars.children];
  expect(stars.style.display).toBe('block'); expect(runtime.state().starsVisible).toBe(true);
  expect(nodes[0].style.opacity).toBe('0.7');
  runtime.selectLens('second');
  expect(notify.mock.calls.map(([state]) => [state.selectedLens, state.starsVisible])).toEqual([['first', true], ['second', true]]);
  expect(runtime.state().lenses.map(lens => lens.label)).toEqual(['first', 'second', 'third']);
  runtime.setStarsVisible(true); expect(notify).toHaveBeenCalledTimes(2);
  runtime.publish(publication(100)); runtime.setStarsVisible(false); runtime.setStarsVisible(true);
  expect(stars.style.display).toBe('none'); // Toggle cannot defeat the unresolved-point fade.
  unsubscribe(); const count = notify.mock.calls.length; runtime.selectLens('third'); expect(notify).toHaveBeenCalledTimes(count);
  runtime.destroy(); runtime.setStarsVisible(false); expect(notify).toHaveBeenCalledTimes(count);
});

test('declared lens resources do not download at startup or for inactive lenses and axes', async () => {
  const prepared = createPreparedVolumeLenses({ payload: payload(), resolveResource: path => '/prepared/' + path });
  const createImage = vi.fn(() => ({ src: '', decoding: 'async' as const, naturalWidth: 1, naturalHeight: 1, decode: async () => {} }));
  const lease = prepareObjectResources(prepared.assets, {
    createResources: options => createPreparedResidency({ ...options, createImage }),
  });
  await lease.ready;
  expect(prepared.assets.entries).toHaveLength(9);
  expect(prepared.assets.startup).toEqual([]);
  expect(createImage).not.toHaveBeenCalled();
  const f = dom(), runtime = prepared.mount(f.options);
  const attached = () => [...new Set(descendants(runtime.root as unknown as FakeElement)
    .map(node => node.style.backgroundImage).filter(Boolean))];
  expect(attached()).toEqual([]);
  runtime.publish(publication());
  expect(attached()).toEqual(['url("/prepared/first/z.webp")']);
  runtime.publish(publication(100), false);
  runtime.selectLens('second');
  expect(attached()).toEqual([]);
  runtime.publish(publication());
  expect(attached()).toEqual(['url("/prepared/second/z.webp")']);
  runtime.destroy(); lease.destroy();
});

async function transportFixture(data = payload()) {
  const descriptor = parseObjectDescriptor({ schema: 'cssearth-object@1', id: data.id, type: 'volume-lens-bank',
    properties: { frame, preparation: { source: 'source/lenses.json' } } });
  const wrapped = await prepareObject(descriptor, { type: descriptor.type, format: 'cssearth-volume-lenses@1', parse: value => value, bake: () => data }, {});
  const bytes = new TextEncoder().encode(JSON.stringify(wrapped)).buffer;
  return { bytes, descriptor: { ...descriptor, prepared: { format: 'cssearth-volume-lenses@1', url: 'prepared/lenses.json' } } };
}
test('generic descriptor loader verifies wrapper identity and all volume frames', async () => {
  const f = await transportFixture(), read = vi.fn(async () => f.bytes);
  const loaded = await loadPreparedVolumeLenses(f.descriptor, { read });
  expect(loaded.id).toBe('fixture'); expect(loaded.lenses).toHaveLength(3);
  expect(read).toHaveBeenCalledExactlyOnceWith('prepared/lenses.json');
  const drift = { ...f.descriptor, properties: { ...f.descriptor.properties, frame: { ...frame, originM: [1, 0, 0] } } };
  await expect(loadPreparedVolumeLenses(drift, { read })).rejects.toThrow('identity/frame');
  await expect(loadPreparedVolumeLenses({ ...f.descriptor, id: 'different' }, { read })).rejects.toThrow('identity');
});

test('angular compact-light footprints zoom and change lens material without changing their positions or nodes', () => {
  const f = dom(), initial = points();
  const angular = { ...initial, points: initial.points.map(point => ({ ...point, diameterUnits: .2 })) };
  const mount = mountPreparedCataloguePoints({ ...f.options, payload: angular });
  const root = mount.root as unknown as FakeElement, nodes = [...root.children];
  mount.publish(publication(10)); expect(nodes[0].style.width).toBe('2px');
  mount.publish(publication(5)); expect(nodes[0].style.width).toBe('4px');
  const center = nodes[0].style.transform;
  mount.setPresentation({ ...angular, points: angular.points.map(point => ({ ...point, colorCss: '#ff1100', opacity: .1 })) });
  expect(root.children).toEqual(nodes); expect(nodes[0].style.transform).toBe(center);
  expect(nodes[0].style.background).toBe('#ff1100'); expect(nodes[0].style.opacity).toBe('0.1');
  expect(() => validatePreparedCataloguePoints({ ...angular, points: [{ ...angular.points[0], diameterUnits: NaN }] })).toThrow();
  mount.destroy();
});

test('nearby volume visibility is explicit and rejects unknown policies', () => {
  expect(validatePreparedVolumeLenses({ ...payload(), contextVisibility: 'independent' }).contextVisibility).toBe('independent');
  expect(validatePreparedVolumeLenses(payload()).contextVisibility).toBe('galactic');
  expect(() => validatePreparedVolumeLenses({ ...payload(), contextVisibility: 'maybe' })).toThrow();
});

test('native mounts build every node at mount, as the server-rendered DOM they adopt was built', () => {
  const lazy = dom(), eager = dom(), data = { ...budgetPayload(30, 3), starsEnabled: true };
  const bank = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` });
  const lazyRoot = bank.mount(lazy.options).root as unknown as FakeElement;
  const eagerRoot = bank.mount({ ...eager.options, nativeFocalCss: '1000px' }).root as unknown as FakeElement;
  const count = (root: FakeElement, test: (node: FakeElement) => boolean) => descendants(root).filter(test).length;
  const leaves = (node: FakeElement) => node.parentNode?.className === 'css-volume-mesh', points = (node: FakeElement) => node.dataset.catalogueSource !== undefined;
  expect([count(lazyRoot, leaves), count(lazyRoot, points)]).toEqual([0, 0]);
  expect([count(eagerRoot, leaves), count(eagerRoot, points)]).toEqual([90, 3]);
  expect(count(eagerRoot, node => node.dataset.volumeImpostor !== undefined)).toBe(26);
});

test('a phone hands an impostor-sized cloud to its billboards instead of fading a live slice volume', () => {
  const f = dom(), original = payload(), lens = original.lenses[0]!;
  const directions = [
    { id: 'front', back: [0, 0, 1] as const, right: [1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'back', back: [0, 0, -1] as const, right: [-1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'right', back: [1, 0, 0] as const, right: [0, 0, -1] as const, down: [0, -1, 0] as const },
    { id: 'left', back: [-1, 0, 0] as const, right: [0, 0, 1] as const, down: [0, -1, 0] as const },
  ];
  const impostors = { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: 1,
    fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32,
    views: directions.map(view => ({ ...view, texturePath: `${view.id}.png` })) };
  const data = { ...original, lenses: [{ ...lens, volume: { ...lens.volume, impostors,
    resources: [...lens.volume.resources, ...impostors.views.map(view => ({ path: view.texturePath, sha256: 'b'.repeat(64), bytes: 1, width: 1, height: 1 }))] } }] };
  // A responsive mount resolves its focal length in CSS. The fade reads the same resolved length, so the runtime can
  // tell an invisible presentation from a contributing one instead of keeping both displayed.
  const runtime = createPreparedVolumeLenses({ payload: data, resolveResource: path => `/prepared/${path}` })
    .mount({ ...f.options, nativeFocalCss: '1000px' });
  const reads: string[] = [];
  Object.defineProperty(f.document, 'defaultView', { configurable: true, value: {
    CSS: { registerProperty: () => {} },
    getComputedStyle: (element: FakeElement) => { reads.push(element.localName);
      return { getPropertyValue: (name: string) => element.style[name] ?? '' }; },
  } });
  const root = runtime.root as unknown as FakeElement, initial = descendants(root);
  const detail = initial.find(node => node.className === 'css-volume-detail')!;
  const distant = initial.find(node => node.className === 'css-volume-impostors')!;
  const sceneNodes = () => descendants(root).filter(node => node.className === 'css-volume-scene');

  // 1000px focal over a 100px prepared focal: at this distance the cloud covers 5 resolved pixels, below the
  // 16px impostor threshold, so the slice volume leaves rendering and the billboards carry it.
  runtime.publish(publication(400));
  expect(detail.style.display).toBe('none'); expect(distant.style.display).toBe('block');
  // A native mount adopts server-rendered nodes, so the slices exist; what changes is that they leave rendering.
  expect(sceneNodes().length).toBe(3);
  runtime.publish(publication(100));
  expect(detail.style.display).toBe('block'); expect(distant.style.display).toBe('block');
  expect(sceneNodes().length).toBe(3);
  runtime.publish(publication(20));
  expect(detail.style.display).toBe('block'); expect(distant.style.display).toBe('none');
  const resolved = reads.length;
  runtime.publish(publication(30)); runtime.publish(publication(500));
  expect(reads.length).toBe(resolved);
  expect(detail.style.display).toBe('none');
  runtime.destroy();
});

test('a cloud denied its detail is carried by its billboards at every size, until it is allowed again', () => {
  const f = dom();
  const directions = [
    { id: 'front', back: [0, 0, 1] as const, right: [1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'back', back: [0, 0, -1] as const, right: [-1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'right', back: [1, 0, 0] as const, right: [0, 0, -1] as const, down: [0, -1, 0] as const },
    { id: 'left', back: [-1, 0, 0] as const, right: [0, 0, 1] as const, down: [0, -1, 0] as const },
  ];
  const impostors = { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: 1,
    fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32,
    views: directions.map(view => ({ ...view, texturePath: `${view.id}.png` })) };
  const base = volume('galaxy');
  const cloud = { ...base, impostors, resources: [...base.resources,
    ...impostors.views.map(view => ({ path: view.texturePath, sha256: 'b'.repeat(64), bytes: 1, width: 1, height: 1 }))] };
  const lod = mountPreparedVolumeLod({ ...f.options, payload: cloud, resolveResource: path => `/prepared/${path}` }, () => 1);
  const detail = f.host.children.find(node => node.className === 'css-volume-detail')!;
  const distant = f.host.children.find(node => node.className === 'css-volume-impostors')!;
  // Close enough for the full volume: allowed, the slices present and the billboard leaves rendering.
  lod.publish(publication(4));
  expect(detail.style.display).toBe('block'); expect(distant.style.display).toBe('none');
  // The unselected galaxy: denied, only the billboard presents, at full weight, at the same distance.
  lod.setDetail(false);
  lod.publish(publication(4.01));
  expect(detail.style.display).toBe('none'); expect(distant.style.display).toBe('block'); expect(distant.style.opacity).toBe('');
  expect(Number(distant.dataset.activeViews)).toBeGreaterThan(0);
  expect(distant.children.some(node => node.style.display === 'block' && node.style.backgroundImage)).toBe(true);
  lod.setDetail(true);
  lod.publish(publication(4));
  expect(detail.style.display).toBe('block'); expect(distant.style.display).toBe('none');
  // Without impostor views there is nothing but slices, so denying them is refused.
  const plain = mountPreparedVolumeLod({ ...f.options, payload: base, resolveResource: path => `/prepared/${path}` }, () => 1);
  expect(() => plain.setDetail(false)).toThrow();
  lod.destroy(); plain.destroy();
});

test('fixed detail planes retain physical geometry through camera motion, material changes and LOD', () => {
  const f = dom(), base = budgetPayload(3, 0).lenses[0]!.volume;
  const leaf = { ...base.stacks[2]!.leaves[0]!, id: 'outer-disc' };
  const data = { ...base, detailPlanes: [leaf] };
  const lod = mountPreparedVolumeLod({ ...f.options, payload: data, resolveResource: path => `/prepared/${path}`, lazyDetail: true }, () => 1);
  lod.publish(publication(100));
  expect(descendants(f.host).filter(node => node.dataset.volumePlane)).toHaveLength(0);
  lod.publish(publication(4));
  const nodes = descendants(f.host), plane = nodes.find(node => node.dataset.volumePlane === leaf.id)!;
  const planeRoot = nodes.find(node => node.dataset.volumePlanes !== undefined)!;
  const scene = descendants(planeRoot).find(node => node.className === 'css-volume-scene')!;
  const sliceRoot = nodes.find(node => node.className === 'css-volume-projection' && node !== planeRoot)!;
  const sliceScene = descendants(sliceRoot).find(node => node.className === 'css-volume-scene')!;
  const firstCamera = scene.style.transform;
  expect(plane.style.transform).toBe(leaf.style.transform);
  expect(scene.style.transform).toBe(sliceScene.style.transform);
  lod.publish(publication(3, [.3, .2, 1]));
  expect(scene.style.transform).not.toBe(firstCamera);
  expect(scene.style.transform).toBe(sliceScene.style.transform);
  expect(plane.style.transform).toBe(leaf.style.transform);
  const next = { ...data, detailPlanes: [{ ...leaf, texturePath: base.resources[0]!.path,
    style: { ...leaf.style, backgroundPosition: '-1px 0px' } }] };
  lod.setPresentation(next);
  expect(descendants(f.host)).toEqual(nodes);
  expect(plane.style.backgroundImage).toBe(`url("/prepared/${base.resources[0]!.path}")`);
  expect(plane.style.backgroundPosition).toBe('-1px 0px');
  expect(samePreparedVolumeTopology(data, { ...data, detailPlanes: [{ ...leaf, centerUnits: [1, 0, 0] }] })).toBe(false);
  lod.setDetail(false); lod.publish(publication(3));
  expect(planeRoot.parentNode!.style.display).toBe('none');
  lod.setDetail(true); lod.publish(publication(3));
  expect(planeRoot.parentNode!.style.display).toBe('block');
  expect(descendants(f.host).find(node => node.dataset.volumePlane)).toBe(plane);
  lod.destroy(); expect(f.host.children).toEqual([f.before]);
});
