import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseObjectDescriptor, prepareObject } from '@cssearth/objects';
import { createPreparedVolumeDatasets, loadPreparedVolumeDatasets, validatePreparedVolumeDatasets,
  volumeDatasetCompositeOpacity } from './prepared-volume-datasets.js';
import { mountPreparedVolumeLod, samePreparedVolumeTopology } from './prepared-volume-lod.js';
import type { PreparedVolumeDatasets } from './prepared-volume-datasets.js';
import type { PreparedCssVolume, VolumeCameraPublication, VolumeVector } from './types.js';
import { mountPreparedCataloguePoints, validatePreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import type { PreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import { prepareObjectResources } from '../runtime/prepared-resource-lease.js';
import { createPreparedResidency } from '../rendering/prepared-residency.js';
import { cloudCompositeOpacity } from '@cssearth/volume-viewer/scene/cloud-inspection';
import { CSS_COMPILER_RENDER_BUDGET } from './compiler-render-budget.js';
import { createRenderElementBudget } from '@cssearth/objects';
import { stubGlobal, unstubAllGlobals } from '@cssearth/objects/node/contract';

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
  setAttribute(_name: string, _value: string): void {}
  // What detached-sections.ts uses to take a section off the page: an attribute, a template's content and a swap in place.
  #content: FakeElement | null = null;
  get content(): FakeElement { return this.#content ??= new FakeElement(this.ownerDocument, 'fragment'); }
  replaceWith(next: FakeElement): void { const parent = this.parentNode; if (!parent) return; parent.insertBefore(next, this); this.remove(); }
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
  resources: ['x', 'y', 'z'].map(axis => ({ path: `${id}/${axis}.webp`, bytes: 1, width: 1, height: 1 })),
  provenance: {}, approximation: {},
});
const payload = (): PreparedVolumeDatasets => ({ schema: 'cssearth-volume-datasets@1', id: 'fixture', defaultDataset: 'first', framingRadiusUnits: 1,
  datasets: ['first', 'second', 'third'].map((id, index) => ({ id, label: id, title: `${id} dataset`, description: 'Prepared observation',
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
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.append(before);
  return { document, host, before, options: { host: host as unknown as HTMLElement, before: before as unknown as Element } };
}
const descendants = (root: FakeElement): FakeElement[] => [root, ...root.children.flatMap(descendants)];
afterEach(() => unstubAllGlobals());

/** A complete retained topology, including the 26 camera directions used by app preparation. */
function budgetPayload(slabCount: number, starCount: number): PreparedVolumeDatasets {
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
  return { ...original, starsEnabled: false, datasets: original.datasets.map(dataset => {
    const source = dataset.volume;
    const views = directions.map(view => ({ ...view, texturePath: `${dataset.id}/${view.id}.png` }));
    return { ...dataset, stars: { frame, points: points().points.slice(0, starCount) }, volume: { ...source,
      stacks: source.stacks.map((stack, axis) => ({ ...stack,
        leaves: Array.from({ length: Math.floor(slabCount / 3) + (axis < slabCount % 3 ? 1 : 0) }, (_, index) =>
          ({ ...stack.leaves[0]!, id: `${stack.axis}-${index}` })) })),
      impostors: { schema: 'cssearth-volume-impostors@1', radiusUnits: 1,
        fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32, views },
      resources: [...source.resources, ...views.map(view => ({ path: view.texturePath, bytes: 1, width: 1, height: 1 }))],
    } };
  }) };
}

for (const [slabCount, starCount] of [[151, 0], [150, 3]]) test(`the compiler DOM quota includes every retained XYZ copy, star and impostor (${slabCount} slabs, ${starCount} stars)`, () => {
  const f = dom(), data = budgetPayload(slabCount, starCount);
  const runtime = createPreparedVolumeDatasets({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  // Mounted distant, the bank holds its impostors and stars only; the slice leaves wait for the first close publication.
  const mounted = descendants(root);
  assert.equal(mounted.filter(node => node.parentNode?.className === 'css-volume-mesh').length, 0);
  assert.equal(mounted.filter(node => node.dataset.volumeImpostor !== undefined).length, 26);
  runtime.setStarsVisible(true); runtime.publish(publication(4));
  const initial = descendants(root);
  const predicted = createRenderElementBudget(CSS_COMPILER_RENDER_BUDGET, starCount, slabCount).totalElements;
  assert.equal(data.datasets[0]!.volume.stacks.map(stack => stack.leaves.length).reduce((a, b) => a + b, 0), slabCount);
  assert.equal(initial.filter(node => node.parentNode?.className === 'css-volume-mesh').length, slabCount * 3);
  assert.equal(initial.filter(node => node.dataset.volumeImpostor !== undefined).length, 26);
  assert.equal(initial.filter(node => node.dataset.catalogueSource !== undefined).length, starCount);
  assert.equal(initial.length, 499); // Includes the bank root, markers, empty star wrapper and hidden nodes.
  assert.equal((initial.length - slabCount * 3 - starCount), 46);
  assert.equal(predicted, CSS_COMPILER_RENDER_BUDGET.maximumElements);
  assert.ok(initial.length <= predicted);
  assert.equal(Number(root.dataset.volumeResidentDomNodes), initial.length);
  for (const id of ['second', 'third', 'first']) for (const distance of [4, 100]) {
    runtime.selectDataset(id);
    for (const direction of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 1], [1, 1, .4], [0, 0, -1]] as const) {
      runtime.publish(publication(distance, direction));
      runtime.setStarsVisible(true); runtime.setStarsVisible(false);
      const current = descendants(root);
      assert.ok(current.length <= CSS_COMPILER_RENDER_BUDGET.maximumElements);
      assert.equal(current.every((node, index) => node === initial[index]), true);
      assert.equal(current.length, initial.length);
      assert.equal(root.dataset.volumeResidentTopologyCount, '1');
    }
  }
  assert.equal(initial.some(node => node.style.display === 'none' || node.style.visibility === 'hidden' || node.hidden), true);
  runtime.destroy(); assert.deepEqual(f.host.children, [f.before]);
});

test('catalogue points project prepared positions, cull hidden support and keep nodes when presentation changes', () => {
  const f = dom(), initial = points();
  const mount = mountPreparedCataloguePoints({ ...f.options, payload: initial });
  const root = mount.root as unknown as FakeElement, nodes = [...root.children];
  mount.publish(publication(10));
  assert.equal(nodes[0].style.transform, 'translate(-11px,-11px)');
  assert.deepEqual(nodes.map(node => node.style.visibility), ['visible', 'hidden', 'hidden']);
  assert.equal(root.dataset.visiblePoints, '1');
  const changed = { ...initial, points: initial.points.map(point => ({ ...point, sizePx: 4, opacity: .3 })).reverse() };
  mount.setPresentation(changed);
  assert.deepEqual(root.children, nodes); assert.equal(nodes[0].style.transform, 'translate(-12px,-12px)');
  assert.equal(nodes[0].style.opacity, '0.3'); assert.equal(nodes[0].style.width, '4px');
  assert.equal(root.dataset.visiblePoints, '2');
  const moved = { ...changed, points: changed.points.map(point => ({ ...point, positionUnits: [1, 1, 1] as VolumeVector })) };
  assert.throws(() => mount.setPresentation(moved), /same prepared point geometry/);
  assert.equal(nodes[0].style.transform, 'translate(-12px,-12px)');
  assert.throws(() => mount.publish({ ...publication(), world: { ...publication().world, epochJdTt: 124 } }), /frame and epoch/);
  mount.destroy(); mount.destroy(); assert.deepEqual(f.host.children, [f.before]);
});

test('malformed point payloads and dataset-specific catalogue geometry are rejected before mounting', () => {
  const p = points();
  for (const altered of [{ ...p, points: [p.points[0], p.points[0]] },
    { ...p, points: [{ ...p.points[0], sizePx: NaN }] }, { ...p, points: [{ ...p.points[0], opacity: 1.1 }] },
    { ...p, points: [{ ...p.points[0], colorCss: 'url(unsafe)' }] }]) assert.throws(() => validatePreparedCataloguePoints(altered));
  const data = payload(), second = data.datasets[1];
  const moved = { ...second.stars, points: second.stars.points.map(point => ({ ...point, positionUnits: [1, 2, 3] as VolumeVector })) };
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, datasets: [data.datasets[0], { ...second, stars: moved }] }), /same catalogue geometry/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, defaultDataset: 'absent' }), /default/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, datasets: [data.datasets[0], data.datasets[0]] }), /content/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, pointVisibility: { hiddenBelowRadiusPixels: 24, fullAboveRadiusPixels: 2 } }), /thresholds/);
  assert.throws(() => validatePreparedVolumeDatasets({ ...data, datasets: [{ ...data.datasets[0], brightness: { overall: 2, x: 1, y: 1, z: 1 } }] }), /brightness/);
});

test('same-topology datasets reuse one retained cloud and replace all selected material', () => {
  const f = dom(), data = payload();
  const prepared = createPreparedVolumeDatasets({ payload: data, resolveResource: mock.fn(path => `/prepared/${path}`) });
  const runtime = prepared.mount(f.options), root = runtime.root as unknown as FakeElement;
  runtime.publish(publication());
  const initial = descendants(root), cloudRoots = root.children.filter(node => node.className === 'prepared-volume-dataset-cloud');
  const catalogue = root.children.find(node => node.className === 'prepared-catalogue-points')!;
  const pointsBefore = [...catalogue.children], leaves = initial.filter(node => node.style.backgroundImage);
  assert.equal(cloudRoots.length, 1); assert.equal(leaves.length, 3);
  assert.partialDeepStrictEqual(root.dataset, { volumeDatasetCount: '3', volumeTopologyCount: '1', volumeResidentTopologyCount: '1' });
  const geometry = leaves.map(node => node.style.transform);
  for (const id of ['second', 'third', 'first']) {
    runtime.selectDataset(id);
    assert.deepEqual(cloudRoots.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeDataset), [id]);
    assert.equal(runtime.state().id, id); assert.equal(root.dataset.selectedDataset, id);
    const current = descendants(root);
    assert.equal(current.length, initial.length); assert.equal(current.every((node, index) => node === initial[index]), true);
    assert.equal(catalogue.children.length, pointsBefore.length);
    assert.equal(catalogue.children.every((node, index) => node === pointsBefore[index]), true);
    assert.deepEqual(([...new Set(leaves.map(node => node.style.backgroundImage))]), [`url("/prepared/${id}/z.webp")`]);
    assert.deepEqual(([...new Set(initial.filter(node => node.localName === 's' && node.style.backgroundSize).map(node => node.style.backgroundPosition))]), [`${id === 'first' ? 0 : id === 'second' ? -1 : -2}px 0px`]);
    assert.deepEqual(leaves.map(node => node.style.transform), geometry);
  }
  assert.throws(() => runtime.selectDataset('missing'), /Unknown/); assert.equal(runtime.state().id, 'first');
  assert.equal(initial.filter(node => node.className === 'css-volume-projection').every(node => node.style.background === 'transparent'), true);
  assert.equal(cloudRoots.every(node => !node.style.background), true);
  assert.equal(initial.filter(node => ['css-volume-camera', 'css-volume-scene', 'css-volume-mesh'].includes(node.className))
    .every(node => node.style.opacity === undefined), true);
  runtime.destroy(); runtime.publish(publication()); runtime.selectDataset('third');
  assert.deepEqual(f.host.children, [f.before]);
});

test('a distinct topology is allocated only on first selection and then retained hidden', () => {
  const base = payload(), second = base.datasets[1]!;
  const data = { ...base, datasets: [base.datasets[0]!, { ...second, volume: volume(second.id, -1, 1) }, base.datasets[2]!] };
  const f = dom(), runtime = createPreparedVolumeDatasets({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  runtime.publish(publication());
  assert.equal(root.children.filter(node => node.className === 'prepared-volume-dataset-cloud').length, 1);
  assert.partialDeepStrictEqual(root.dataset, { volumeTopologyCount: '2', volumeResidentTopologyCount: '1' });
  assert.equal(descendants(root).length, 29); // Three shared stars and one three-slab topology, all optical copies retained.
  runtime.selectDataset('second');
  const families = root.children.filter(node => node.className === 'prepared-volume-dataset-cloud');
  assert.equal(families.length, 2); assert.equal(root.dataset.volumeResidentTopologyCount, '2');
  assert.equal(descendants(root).length, 52); // A second topology costs its wrappers and leaves even when hidden.
  assert.equal(root.dataset.volumeResidentDomNodes, '52');
  assert.deepEqual(families.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeDataset), ['second']);
  runtime.selectDataset('third');
  assert.deepEqual(root.children.filter(node => node.className === 'prepared-volume-dataset-cloud'), families);
  assert.deepEqual(families.filter(node => node.style.display !== 'none').map(node => node.dataset.volumeDataset), ['third']);
  assert.equal(descendants(root).length, 52);
  runtime.destroy();
});

test('axis brightness matches the lab completed-image oracle through handoffs and stays outside cloud geometry', () => {
  const f = dom(), data = payload(), runtime = createPreparedVolumeDatasets({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  const surface = root.children.find(node => node.dataset.volumeDataset === 'first')!;
  assert.equal(surface.children.filter(node => node.className === 'css-volume-projection').length, 0);
  runtime.publish(publication(4));
  const axes = surface.children.filter(node => node.className === 'css-volume-projection');
  for (let degrees = 0; degrees <= 180; degrees += 3) {
    const angle = degrees * Math.PI / 180;
    runtime.publish(publication(4, [Math.sin(angle), Math.sin(angle) / 2, Math.cos(angle)]));
    const banks = axes.map((node, index) => ({ axis: (['x', 'y', 'z'] as const)[index], opacity: Number(node.style.opacity), visible: node.style.visibility !== 'hidden' }));
    const expected = cloudCompositeOpacity(banks, data.datasets[0].brightness);
    assert.ok(Math.abs(Number(surface.style.opacity) - (expected)) < 10 ** -12 / 2, `${Number(surface.style.opacity)} is not close to ${expected}`);
    assert.ok(Math.abs(volumeDatasetCompositeOpacity(banks, data.datasets[0].brightness) - (expected)) < 10 ** -12 / 2, `${volumeDatasetCompositeOpacity(banks, data.datasets[0].brightness)} is not close to ${expected}`);
  }
  runtime.destroy();
});

test('unresolved catalogue points fade away without changing prepared resolved size or exposure', () => {
  const f = dom(), runtime = createPreparedVolumeDatasets({ payload: payload(), resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement;
  runtime.publish(publication(4)); // 25 px radius: fully resolved using default policy.
  const stars = root.children.find(node => node.className === 'prepared-catalogue-points')!;
  assert.equal(stars.style.opacity, '1'); assert.equal(stars.style.display, 'block');
  const material = stars.children.map(node => [node.style.width, node.style.opacity]);
  runtime.publish(publication(10)); // 10 px: smooth transition.
  assert.ok(Number(stars.style.opacity) > 0); assert.ok(Number(stars.style.opacity) < 1);
  runtime.publish(publication(100)); // 1 px: do not merge the fixed catalogue into an artificial bright dot.
  assert.equal(stars.style.opacity, '0'); assert.equal(stars.style.display, 'none');
  assert.deepEqual(stars.children.map(node => [node.style.width, node.style.opacity]), material);
  runtime.publish(publication(4)); assert.equal(stars.style.opacity, '1'); assert.equal(stars.style.display, 'block');
  runtime.destroy();
});

test('distant prepared images suspend the retained slice renderer and hand off by projected size', () => {
  const f = dom(), original = payload(), dataset = original.datasets[0]!;
  const directions = [
    { id: 'front', back: [0, 0, 1] as const, right: [1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'back', back: [0, 0, -1] as const, right: [-1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'right', back: [1, 0, 0] as const, right: [0, 0, -1] as const, down: [0, -1, 0] as const },
    { id: 'left', back: [-1, 0, 0] as const, right: [0, 0, 1] as const, down: [0, -1, 0] as const },
  ];
  const impostors = { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: 1,
    fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32,
    views: directions.map(view => ({ ...view, texturePath: `${view.id}.png` })) };
  const data = { ...original, datasets: [{ ...dataset, volume: { ...dataset.volume, impostors,
    resources: [...dataset.volume.resources, ...impostors.views.map(view => ({ path: view.texturePath, bytes: 1, width: 1, height: 1 }))] } }] };
  const runtime = createPreparedVolumeDatasets({ payload: data, resolveResource: path => `/prepared/${path}` }).mount(f.options);
  const root = runtime.root as unknown as FakeElement, initial = descendants(root);
  const detail = initial.find(node => node.className === 'css-volume-detail')!;
  const distant = initial.find(node => node.className === 'css-volume-impostors')!;
  const sceneNodes = () => descendants(root).filter(node => node.className === 'css-volume-scene');
  assert.equal(descendants(root).filter(node => node.style.backgroundImage).length, 0);
  // While only impostors contribute, the slice renderer is not built at all.
  assert.equal(sceneNodes().length, 0);
  runtime.publish(publication(100));
  assert.equal(descendants(root).filter(node => node.style.backgroundImage && !node.dataset.volumeImpostor).length, 0);
  assert.equal(detail.style.display, 'none'); assert.equal(distant.style.display, 'block');
  assert.equal(distant.dataset.activeViews, '1');
  runtime.publish(publication(50));
  assert.equal(sceneNodes().length, 0);
  runtime.publish(publication(200 / 24));
  const scenes = sceneNodes(), built = descendants(root);
  assert.equal(scenes.length, 3);
  assert.equal(detail.style.display, 'block'); assert.equal(distant.style.display, 'block');
  assert.ok(Math.abs(Number(distant.style.opacity) - (.5)) < 10 ** -2 / 2, `${Number(distant.style.opacity)} is not close to ${.5}`);
  assert.ok(Math.abs(Number(detail.style.opacity) - (.5 * .8 * .9)) < 10 ** -2 / 2, `${Number(detail.style.opacity)} is not close to ${.5 * .8 * .9}`);
  runtime.publish(publication(4));
  assert.equal(distant.style.display, 'none'); assert.equal(detail.style.display, 'block');
  const visibleTransforms = scenes.map(scene => scene.style.transform);
  runtime.publish(publication(100));
  assert.deepEqual(scenes.map(scene => scene.style.transform), visibleTransforms);
  // Once built, the slice renderer stays retained when the cloud recedes.
  assert.deepEqual(descendants(root), built);
  runtime.destroy(); assert.deepEqual(f.host.children, [f.before]);
});

test('saved star visibility stays toggleable with retained points and committed dataset subscriptions', () => {
  const f = dom(), prepared = createPreparedVolumeDatasets({ payload: { ...payload(), starsEnabled: false }, resolveResource: path => `/prepared/${path}` });
  const runtime = prepared.mount(f.options), root = runtime.root as unknown as FakeElement;
  const findStars = () => root.children.find(node => node.className === 'prepared-catalogue-points');
  const notify = mock.fn((_state: ReturnType<typeof runtime.state>) => {}), unsubscribe = runtime.subscribe(notify);
  assert.equal(runtime.state().defaultDataset, 'first');
  // Disabled points are not built at all; enabling them builds them once and they are retained from then on.
  runtime.publish(publication(4)); assert.equal(findStars(), undefined); assert.equal(runtime.state().starsVisible, false);
  runtime.setStarsVisible(true);
  const stars = findStars()!, nodes = [...stars.children];
  assert.equal(stars.style.display, 'block'); assert.equal(runtime.state().starsVisible, true);
  assert.equal(nodes[0].style.opacity, '0.7');
  runtime.selectDataset('second');
  assert.deepEqual(notify.mock.calls.map(({ arguments: [state] }) => [state.selectedDataset, state.starsVisible]), [['first', true], ['second', true]]);
  assert.deepEqual(runtime.state().datasets.map(dataset => dataset.label), ['first', 'second', 'third']);
  runtime.setStarsVisible(true); assert.equal(notify.mock.callCount(), 2);
  runtime.publish(publication(100)); runtime.setStarsVisible(false); runtime.setStarsVisible(true);
  assert.equal(stars.style.display, 'none'); // Toggle cannot defeat the unresolved-point fade.
  unsubscribe(); const count = notify.mock.calls.length; runtime.selectDataset('third'); assert.equal(notify.mock.callCount(), count);
  runtime.destroy(); runtime.setStarsVisible(false); assert.equal(notify.mock.callCount(), count);
});

test('declared dataset resources do not download at startup or for inactive datasets and axes', async () => {
  const prepared = createPreparedVolumeDatasets({ payload: payload(), resolveResource: path => '/prepared/' + path });
  const createImage = mock.fn(() => ({ src: '', decoding: 'async' as const, naturalWidth: 1, naturalHeight: 1, decode: async () => {} }));
  const lease = prepareObjectResources(prepared.assets, {
    createResources: options => createPreparedResidency({ ...options, createImage }),
  });
  await lease.ready;
  assert.equal(prepared.assets.entries.length, 9);
  assert.deepEqual(prepared.assets.startup, []);
  assert.equal(createImage.mock.callCount(), 0);
  const f = dom(), runtime = prepared.mount(f.options);
  const attached = () => [...new Set(descendants(runtime.root as unknown as FakeElement)
    .map(node => node.style.backgroundImage).filter(Boolean))];
  assert.deepEqual(attached(), []);
  runtime.publish(publication());
  assert.deepEqual(attached(), ['url("/prepared/first/z.webp")']);
  runtime.publish(publication(100), false);
  runtime.selectDataset('second');
  assert.deepEqual(attached(), []);
  runtime.publish(publication());
  assert.deepEqual(attached(), ['url("/prepared/second/z.webp")']);
  runtime.destroy(); lease.destroy();
});

async function transportFixture(data = payload()) {
  const descriptor = parseObjectDescriptor({ schema: 'cssearth-object@2', id: data.id, type: 'volume-dataset-bank',
    properties: { frame, preparation: { source: 'source/lenses.json' } } });
  const wrapped = await prepareObject(descriptor, { type: descriptor.type, format: 'cssearth-volume-datasets@1', parse: value => value, bake: () => data }, {});
  const bytes = new TextEncoder().encode(JSON.stringify(wrapped)).buffer;
  return { bytes, descriptor: { ...descriptor, prepared: { format: 'cssearth-volume-datasets@1', url: 'prepared/datasets.json' } } };
}
test('generic descriptor loader verifies wrapper identity and all volume frames', async () => {
  const f = await transportFixture(), read = mock.fn(async () => f.bytes);
  const loaded = await loadPreparedVolumeDatasets(f.descriptor, { read });
  assert.equal(loaded.id, 'fixture'); assert.equal(loaded.datasets.length, 3);
  assert.equal(read.mock.callCount(), 1); assert.deepEqual(read.mock.calls[0]!.arguments, ['prepared/datasets.json']);
  const drift = { ...f.descriptor, properties: { ...f.descriptor.properties, frame: { ...frame, originM: [1, 0, 0] } } };
  await assert.rejects(loadPreparedVolumeDatasets(drift, { read }), /identity\/frame/);
  await assert.rejects(loadPreparedVolumeDatasets({ ...f.descriptor, id: 'different' }, { read }), /identity/);
});

test('angular compact-light footprints zoom and change dataset material without changing their positions or nodes', () => {
  const f = dom(), initial = points();
  const angular = { ...initial, points: initial.points.map(point => ({ ...point, diameterUnits: .2 })) };
  const mount = mountPreparedCataloguePoints({ ...f.options, payload: angular });
  const root = mount.root as unknown as FakeElement, nodes = [...root.children];
  mount.publish(publication(10)); assert.equal(nodes[0].style.width, '2px');
  mount.publish(publication(5)); assert.equal(nodes[0].style.width, '4px');
  const center = nodes[0].style.transform;
  mount.setPresentation({ ...angular, points: angular.points.map(point => ({ ...point, colorCss: '#ff1100', opacity: .1 })) });
  assert.deepEqual(root.children, nodes); assert.equal(nodes[0].style.transform, center);
  assert.equal(nodes[0].style.background, '#ff1100'); assert.equal(nodes[0].style.opacity, '0.1');
  // The new material's size does not replace the projected one the unchanged camera already drew.
  assert.equal(nodes[0].style.width, '4px'); assert.equal(nodes[0].style.height, '4px');
  assert.throws(() => validatePreparedCataloguePoints({ ...angular, points: [{ ...angular.points[0], diameterUnits: NaN }] }));
  mount.destroy();
});

test('nearby volume visibility is explicit and rejects unknown policies', () => {
  assert.equal(validatePreparedVolumeDatasets({ ...payload(), contextVisibility: 'independent' }).contextVisibility, 'independent');
  assert.equal(validatePreparedVolumeDatasets(payload()).contextVisibility, 'galactic');
  assert.throws(() => validatePreparedVolumeDatasets({ ...payload(), contextVisibility: 'maybe' }));
});

test('native mounts build every node at mount, as the server-rendered DOM they adopt was built', () => {
  const lazy = dom(), eager = dom(), data = { ...budgetPayload(30, 3), starsEnabled: true };
  const bank = createPreparedVolumeDatasets({ payload: data, resolveResource: path => `/prepared/${path}` });
  const lazyRoot = bank.mount(lazy.options).root as unknown as FakeElement;
  const eagerRoot = bank.mount({ ...eager.options, nativeFocalCss: '1000px' }).root as unknown as FakeElement;
  const count = (root: FakeElement, test: (node: FakeElement) => boolean) => descendants(root).filter(test).length;
  const leaves = (node: FakeElement) => node.parentNode?.className === 'css-volume-mesh', points = (node: FakeElement) => node.dataset.catalogueSource !== undefined;
  assert.deepEqual(([count(lazyRoot, leaves), count(lazyRoot, points)]), [0, 0]);
  assert.deepEqual(([count(eagerRoot, leaves), count(eagerRoot, points)]), [90, 3]);
  assert.equal(count(eagerRoot, node => node.dataset.volumeImpostor !== undefined), 26);
});

test('a phone hands an impostor-sized cloud to its billboards instead of fading a live slice volume', () => {
  const f = dom(), original = payload(), dataset = original.datasets[0]!;
  const directions = [
    { id: 'front', back: [0, 0, 1] as const, right: [1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'back', back: [0, 0, -1] as const, right: [-1, 0, 0] as const, down: [0, -1, 0] as const },
    { id: 'right', back: [1, 0, 0] as const, right: [0, 0, -1] as const, down: [0, -1, 0] as const },
    { id: 'left', back: [-1, 0, 0] as const, right: [0, 0, 1] as const, down: [0, -1, 0] as const },
  ];
  const impostors = { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: 1,
    fullBelowDiameterPixels: 16, volumeAboveDiameterPixels: 32,
    views: directions.map(view => ({ ...view, texturePath: `${view.id}.png` })) };
  const data = { ...original, datasets: [{ ...dataset, volume: { ...dataset.volume, impostors,
    resources: [...dataset.volume.resources, ...impostors.views.map(view => ({ path: view.texturePath, bytes: 1, width: 1, height: 1 }))] } }] };
  // A responsive mount resolves its focal length in CSS. The fade reads the same resolved length, so the runtime can
  // tell an invisible presentation from a contributing one instead of keeping both displayed.
  const runtime = createPreparedVolumeDatasets({ payload: data, resolveResource: path => `/prepared/${path}` })
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
  assert.equal(detail.style.display, 'none'); assert.equal(distant.style.display, 'block');
  // A native mount adopts server-rendered nodes, so the slices exist; what changes is that they leave rendering.
  assert.equal(sceneNodes().length, 3);
  runtime.publish(publication(100));
  assert.equal(detail.style.display, 'block'); assert.equal(distant.style.display, 'block');
  assert.equal(sceneNodes().length, 3);
  runtime.publish(publication(20));
  assert.equal(detail.style.display, 'block'); assert.equal(distant.style.display, 'none');
  const resolved = reads.length;
  runtime.publish(publication(30)); runtime.publish(publication(500));
  assert.equal(reads.length, resolved);
  assert.equal(detail.style.display, 'none');
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
    ...impostors.views.map(view => ({ path: view.texturePath, bytes: 1, width: 1, height: 1 }))] };
  const lod = mountPreparedVolumeLod({ ...f.options, payload: cloud, resolveResource: path => `/prepared/${path}` }, () => 1);
  const detail = f.host.children.find(node => node.className === 'css-volume-detail')!;
  const distant = f.host.children.find(node => node.className === 'css-volume-impostors')!;
  // Close enough for the full volume: allowed, the slices present and the billboard leaves rendering.
  lod.publish(publication(4));
  assert.equal(detail.style.display, 'block'); assert.equal(distant.style.display, 'none');
  // The unselected galaxy: denied, only the billboard presents, at full weight, at the same distance.
  lod.setDetail(false);
  lod.publish(publication(4.01));
  assert.equal(detail.style.display, 'none'); assert.equal(distant.style.display, 'block'); assert.equal(distant.style.opacity, '');
  assert.ok(Number(distant.dataset.activeViews) > 0);
  assert.equal(distant.children.some(node => node.style.display === 'block' && node.style.backgroundImage), true);
  lod.setDetail(true);
  lod.publish(publication(4));
  assert.equal(detail.style.display, 'block'); assert.equal(distant.style.display, 'none');
  // Without impostor views there is nothing but slices, so denying them is refused.
  const plain = mountPreparedVolumeLod({ ...f.options, payload: base, resolveResource: path => `/prepared/${path}` }, () => 1);
  assert.throws(() => plain.setDetail(false));
  lod.destroy(); plain.destroy();
});

test('detail demands a stable selected-dataset rotation bank and no hidden dataset', () => {
  const { options } = dom();
  const mounted = createPreparedVolumeDatasets({ payload: payload(), resolveResource: path => `/prepared/${path}` }).mount(options);
  assert.deepEqual(mounted.textureUrls(publication(), true), ['/prepared/first/x.webp', '/prepared/first/y.webp', '/prepared/first/z.webp']);
  assert.deepEqual(mounted.textureUrls(publication(4, [1, 0, 0]), true), mounted.textureUrls(publication(), true));
  mounted.selectDataset('second');
  assert.deepEqual(mounted.textureUrls(publication(), true), ['/prepared/second/x.webp', '/prepared/second/y.webp', '/prepared/second/z.webp']);
  mounted.destroy();
});
