import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mountPreparedCssSky, preparedSkyCameraTransform } from './prepared-sky-runtime.js';
import { validatePreparedCssSky } from './validation.js';
import type { PreparedCssSky } from './types.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { PreparedCssImageLayers } from '../image-layers/loader.js';
import type { PreparedVolumeDatasets } from '../volume/prepared-volume-datasets.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import type { PreparedNavigationFocus } from '../navigation/prepared-focus.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import { createPreparedUniverse } from '../universe/prepared-universe-runtime.js';
import { logarithmicFade } from '../universe/world-context/context-scale.js';
import { readCanonicalPointField } from '../../test/canonical-point-field-fixture.js';
import { parseDatasetBillboards } from '../universe/dataset-billboards.js';
import type { DensityVolumeFrame } from '@cssearth/objects';

// linkedom has no layout delivery; caption geometry has explicit observer tests.
beforeEach(() => vi.stubGlobal('ResizeObserver', class {
  observe() {} unobserve() {} disconnect() {}
}));

beforeEach(() => vi.stubGlobal('Image', class {
  src = ''; decoding = 'async'; complete = true; naturalWidth = 1; naturalHeight = 1;
  async decode() {}
  removeAttribute() { this.src = ''; }
}));

/** Declared dataset banks with the prepared facts the universe reads before fetching any of them. These fixtures
 * carry no billboard images, so a small bank draws nothing until its datasets load. */
const datasetBanks = (banks: readonly { id: string; frame: DensityVolumeFrame; contextVisibility?: string; attachedTo?: string }[]) => ({
  volumeDatasetBanks: banks.map(bank => ({ id: bank.id, frame: bank.frame })),
  datasetBillboards: { atlasUrl: '/atlas.webp', plan: parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@1',
    atlas: { columns: 1, rows: 1, cellPx: 256 },
    banks: banks.map(bank => ({ id: bank.id, contextVisibility: bank.contextVisibility ?? 'galactic', attached: bank.attachedTo !== undefined })) }) },
});

const spatialFrame = { id: 1, baseId: 0, members: new Uint32Array(), updates: [], emphasizedId: null, opacity: 1, width: 800, height: 600 };
const spatialPublish = vi.hoisted(() => vi.fn());
const catalogMount = vi.hoisted(() => vi.fn());
const foregroundRects = vi.hoisted(() => [{ left: 100, top: 100, right: 150, bottom: 114 }]);
// These unrelated layers keep their normal publication contract; the test mounts
// the actual universe, sky and volume compositor without building a star catalogue.
vi.mock('../universe/world-context/world-context-point-source.js', () => ({ mountWorldContextPointSource: () => null }));
vi.mock('../universe/prepared-galaxy-catalog.js', () => ({ mountPreparedGalaxyCatalog: catalogMount }));
vi.mock('../universe/prepared-world-context.js', async importOriginal => ({ ...await importOriginal<typeof import('../universe/prepared-world-context.js')>(),
  mountPreparedWorldContext: () => ({ publish: spatialPublish, inspect: () => [], opacityStats: () => ({}), publicationStats: () => ({}), selectObject() {}, setOverview() {}, setBodyVisibility() {}, backgroundExclusionRects: () => foregroundRects, destroy() {} }) }));

const bases = [
  ['px', [1, 0, 0], [0, -1, 0], [0, 0, 1]], ['nx', [-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  ['py', [0, 1, 0], [1, 0, 0], [0, 0, 1]], ['ny', [0, -1, 0], [-1, 0, 0], [0, 0, 1]],
  ['pz', [0, 0, 1], [0, -1, 0], [-1, 0, 0]], ['nz', [0, 0, -1], [0, -1, 0], [1, 0, 0]],
] as const;
const fixture = (): PreparedCssSky => ({ schema: 'cssearth-css-sky@1', referenceFrame: 'fixture', epochJdTt: 123, radiusUnits: 1,
  faces: bases.map(([id, forwardIcrf, rightIcrf, upIcrf]) => ({ id, forwardIcrf, rightIcrf, upIcrf, texturePath: `sky/${id}.webp`, widthPx: 1536, heightPx: 1536,
    style: { width: '100px', height: '100px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-50,-50,-50,1)', backgroundSize: '100px 100px', backgroundPosition: '0px 0px' } })),
  provenance: {}, approximation: {} });
const resources = fixture().faces.map(face => ({ path: face.texturePath, width: face.widthPx, height: face.heightPx, bytes: 100 }));
const world = (positionM: readonly [number, number, number] = [0, 0, 0], orientationXyzw: readonly [number, number, number, number] = [0, 0, 0, 1]): WorldCameraPose =>
  ({ referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM, orientationXyzw } });
const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11] } as const;
class FakeElement {
  readonly nodeType = 1;
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = ''; textContent = ''; clientWidth = 800; clientHeight = 600;
  readonly ownerDocument: FakeDocument;
  readonly localName: string;
  constructor(ownerDocument: FakeDocument, localName = 'div') { this.ownerDocument = ownerDocument; this.localName = localName; Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } }); Object.defineProperty(this.style, 'removeProperty', { value: (name: string) => { const value = this.style[name] ?? ''; delete this.style[name]; return value; } }); }
  get firstChild(): FakeElement | null { return this.children[0] ?? null; }
  get offsetWidth(): number { return this.textContent.length * 7; }
  get offsetHeight(): number { return 14; }
  setAttribute(name: string, value: string): void { this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())] = value; }
  getAttributeNames(): string[] { return []; }
  get tagName(): string { return this.localName.toUpperCase(); }
  append(child: FakeElement): void { this.appendChild(child); }
  appendChild(child: FakeElement): void { this.insertBefore(child, null); }
  insertBefore(child: FakeElement, before: FakeElement | null): void { child.remove(); child.parentNode = this; this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); }
  remove(): void { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
}
class FakeWindow {
  next = 0; pending = new Map<number, (time: number) => void>(); performance = { now: () => 0 };
  requestAnimationFrame = (callback: (time: number) => void) => { const id = ++this.next; this.pending.set(id, callback); return id; };
  cancelAnimationFrame = (id: number) => { this.pending.delete(id); };
}
class FakeDocument { count = 0; defaultView = new FakeWindow(); querySelectorAll(_selector: string): FakeElement[] { return []; } createElement(tag = 'div'): FakeElement { this.count++; return new FakeElement(this, tag); } }
afterEach(() => { vi.unstubAllGlobals(); catalogMount.mockReset(); });

test('cold bootstrap keeps catalogue and image banks descriptor-only, then reuses their first navigation load', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const image: PreparedCssImageLayers = { ...volume, id: 'lazy-image', bankViews: volume.stacks.map(stack => ({ axis: stack.axis,
    normalUnits: stack.axis === 'x' ? [1, 0, 0] : stack.axis === 'y' ? [0, 1, 0] : [0, 0, 1], samplingStepUnits: 1 })) };
  const loadImageLayer = vi.fn(async () => ({ payload: image, resolveResource: (path: string) => `/image/${path}` }));
  const catalogRuntime = { destroy: vi.fn(), select: vi.fn(), resolve: vi.fn(), publish: vi.fn(), inspect: vi.fn(() => ({ count: 0 })) };
  catalogMount.mockReturnValue(catalogRuntime);
  const loadCatalog = vi.fn(async () => ({ payload: {}, fadeStartDistanceM: 10, fullDistanceM: 20 }));
  const document = new FakeDocument(), stage = document.createElement();
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    imageLayerBanks: [{ id: image.id, frame: image.frame }], loadImageLayer,
    catalogBank: { fadeStartDistanceM: 10, fullDistanceM: 20 }, loadCatalog });
  const mounted = universe.mount(stage as unknown as HTMLElement), root = mounted.root as unknown as FakeElement;
  expect(loadImageLayer).not.toHaveBeenCalled(); expect(loadCatalog).not.toHaveBeenCalled();
  expect(root.dataset).toMatchObject({ imageLayerDeclaredBankCount: '1', imageLayerResidentBankCount: '0', catalogResident: 'false' });
  await Promise.all([mounted.ensureGalaxyCatalog(), mounted.ensureGalaxyCatalog(), mounted.focusBank(image.id)!.load(), mounted.focusBank(image.id)!.load()]);
  expect(loadCatalog).toHaveBeenCalledTimes(1); expect(loadImageLayer).toHaveBeenCalledTimes(1); expect(catalogMount).toHaveBeenCalledTimes(1);
  expect(root.dataset).toMatchObject({ imageLayerResidentBankCount: '1', imageLayerLoadingBankCount: '0', catalogResident: 'true', catalogLoading: 'false' });
  await mounted.ensureGalaxyCatalog(); await mounted.focusBank(image.id)!.load();
  expect(loadCatalog).toHaveBeenCalledTimes(1); expect(loadImageLayer).toHaveBeenCalledTimes(1);
  mounted.destroy(); expect(catalogRuntime.destroy).toHaveBeenCalledTimes(1);
});

test('the galaxy is its bulge slices at every overview scope, with no disc plane and no impostor views', () => {
  const base = new URL('../../../../src/', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const document = new FakeDocument();
  const mounted = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}` }).mount(document.createElement() as unknown as HTMLElement);
  try {
    const root = mounted.root as unknown as FakeElement;
    const image = root.children.find(node => node.className === 'prepared-volume-context')!.children[0]!;
    const descendants = (node: FakeElement): FakeElement[] => node.children.flatMap(child => [child, ...descendants(child)]);
    expect(volume.impostors, 'the prepared galaxy carries no impostor views').toBeUndefined();
    const radiusM = Math.hypot(...volume.frame.boundsUnits.max) * volume.frame.metersPerUnit;
    const camera: WorldCameraPose = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      pose: { positionM: [volume.frame.originM[0], volume.frame.originM[1], volume.frame.originM[2] + 2.5 * radiusM], orientationXyzw: [0, 0, 0, 1] } };
    for (const scope of ['local-group', 'milky-way', 'system', 'milky-way', undefined]) {
      mounted.setOverview(scope !== undefined, scope);
      mounted.selectGalaxy(null);
      mounted.publish(camera, viewport, spatialFrame);
      const nodes = descendants(image);
      expect(nodes.filter(node => node.dataset.volumeImpostor !== undefined)).toHaveLength(0);
      expect(nodes.some(node => node.className === 'css-volume-camera')).toBe(true);
    }
  } finally { mounted.destroy(); }
});

test('retains exactly six prepared images and changes only shared camera presentation during travel and rotation', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  // Face bounds as the prepared sky writes them: the face plane at 50 CSS pixels on its forward axis (CSS [y, x, z] of ICRF).
  const payload: PreparedCssSky = { ...fixture(), faces: fixture().faces.map(face => {
    const forward = [face.forwardIcrf[1], face.forwardIcrf[0], face.forwardIcrf[2]];
    return { ...face, boundsCssPixels: { min: forward.map(value => value ? value * 50 : -50.6) as [number, number, number],
      max: forward.map(value => value ? value * 50 : 50.6) as [number, number, number] } };
  }) }, resolveResource = vi.fn((path: string) => `/prepared/${path}`);
  const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11], widthPixels: 1280, heightPixels: 800 } as const;
  const runtime = mountPreparedCssSky({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resources, resolveResource });
  const root = runtime.root as unknown as FakeElement, camera = root.children[0]!, scene = camera.children[0]!, leaves = [...scene.children];
  const count = document.count;
  expect(leaves.map(leaf => leaf.dataset.skyFace)).toEqual(bases.map(([id]) => id));
  // A face fetches nothing until it enters the view; the camera sees at most three of the six.
  expect(leaves.map(leaf => [leaf.style.visibility, leaf.style.backgroundImage ?? ''])).toEqual(leaves.map(() => ['hidden', '']));
  const url = (index: number) => `url("/prepared/${payload.faces[index]!.texturePath}")`;
  runtime.publish(world(), viewport); const initial = scene.style.transform;
  const firstView = leaves.map(leaf => leaf.style.visibility !== 'hidden');
  expect(firstView.filter(Boolean).length).toBeGreaterThan(0); expect(firstView.filter(Boolean).length).toBeLessThanOrEqual(3);
  leaves.forEach((leaf, index) => expect(leaf.style.backgroundImage ?? '').toBe(firstView[index] ? url(index) : ''));
  const styles = leaves.map(leaf => ({ ...leaf.style }));
  runtime.publish(world([1e25, -2e25, 3e25]), viewport); expect(scene.style.transform).toBe(initial);
  runtime.publish(world([0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]), viewport); expect(scene.style.transform).not.toBe(initial);
  expect(camera.style.perspectiveOrigin).toBe('calc(50% + 17px) calc(50% + -11px)');
  expect(root.style.opacity).toBeUndefined(); expect(root.style.transformStyle).toBe('flat');
  for (const node of [camera, scene]) { expect(node.style.transformStyle).toBe('preserve-3d'); expect(node.style.opacity).toBeUndefined(); }
  runtime.publish(world(), viewport, false); expect(root.style.visibility).toBe('hidden');
  runtime.publish(world(), viewport); expect(scene.style.transform).toBe(initial);
  expect(document.count).toBe(count); expect(scene.children).toEqual(leaves);
  // Back at the first view, the faces it shows are exactly as they were; a face the rotation revealed keeps its image.
  leaves.forEach((leaf, index) => { if (firstView[index]) expect(leaf.style).toEqual(styles[index]); });
  expect(resolveResource).toHaveBeenCalledTimes(6);
  leaves.forEach((leaf, index) => expect(leaf.style).toMatchObject(payload.faces[index]!.style));
  expect(leaves.filter(leaf => leaf.style.backgroundImage).length).toBeGreaterThan(firstView.filter(Boolean).length);
  expect(() => runtime.publish({ ...world(), referenceFrame: 'different' }, viewport)).toThrow('reference frames');
  expect(() => runtime.publish({ ...world(), epochJdTt: 124 }, viewport)).toThrow('reference frames');
  runtime.destroy(); runtime.destroy(); runtime.publish(world(), viewport); expect(host.children).toEqual([before]);
});

test('sky and volume project ICRF directions identically, with CSS y down', () => {
  const frame: PreparedCssVolume['frame'] = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  for (const quaternion of [[0, 0, 0, 1], [0, Math.SQRT1_2, 0, Math.SQRT1_2], [.5, .5, .5, .5]] as const) {
    const pose = world([0, 0, 0], quaternion), volume = preparedVolumeCameraTransform({ world: pose, viewport }, frame);
    expect(preparedSkyCameraTransform(pose, viewport)).toBe(`translate3d(17px,-11px,600px) ${worldRotationCss(volume.rotation)}`);
  }
  // Independent cardinal proof: the identity pose looks down ICRF -z with +x right and +y up, so a prepared vertex written as
  // CSS [y,x,z] = [2,1,-3] (ICRF [1,2,-3], ahead, right and up) lands at eye [1,-2,-3]: right, and up on a y-down screen.
  const css = preparedSkyCameraTransform(world(), viewport).split('matrix3d(')[1]!.slice(0, -1).split(',').map(Number);
  expect([css[0]! * 2 + css[4]! * 1, css[1]! * 2 + css[5]! * 1, css[10]! * -3]).toEqual([1, -2, -3]);
  expect(() => preparedSkyCameraTransform(world(), { ...viewport, focalPixels: Infinity })).toThrow();
  expect(() => preparedSkyCameraTransform(world([0, 0, 0], [0, 0, 0, 2]), viewport)).toThrow();
});

test('validates six inward orthonormal faces, exact resource metadata and URL-free numeric CSS', () => {
  const sky = fixture(); expect(validatePreparedCssSky(sky, resources)).toBe(sky);
  for (const replacement of [{ ...sky, extra: true }, { ...sky, faces: sky.faces.slice(1) }, { ...sky, faces: [...sky.faces.slice(0, 5), sky.faces[0]] },
    ...[{ upIcrf: [0, 1, 0] }, { rightIcrf: [0, 1, 0] }, { texturePath: '../sky/px.webp' }, { widthPx: 1 },
      { style: { ...sky.faces[0]!.style, transform: 'matrix3d(1,0,0)' } }, { style: { ...sky.faces[0]!.style, backgroundImage: 'url(remote)' } }]
      .map(face => ({ ...sky, faces: [{ ...sky.faces[0], ...face }, ...sky.faces.slice(1)] }))]) expect(() => validatePreparedCssSky(replacement, resources)).toThrow();
  expect(() => validatePreparedCssSky(sky, resources.slice(1))).toThrow('resource');
});

test('optional sky is validated as part of the existing volume capability and shared resource bank', () => {
  const volume = JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way/prepared/volume.json', import.meta.url), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const withSky = { ...volume, sky, resources: [...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...resources] };
  expect(validatePreparedCssVolume(withSky).sky).toEqual(sky);
  expect(() => validatePreparedCssVolume({ ...withSky, sky: { ...sky, epochJdTt: sky.epochJdTt + 1 } })).toThrow('reference frame');
  const { sky: _sky, ...legacy } = withSky; expect(validatePreparedCssVolume(legacy).sky).toBeUndefined();
});

test('near star cube is fully handed off before solar-system parallax produces duplicate stars', () => {
  const source = JSON.parse(readFileSync(new URL('../../../../src/objects/sun/source/navigation/universe.json', import.meta.url), 'utf8'));
  const astronomicalUnitM = 149_597_870_700;
  expect(source.stars.fadeStartDistanceM).toBe(100 * astronomicalUnitM);
  expect(source.stars.fullDistanceM).toBe(200 * astronomicalUnitM);
  expect(logarithmicFade(591.27 * astronomicalUnitM, source.stars.fadeStartDistanceM, source.stars.fullDistanceM)).toBe(1);
});

test.each([{ withSky: true }, { withSky: false }])('nearer than the disc\'s half-height the NASA band is the sky; from twice that the galaxy volume is (sky=$withSky)', ({ withSky }) => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const { sky: _originalSky, ...volumeWithoutSky } = volume;
  const data = { ...volumeWithoutSky, ...(withSky ? { sky } : {}), resources: [
    ...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...(withSky ? resources : []),
  ] };
  const stars = readCanonicalPointField();
  const document = new FakeDocument(), stage = document.createElement(), detail = document.createElement(); stage.appendChild(detail);
  const universe = createPreparedUniverse({ context, volume: data, pointAppearance: stars, resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`, sprites: {} });
  expect(universe.assets.entries.filter(entry => entry.key.includes(':sky/'))).toHaveLength(withSky ? 6 : 0);
  // No sky face decodes at startup: each loads when it first enters the view.
  expect(universe.assets.startup).toEqual([]);
  const mounted = universe.mount(stage as unknown as HTMLElement), root = mounted.root as unknown as FakeElement;
  const skyRoot = root.children.find(node => node.className === 'prepared-celestial-sky')!, volumeRoot = root.children.find(node => node.className === 'prepared-volume-context')!;
  const volumeImage = volumeRoot.children.find(node => node.className === 'prepared-volume-image')!;
  // The opaque backdrop and its image layer fill the root by stylesheet (volume.css): only the host's display is inline,
  // and neither declares the transform style they have by default (flat).
  expect(volumeRoot.style).toEqual({ display: 'none' });
  expect(readFileSync(new URL('../styles/volume.css', import.meta.url), 'utf8')).toContain('.prepared-volume-context { background: #000; }');
  expect(volumeImage.style.transformStyle).toBeUndefined();
  // The galaxy is its bulge slices, mounted directly: it has no impostor views to hand off to.
  expect(volumeImage.children.some(node => node.className === 'css-volume-impostors')).toBe(false);
  expect(volumeImage.children.filter(node => node.className === 'css-volume-projection')).toHaveLength(3);
  const count = document.count, originalNodes = [...root.children];
  if (withSky) expect(root.children.indexOf(skyRoot)).toBeLessThan(root.children.indexOf(volumeRoot));
  else expect(skyRoot).toBeUndefined();
  expect(root.children.some(node => node.className === 'stellar-direct-points'), 'the Sun draws no star layer of its own').toBe(false);
  // The camera `reach` disc half-heights from the body it looks at, in any direction: orbiting never changes the answer.
  const at = (reach: number, axis = 2): WorldCameraPose => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: context.focus.positionM.map((n: number, index: number) => n + (index === axis ? reach * context.volume.discHalfHeightM : 0)) as [number, number, number], orientationXyzw: [0, 0, 0, 1] } });
  for (const [reach, outside] of [[.01, 0], [.5, 0], [1, 0], [Math.SQRT2, .5], [2, 1], [4, 1]] as const) {
    for (const axis of [0, 1]) {
      mounted.publish(at(reach, axis), viewport, spatialFrame);
      expect(Number(volumeRoot.dataset.volumeOpacity)).toBeCloseTo(outside, 12);
    }
    const camera = at(reach);
    mounted.publish(camera, viewport, spatialFrame);
    expect(Number(volumeRoot.dataset.volumeOpacity)).toBeCloseTo(outside, 12);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(outside, 12);
    if (withSky) {
      expect(skyRoot.style.visibility).toBe(outside < 1 ? 'visible' : 'hidden');
      expect(Number(skyRoot.dataset.skyContribution)).toBeCloseTo(1 - outside, 12);
      // The actual DOM source-over equation: the band and the galaxy share one whole weight.
      expect(completedPixel(volumeRoot, volumeImage, skyRoot, .4)).toBeCloseTo(.4, 12);
    } else expect(completedPixel(volumeRoot, volumeImage, undefined, .4)).toBeCloseTo(.4 * outside, 12);
    mounted.publish({ ...camera, pose: { ...camera.pose, orientationXyzw: [0, 1, 0, 0] } }, viewport, spatialFrame);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(outside, 12);
  }
  expect(document.count).toBe(count); expect(root.children).toEqual(originalNodes);
  mounted.destroy(); expect(stage.children).toEqual([detail]); expect(document.defaultView.pending.size).toBe(0);
});

test('shared universe draws only resolved nebulae and never prefetches their datasets with the galaxy', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const frame: PreparedCssVolume['frame'] = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
    originM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 50 * parsecM],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: .1 * parsecM,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const nebula: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: 'nearby-nebula', frame, anchors: [],
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
      texturePath: `${axis}.webp`, widthPx: 1, heightPx: 1,
      style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {} };
  const bank: PreparedVolumeDatasets = { schema: 'cssearth-volume-datasets@1', id: 'nearby-nebula', defaultDataset: 'optical',
    framingRadiusUnits: 1, contextVisibility: 'independent', datasets: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared nearby nebula', sourceUrl: 'https://example.org/nebula', volume: nebula,
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] };
  const { contextVisibility: _independent, ...galacticBank } = bank;
  const banks = [bank, { ...galacticBank, id: 'galactic-default' }];
  const banksById = new Map(banks.map(payload => [payload.id, payload]));
  const document = new FakeDocument(), stage = document.createElement();
  const fetchResource = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1])));
  Object.assign(document.defaultView, { fetch: fetchResource });
  // Loading a bank's prepared payload (all its datasets and catalogue points) is deferred, one bank at
  // a time, exactly like loadShells defers a surface shell: nothing here is fetched until a bank is
  // either selected or first comes close enough to draw.
  const loadVolumeDataset = vi.fn((id: string) => Promise.resolve({ payload: banksById.get(id)!,
    resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks(banks.map(payload => ({ id: payload.id, frame: payload.datasets[0]!.volume.frame, contextVisibility: payload.contextVisibility, attachedTo: payload.attachedTo }))), loadVolumeDataset });
  // Declaring a bank must not fetch it: the whole point of deferring it is that the first frame never pays for it.
  expect(loadVolumeDataset).not.toHaveBeenCalled();
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const root = mounted.root as unknown as FakeElement;
    const milkyWay = root.children.find(node => node.className === 'prepared-volume-context')!;
    const findBank = (id: string) => root.children.find(node => node.dataset.volumeDatasetObject === id);
    const images = (node: FakeElement): string[] => [node.style.backgroundImage, ...node.children.flatMap(images)].filter(Boolean);
    // Mounting the universe and publishing while far from every bank must not fetch any of them either.
    mounted.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 1e6 * parsecM],
        orientationXyzw: [0, 0, 0, 1] } }, viewport, spatialFrame);
    expect(loadVolumeDataset).not.toHaveBeenCalled();
    expect(findBank(bank.id)).toBeUndefined();
    expect(findBank('galactic-default')).toBeUndefined();
    // A 0.1 pc radius spans 30 px at 2 pc and 1.25 px at 48 pc, using the default visibility thresholds.
    for (const [distancePc, visible] of [[98, false], [52, true], [98, false], [52, true]] as const) {
      const camera: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
        pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
          orientationXyzw: [0, 0, 0, 1] } };
      mounted.publish(camera, viewport, spatialFrame);
      // The first crossing into view fetches the independent bank; give its promise a turn to resolve and
      // mount before reading the DOM. The galactic bank's prepared context visibility keeps it unfetched.
      if (visible && !findBank(bank.id)) {
        await vi.waitFor(() => { expect(findBank(bank.id)).toBeDefined(); });
        mounted.publish(camera, viewport, spatialFrame);
      }
      expect(milkyWay.dataset.volumeOpacity).toBe('0');
      expect(milkyWay.style.display).toBe('none');
      const galactic = findBank('galactic-default');
      const independent = findBank(bank.id);
      if (!visible && !independent) continue; // not yet fetched: the first (invisible) distance, nothing to check
      expect(independent).toBeDefined();
      if (visible) await vi.waitFor(() => {
        mounted.publish(camera, viewport, spatialFrame);
        expect(independent!.style.opacity).toBe('1');
      });
      expect(independent!.style.opacity).toBe(visible ? '1' : '0');
      expect(independent!.style.display).toBe(visible ? 'block' : 'none');
      // The galactic bank has the same silhouette but fades with the galaxy, which is zero here: its datasets are
      // neither drawn nor fetched.
      expect(galactic).toBeUndefined();
      if (visible) {
        const cloud = independent!.children.find(node => node.className === 'prepared-volume-dataset-cloud')!;
        const axes = cloud.children.filter(node => node.className === 'css-volume-projection');
        expect(axes).toHaveLength(3);
        expect(Number(independent!.dataset.cloudOpacity)).toBeGreaterThan(0);
        expect(axes.some(axis => axis.style.visibility === 'visible' && Number(axis.style.opacity) > 0)).toBe(true);
        expect([...new Set(images(independent!))]).toEqual(['url("/nebula/nearby-nebula/z.webp")']);
      }
    }
    expect(loadVolumeDataset).toHaveBeenCalledExactlyOnceWith(bank.id);
    // Trigger the actual universe warm-up: it must finish without any nebula
    // URL, even for legacy banks with no distant-image payload or leaf bounds.
    mounted.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1],
        context.focus.positionM[2] + context.volume.fullDistanceM * 2], orientationXyzw: [0, 0, 0, 1] } }, viewport, spatialFrame);
    const skyPaths = new Set((volume.sky?.faces ?? []).map(face => face.texturePath));
    const expected = volume.resources.filter(resource => !skyPaths.has(resource.path)).map(resource => `/volume/${resource.path}`);
    await vi.waitFor(() => expect(fetchResource).toHaveBeenCalledTimes(expected.length));
    expect(fetchResource.mock.calls.map(([url]) => url)).toEqual(expected);
    // The galaxy warm-up prefetches the Milky Way's own resources only; it must never load a dataset bank
    // beyond the one already fetched by proximity above.
    expect(loadVolumeDataset).toHaveBeenCalledTimes(1);
  } finally { mounted.destroy(); }
  expect(stage.children).toEqual([]);
  expect(document.defaultView.pending.size).toBe(0);
});

test('an unloaded independent bank is fetched by proximity while the galactic fade is zero; a galactic one waits for the galaxy', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const frame: PreparedCssVolume['frame'] = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
    originM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 50 * parsecM],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: .1 * parsecM, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const nebula: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: 'proximity-nebula', frame, anchors: [],
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
      texturePath: `${axis}.webp`, widthPx: 1, heightPx: 1,
      style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {} };
  // Default contextVisibility ('galactic'): this bank's eventual render still waits on the general
  // fade, but its fetch must not, or a future bank baked this way would never load by proximity at all.
  const bank: PreparedVolumeDatasets = { schema: 'cssearth-volume-datasets@1', id: 'proximity-nebula', defaultDataset: 'optical', contextVisibility: 'independent',
    framingRadiusUnits: 1, datasets: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared proximity nebula', sourceUrl: 'https://example.org/nebula', volume: nebula,
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] };
  const document = new FakeDocument(), stage = document.createElement();
  const loadVolumeDataset = vi.fn((id: string) => Promise.resolve({ payload: bank, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks([{ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }]), loadVolumeDataset });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const root = mounted.root as unknown as FakeElement;
    const milkyWay = root.children.find(node => node.className === 'prepared-volume-context')!;
    // 2 pc from the bank, 52 pc from the focus: well within its visibility threshold, but nowhere
    // near the Milky Way's own fade-in distance, so the general galactic fade reads zero here.
    const near: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 52 * parsecM], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(near, viewport, spatialFrame);
    expect(milkyWay.dataset.volumeOpacity).toBe('0');
    expect(loadVolumeDataset).toHaveBeenCalledExactlyOnceWith(bank.id);
  } finally { mounted.destroy(); }
  // The same bank, prepared as fading with the galaxy, is not fetched while the galaxy is faded out.
  const galacticLoad = vi.fn(loadVolumeDataset);
  const galactic = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks([{ id: bank.id, frame, contextVisibility: 'galactic' }]), loadVolumeDataset: galacticLoad }).mount(document.createElement() as unknown as HTMLElement);
  try {
    galactic.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 52 * parsecM], orientationXyzw: [0, 0, 0, 1] } }, viewport, spatialFrame);
    expect(galacticLoad).not.toHaveBeenCalled();
  } finally { galactic.destroy(); }
});

test('selecting a nebula loads its bank on demand even while it is out of view', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const frame: PreparedCssVolume['frame'] = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
    originM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 5000 * parsecM],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: .1 * parsecM, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const nebula: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: 'far-nebula', frame, anchors: [],
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
      texturePath: `${axis}.webp`, widthPx: 1, heightPx: 1,
      style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {} };
  const bank: PreparedVolumeDatasets = { schema: 'cssearth-volume-datasets@1', id: 'far-nebula', defaultDataset: 'optical',
    framingRadiusUnits: .25, contextVisibility: 'independent', datasets: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared far nebula', sourceUrl: 'https://example.org/nebula', volume: nebula,
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] };
  const document = new FakeDocument(), stage = document.createElement();
  const loadVolumeDataset = vi.fn((id: string) => Promise.resolve({ payload: bank, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks([{ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }]), loadVolumeDataset });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const far: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2]], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(far, viewport, spatialFrame);
    expect(loadVolumeDataset).not.toHaveBeenCalled();
    expect(mounted.focusBank(bank.id)!.state()).toBeNull();
    expect(mounted.focusBank(bank.id)!.framingRadiusM()).toBe(Math.hypot(1, 1, 1) * frame.metersPerUnit);
    // Focus readiness and dataset selection share the same real loader work.
    const readiness = mounted.focusBank(bank.id)!.load();
    mounted.selectVolumeDataset(bank.id, 'optical');
    expect(loadVolumeDataset).toHaveBeenCalledExactlyOnceWith(bank.id);
    await readiness;
    expect(mounted.focusBank(bank.id)!.state()).not.toBeNull();
    expect(mounted.focusBank(bank.id)!.framingRadiusM()).toBe(.25 * frame.metersPerUnit);
    expect(mounted.focusBank(bank.id)!.state()!.selectedDataset).toBe('optical');
    const failure = new Error('Bank download failed');
    const failed = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
      resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
      ...datasetBanks([{ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }]), loadVolumeDataset: () => Promise.reject(failure) }).mount(document.createElement() as unknown as HTMLElement);
    try {
      await expect(failed.focusBank(bank.id)!.load()).rejects.toBe(failure);
      expect(failed.focusBank(bank.id)!.state()).toBeNull();
      expect(failed.focusBank('unknown')).toBeNull();
    } finally { failed.destroy(); }
  } finally { mounted.destroy(); }
});

test('hidden dataset banks are bounded, active subscriptions pin them, and eviction reloads saved presentation', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const makeBank = (id: string, distancePc: number): PreparedVolumeDatasets => {
    const frame: PreparedCssVolume['frame'] = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      originM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: .1 * parsecM,
      boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
    const prepared = (datasetId: string): PreparedCssVolume => ({ schema: 'cssearth-css-volume@1', id: `${id}-${datasetId}`, frame, anchors: [],
      stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
        texturePath: `${datasetId}/${axis}.webp`, widthPx: 1, heightPx: 1,
        style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
          backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
      resources: ['x', 'y', 'z'].map(axis => ({ path: `${datasetId}/${axis}.webp`, bytes: 1, width: 1, height: 1 })),
      provenance: {}, approximation: {} });
    return { schema: 'cssearth-volume-datasets@1', id, defaultDataset: 'optical', framingRadiusUnits: 1, contextVisibility: 'independent',
      datasets: ['optical', 'infrared'].map(datasetId => ({ id: datasetId, label: datasetId, title: `${datasetId} emission`,
        description: `${id} prepared observation`, sourceUrl: 'https://example.org/nebula', volume: prepared(datasetId),
        brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } })) };
  };
  const banks = [makeBank('near-bank', 50), makeBank('far-bank', 100)], byId = new Map(banks.map(bank => [bank.id, bank]));
  const loadVolumeDataset = vi.fn(async (id: string) => ({ payload: byId.get(id)!, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const document = new FakeDocument(), stage = document.createElement();
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks(banks.map(bank => ({ id: bank.id, frame: bank.datasets[0]!.volume.frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }))), loadVolumeDataset,
    warmVolumeDatasetDomNodeBudget: 0 });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    mounted.selectVolumeDataset('near-bank', 'infrared');
    const releaseNear = mounted.focusBank('near-bank')!.subscribe(() => {});
    await vi.waitFor(() => expect(mounted.focusBank('near-bank')!.state()).not.toBeNull());
    const camera = (distancePc: number): WorldCameraPose => ({ referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
        orientationXyzw: [0, 0, 0, 1] } });
    mounted.publish(camera(52), viewport, spatialFrame);
    mounted.publish(camera(102), viewport, spatialFrame);
    await vi.waitFor(() => expect(mounted.focusBank('far-bank')!.state()).not.toBeNull());
    mounted.publish(camera(102), viewport, spatialFrame);
    expect(mounted.focusBank('near-bank')!.state()).not.toBeNull();
    expect((mounted.root as unknown as FakeElement).dataset).toMatchObject({ volumeDatasetPinnedBankCount: '1', volumeDatasetWarmDomNodeBudget: '0' });

    releaseNear();
    expect(mounted.focusBank('near-bank')!.state()).toBeNull();
    expect((mounted.root as unknown as FakeElement).dataset.volumeDatasetWarmDomNodes).toBe('0');

    const releaseReloaded = mounted.focusBank('near-bank')!.subscribe(() => {});
    await vi.waitFor(() => expect(mounted.focusBank('near-bank')!.state()).not.toBeNull());
    expect(mounted.focusBank('near-bank')!.state()).toMatchObject({ selectedDataset: 'infrared', starsVisible: false });
    expect(loadVolumeDataset.mock.calls.filter(([id]) => id === 'near-bank')).toHaveLength(2);
    releaseReloaded();
    expect(mounted.focusBank('near-bank')!.state()).toBeNull();

    // A hidden, unpinned explicit load is trimmed when it settles; eviction does
    // not need another camera publication to enforce the warm budget.
    mounted.selectVolumeDataset('near-bank', 'optical');
    await vi.waitFor(() => expect(loadVolumeDataset.mock.calls.filter(([id]) => id === 'near-bank')).toHaveLength(3));
    await loadVolumeDataset.mock.results.at(-1)!.value; await Promise.resolve(); await Promise.resolve();
    expect(mounted.focusBank('near-bank')!.state()).toBeNull();
    expect((mounted.root as unknown as FakeElement).dataset.volumeDatasetWarmDomNodes).toBe('0');
  } finally { mounted.destroy(); }
});

/** Ordinary source-over through the actual DOM opacity levels. */
function completedPixel(host: FakeElement, image: FakeElement, sky: FakeElement | undefined, volumeValue: number, skyValue = volumeValue): number {
  const t = Number(host.style.opacity), g = Number(image.style.opacity || '1');
  const foregroundAlpha = t * (host.style.background === '#000' ? 1 : g);
  const underlay = sky?.style.visibility === 'visible' ? skyValue * Number(sky.style.opacity || '1') : 0;
  return t * g * volumeValue + (1 - foregroundAlpha) * underlay;
}

test('authoritative detailed close-up gates background fetch, painting and publication without changing the NASA sky weight', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  context.volume.opacityProfile = { model: 'logarithmic-distance', fadeStartDistanceM: 1e19, fullDistanceM: 1e21, nearOpacity: 0, fullOpacity: 1 };
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const frame: PreparedCssVolume['frame'] = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
    originM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 450 * parsecM],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: .1 * parsecM, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const small: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: 'small', frame, anchors: [],
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
      texturePath: `${axis}.webp`, widthPx: 1, heightPx: 1,
      style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, bytes: 1, width: 1, height: 1 })), provenance: {}, approximation: {} };
  const bank = (id: string): PreparedVolumeDatasets => ({ schema: 'cssearth-volume-datasets@1', id, defaultDataset: 'optical',
    framingRadiusUnits: 1, contextVisibility: 'independent', datasets: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared fixture', sourceUrl: 'https://example.org/nebula', volume: { ...small, id },
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] });
  const banks = ['focus-bank', 'warm-bank', 'cold-bank'].map(bank);
  const image: PreparedCssImageLayers = { ...small, id: 'image-bank', bankViews: small.stacks.map(stack => ({ axis: stack.axis,
    normalUnits: stack.axis === 'x' ? [1, 0, 0] : stack.axis === 'y' ? [0, 1, 0] : [0, 0, 1], samplingStepUnits: 1 })) };
  const loadVolumeDataset = vi.fn(async (id: string) => ({ payload: banks.find(bank => bank.id === id)!, resolveResource: (path: string) => `/bank/${id}/${path}` }));
  const loadImageLayer = vi.fn(async () => ({ payload: image, resolveResource: (path: string) => `/image/${path}` }));
  catalogMount.mockReturnValue({ destroy() {}, select() {}, resolve: (id: string) => ({ id, detailedObjectId: id === 'catalogue-only' ? undefined : id.replace('catalogue:', '') }), publish() {}, inspect() {} });
  const document = new FakeDocument(), stage = document.createElement();
  const fetchResource = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1])));
  Object.assign(document.defaultView, { fetch: fetchResource });
  const mounted = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks(banks.map(bank => ({ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }))), loadVolumeDataset,
    imageLayerBanks: [{ id: image.id, frame }], loadImageLayer, catalog: { payload: {}, fadeStartDistanceM: 10, fullDistanceM: 20 },
  }).mount(stage as unknown as HTMLElement);
  const root = mounted.root as unknown as FakeElement;
  const findBank = (id: string) => root.children.find(node => node.dataset.volumeDatasetObject === id)!;
  const mw = root.children.find(node => node.className === 'prepared-volume-context')!;
  const sky = root.children.find(node => node.className === 'prepared-celestial-sky')!;
  const focus = (id = 'catalogue:focus-bank'): PreparedNavigationFocus => ({ id, positionM: frame.originM, framingRadiusM: frame.metersPerUnit,
    limits: { minimumDistanceM: .01 * frame.metersPerUnit, maximumDistanceM: 1e25 } });
  const camera = (radii: number): WorldCameraPose => ({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: [frame.originM[0], frame.originM[1], frame.originM[2] + radii * frame.metersPerUnit], orientationXyzw: [0, 0, 0, 1] } });
  try {
    await mounted.focusBank('focus-bank')!.load(); await mounted.focusBank('warm-bank')!.load();
    mounted.selectGalaxy('catalogue:focus-bank', focus());
    const near = camera(6.1), savedPose = structuredClone(near);
    mounted.publish(near, viewport, spatialFrame);
    expect(loadVolumeDataset.mock.calls.map(([id]) => id)).toEqual(['focus-bank', 'warm-bank']);
    expect(loadImageLayer).not.toHaveBeenCalled(); expect(fetchResource).not.toHaveBeenCalled();
    expect(findBank('focus-bank').style.display).toBe('none');
    await vi.waitFor(() => {
      mounted.publish(near, viewport, spatialFrame);
      expect(findBank('focus-bank').style.display).toBe('block');
    });
    expect(findBank('warm-bank').style.display).toBe('none'); expect(mw.style.display).toBe('none');
    expect(near).toEqual(savedPose);
    const all = (node: FakeElement): FakeElement[] => [node, ...node.children.flatMap(all)];
    expect(all(findBank('warm-bank')).some(node => node.style.backgroundImage)).toBe(false);
    for (const [radii, multiplier] of [[6.1, 0], [20, .5], [32, 1]] as const) {
      mounted.publish(camera(radii), viewport, spatialFrame);
      if (radii > 8) { await mounted.focusBank('cold-bank')!.load(); await mounted.focusBank(image.id)!.load(); mounted.publish(camera(radii), viewport, spatialFrame); }
      const originalOpacity = Number(mw.dataset.volumeOpacity), alpha = Number(mw.style.opacity);
      expect(originalOpacity).toBeGreaterThan(0); expect(originalOpacity).toBeLessThan(1);
      const completedContribution = originalOpacity;
      expect(alpha).toBeCloseTo(completedContribution * multiplier, 12);
      expect((1 - alpha) * Number(sky.style.opacity)).toBeCloseTo(1 - completedContribution, 12);
      expect(Number(sky.dataset.skyContribution)).toBeCloseTo(1 - completedContribution, 12);
      if (multiplier > 0) await vi.waitFor(() => {
        mounted.publish(camera(radii), viewport, spatialFrame);
        expect(Number(findBank('warm-bank').style.opacity)).toBeGreaterThan(0);
      });
      const selectedOpacity = Number(findBank('focus-bank').style.opacity);
      expect(selectedOpacity).toBeGreaterThan(0);
      expect(Number(findBank('warm-bank').style.opacity)).toBeCloseTo(multiplier * selectedOpacity, 12);
    }
    const imageRoot = root.children.find(node => node.dataset.imageLayerObject === image.id)!;
    mounted.publish(near, viewport, spatialFrame);
    expect(imageRoot.style.display).toBe('none');
    const before = all(findBank('warm-bank')).map(node => ({ ...node.style }));
    mounted.publish({ ...near, pose: { ...near.pose, orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2] } }, viewport, spatialFrame);
    expect(all(findBank('warm-bank')).map(node => ({ ...node.style }))).toEqual(before);
    mounted.selectGalaxy('catalogue:image-bank', focus('catalogue:image-bank')); mounted.publish(near, viewport, spatialFrame);
    expect(imageRoot.style.display).toBe(''); expect(findBank('focus-bank').style.display).toBe('none');
    mounted.selectGalaxy(null); mounted.publish(near, viewport, spatialFrame);
    expect(mw.style.display).toBe('');
    await vi.waitFor(() => {
      mounted.publish(near, viewport, spatialFrame);
      expect(findBank('focus-bank').style.display).toBe('block');
    });
    mounted.selectGalaxy('catalogue-only', focus('catalogue-only')); mounted.publish(near, viewport, spatialFrame);
    expect(mw.style.display).toBe('');
    expect(() => mounted.selectGalaxy('catalogue:focus-bank', focus('mismatch'))).toThrow('focus');
  } finally { mounted.destroy(); }
});
