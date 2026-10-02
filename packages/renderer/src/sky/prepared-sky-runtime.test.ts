import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { type PreparedCssSky, type DensityVolumeFrame, type PreparedCssVolume, type PreparedCssImageLayers, type PreparedVolumeDatasets, type WorldCameraPose } from '@cssearth/objects';

import { stubGlobal, unstubAllGlobals, waitFor } from '@cssearth/objects/node/contract';

// linkedom has no layout delivery; caption geometry has explicit observer tests.
beforeEach(() => stubGlobal('ResizeObserver', class {
  observe() {} unobserve() {} disconnect() {}
}));

beforeEach(() => stubGlobal('Image', class {
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

const spatialFrame = { id: 1, baseId: 0, members: new Uint32Array(), updates: [], emphasizedId: null, otherSystems: 1, opacity: 1, width: 800, height: 600 };
const spatialPublish = mock.fn(() => {});
const catalogMount = mock.fn((): unknown => undefined);
const foregroundRects = [{ left: 100, top: 100, right: 150, bottom: 114 }];
// These unrelated layers keep their normal publication contract; the test mounts
// the actual universe, sky and volume compositor without building a star catalogue.
mock.module('../universe/world-context/world-context-point-source.js', { namedExports: { mountWorldContextPointSource: () => null } });
mock.module('../universe/prepared-galaxy-catalog.js', { namedExports: { mountPreparedGalaxyCatalog: catalogMount } });
mock.module('../universe/prepared-world-context.js', { namedExports: { ...await import('../universe/prepared-world-context.js'),
  mountPreparedWorldContext: () => ({ publish: spatialPublish, inspect: () => [], opacityStats: () => ({}), publicationStats: () => ({}), selectObject() {}, plainStarPlaces: () => [], setOverview() {}, setSystemRetired() {}, setBodyVisibility() {}, setOutsideGalaxy() {}, backgroundExclusionRects: () => foregroundRects, bodyLabelRects: () => [], destroy() {} }) } });
// The modules under test import the mocked ones, so they load after the mocks.
const { mountPreparedCssSky, preparedSkyCameraTransform } = await import('./prepared-sky-runtime.js');
const { validatePreparedCssVolume } = await import('@cssearth/objects');
const { preparedVolumeCameraTransform } = await import('../volume/prepared-volume-runtime.js');
const { worldRotationCss } = await import('@cssearth/engine');
const { createPreparedUniverse } = await import('../universe/prepared-universe-runtime.js');
const { logarithmicFade } = await import('../universe/world-context/context-scale.js');
const { readCanonicalPointField } = await import('../../test/canonical-point-field-fixture.js');
const { parseDatasetBillboards } = await import('@cssearth/objects');

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
afterEach(() => { unstubAllGlobals(); catalogMount.mock.resetCalls(); });

test('cold bootstrap keeps catalogue and image banks descriptor-only, then reuses their first navigation load', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const image: PreparedCssImageLayers = { ...volume, id: 'lazy-image', bankViews: volume.stacks.map(stack => ({ axis: stack.axis,
    normalUnits: stack.axis === 'x' ? [1, 0, 0] : stack.axis === 'y' ? [0, 1, 0] : [0, 0, 1], samplingStepUnits: 1 })) };
  const loadImageLayer = mock.fn(async () => ({ payload: image, resolveResource: (path: string) => `/image/${path}` }));
  const catalogRuntime = { destroy: mock.fn(() => {}), select: mock.fn(() => {}), highlight: mock.fn(() => {}), resolve: mock.fn(() => {}), publish: mock.fn(() => {}), inspect: mock.fn(() => ({ count: 0 })) };
  catalogMount.mock.mockImplementation(() => catalogRuntime);
  const loadCatalog = mock.fn(async () => ({ payload: {}, fadeStartDistanceM: 10, fullDistanceM: 20 }));
  const document = new FakeDocument(), stage = document.createElement();
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    imageLayerBanks: [{ id: image.id, frame: image.frame }], loadImageLayer,
    catalogBank: { fadeStartDistanceM: 10, fullDistanceM: 20 }, loadCatalog });
  const mounted = universe.mount(stage as unknown as HTMLElement), root = mounted.root as unknown as FakeElement;
  assert.equal(loadImageLayer.mock.callCount(), 0); assert.equal(loadCatalog.mock.callCount(), 0);
  assert.partialDeepStrictEqual(root.dataset, { imageLayerDeclaredBankCount: '1', imageLayerResidentBankCount: '0', catalogResident: 'false' });
  await Promise.all([mounted.ensureGalaxyCatalog(), mounted.ensureGalaxyCatalog(), mounted.focusBank(image.id)!.load(), mounted.focusBank(image.id)!.load()]);
  assert.equal(loadCatalog.mock.callCount(), 1); assert.equal(loadImageLayer.mock.callCount(), 1); assert.equal(catalogMount.mock.callCount(), 1);
  assert.partialDeepStrictEqual(root.dataset, { imageLayerResidentBankCount: '1', imageLayerLoadingBankCount: '0', catalogResident: 'true', catalogLoading: 'false' });
  await mounted.ensureGalaxyCatalog(); await mounted.focusBank(image.id)!.load();
  assert.equal(loadCatalog.mock.callCount(), 1); assert.equal(loadImageLayer.mock.callCount(), 1);
  mounted.destroy(); assert.equal(catalogRuntime.destroy.mock.callCount(), 1);
});

test('the galaxy is its bulge slices at every overview scope, with no disc plane and no impostor views', () => {
  const base = new URL('../../../../src/', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const document = new FakeDocument();
  const mounted = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}` }).mount(document.createElement() as unknown as HTMLElement);
  try {
    const root = mounted.root as unknown as FakeElement;
    const image = root.children.find(node => node.className === 'prepared-volume-context')!.children[0]!;
    const descendants = (node: FakeElement): FakeElement[] => node.children.flatMap(child => [child, ...descendants(child)]);
    assert.equal(volume.impostors, undefined, 'the prepared galaxy carries no impostor views');
    const radiusM = Math.hypot(...volume.frame.boundsUnits.max) * volume.frame.metersPerUnit;
    const camera: WorldCameraPose = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      pose: { positionM: [volume.frame.originM[0], volume.frame.originM[1], volume.frame.originM[2] + 2.5 * radiusM], orientationXyzw: [0, 0, 0, 1] } };
    for (const scope of ['local-group', 'milky-way', 'system', 'milky-way', undefined]) {
      mounted.setOverview(scope !== undefined, scope);
      mounted.publish(camera, viewport, spatialFrame);
      const nodes = descendants(image);
      assert.equal(nodes.filter(node => node.dataset.volumeImpostor !== undefined).length, 0);
      assert.equal(nodes.some(node => node.className === 'css-volume-camera'), true);
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
  }) }, resolveResource = mock.fn((path: string) => `/prepared/${path}`);
  const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11], widthPixels: 1280, heightPixels: 800 } as const;
  const runtime = mountPreparedCssSky({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resources, resolveResource });
  const root = runtime.root as unknown as FakeElement, camera = root.children[0]!, scene = camera.children[0]!, leaves = [...scene.children];
  const count = document.count;
  assert.deepEqual(leaves.map(leaf => leaf.dataset.skyFace), bases.map(([id]) => id));
  // A face fetches nothing until it enters the view; the camera sees at most three of the six.
  assert.deepEqual(leaves.map(leaf => [leaf.style.visibility, leaf.style.backgroundImage ?? '']), leaves.map(() => ['hidden', '']));
  const url = (index: number) => `url("/prepared/${payload.faces[index]!.texturePath}")`;
  runtime.publish(world(), viewport); const initial = scene.style.transform;
  const firstView = leaves.map(leaf => leaf.style.visibility !== 'hidden');
  assert.ok(firstView.filter(Boolean).length > 0); assert.ok(firstView.filter(Boolean).length <= 3);
  leaves.forEach((leaf, index) => assert.equal((leaf.style.backgroundImage ?? ''), firstView[index] ? url(index) : ''));
  const styles = leaves.map(leaf => ({ ...leaf.style }));
  runtime.publish(world([1e25, -2e25, 3e25]), viewport); assert.equal(scene.style.transform, initial);
  runtime.publish(world([0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]), viewport); assert.notEqual(scene.style.transform, initial);
  assert.equal(camera.style.perspectiveOrigin, 'calc(50% + 17px) calc(50% + -11px)');
  assert.equal(root.style.opacity, undefined); assert.equal(root.style.transformStyle, 'flat');
  for (const node of [camera, scene]) { assert.equal(node.style.transformStyle, 'preserve-3d'); assert.equal(node.style.opacity, undefined); }
  runtime.publish(world(), viewport, false); assert.equal(root.style.visibility, 'hidden');
  runtime.publish(world(), viewport); assert.equal(scene.style.transform, initial);
  assert.equal(document.count, count); assert.deepEqual(scene.children, leaves);
  // Back at the first view, the faces it shows are exactly as they were; a face the rotation revealed keeps its image.
  leaves.forEach((leaf, index) => { if (firstView[index]) assert.deepEqual(leaf.style, styles[index]); });
  assert.equal(resolveResource.mock.callCount(), 6);
  leaves.forEach((leaf, index) => assert.partialDeepStrictEqual(leaf.style, payload.faces[index]!.style));
  assert.ok(leaves.filter(leaf => leaf.style.backgroundImage).length > firstView.filter(Boolean).length);
  assert.throws(() => runtime.publish({ ...world(), referenceFrame: 'different' }, viewport), /reference frames/);
  assert.throws(() => runtime.publish({ ...world(), epochJdTt: 124 }, viewport), /reference frames/);
  runtime.destroy(); runtime.destroy(); runtime.publish(world(), viewport); assert.deepEqual(host.children, [before]);
});

test('sky and volume project ICRF directions identically, with CSS y down', () => {
  const frame: PreparedCssVolume['frame'] = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  for (const quaternion of [[0, 0, 0, 1], [0, Math.SQRT1_2, 0, Math.SQRT1_2], [.5, .5, .5, .5]] as const) {
    const pose = world([0, 0, 0], quaternion), volume = preparedVolumeCameraTransform({ world: pose, viewport }, frame);
    assert.equal(preparedSkyCameraTransform(pose, viewport), `translate3d(17px,-11px,600px) ${worldRotationCss(volume.rotation)}`);
  }
  // Independent cardinal proof: the identity pose looks down ICRF -z with +x right and +y up, so a prepared vertex written as
  // CSS [y,x,z] = [2,1,-3] (ICRF [1,2,-3], ahead, right and up) lands at eye [1,-2,-3]: right, and up on a y-down screen.
  const css = preparedSkyCameraTransform(world(), viewport).split('matrix3d(')[1]!.slice(0, -1).split(',').map(Number);
  assert.deepEqual(([css[0]! * 2 + css[4]! * 1, css[1]! * 2 + css[5]! * 1, css[10]! * -3]), [1, -2, -3]);
  assert.throws(() => preparedSkyCameraTransform(world(), { ...viewport, focalPixels: Infinity }));
  assert.throws(() => preparedSkyCameraTransform(world([0, 0, 0], [0, 0, 0, 2]), viewport));
});

test('optional sky is validated as part of the existing volume capability and shared resource bank', () => {
  const volume = JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way-volume/prepared/volume.json', import.meta.url), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const withSky = { ...volume, sky, resources: [...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...resources] };
  assert.deepEqual(validatePreparedCssVolume(withSky).sky, sky);
  assert.throws(() => validatePreparedCssVolume({ ...withSky, sky: { ...sky, epochJdTt: sky.epochJdTt + 1 } }), /reference frame/);
  const { sky: _sky, ...legacy } = withSky; assert.equal(validatePreparedCssVolume(legacy).sky, undefined);
});

test('near star cube is fully handed off before solar-system parallax produces duplicate stars', () => {
  const source = JSON.parse(readFileSync(new URL('../../../../src/objects/sun/source/navigation/universe.json', import.meta.url), 'utf8'));
  const astronomicalUnitM = 149_597_870_700;
  assert.equal(source.stars.fadeStartDistanceM, 100 * astronomicalUnitM);
  assert.equal(source.stars.fullDistanceM, 200 * astronomicalUnitM);
  assert.equal(logarithmicFade(591.27 * astronomicalUnitM, source.stars.fadeStartDistanceM, source.stars.fullDistanceM), 1);
});

for (const { withSky } of [{ withSky: true }, { withSky: false }]) test(`nearer than the disc's half-height the NASA band is the sky; from twice that the galaxy volume is (sky=$withSky)`, () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const { sky: _originalSky, ...volumeWithoutSky } = volume;
  const data = { ...volumeWithoutSky, ...(withSky ? { sky } : {}), resources: [
    ...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...(withSky ? resources : []),
  ] };
  const stars = readCanonicalPointField();
  const document = new FakeDocument(), stage = document.createElement(), detail = document.createElement(); stage.appendChild(detail);
  const universe = createPreparedUniverse({ context, volume: data, pointAppearance: stars, resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`, sprites: {} });
  assert.equal(universe.assets.entries.filter(entry => entry.key.includes(':sky/')).length, withSky ? 6 : 0);
  // No sky face decodes at startup: each loads when it first enters the view.
  assert.deepEqual(universe.assets.startup, []);
  const mounted = universe.mount(stage as unknown as HTMLElement), root = mounted.root as unknown as FakeElement;
  const skyRoot = root.children.find(node => node.className === 'prepared-celestial-sky')!, volumeRoot = root.children.find(node => node.className === 'prepared-volume-context')!;
  const volumeImage = volumeRoot.children.find(node => node.className === 'prepared-volume-image')!;
  // The opaque backdrop and its image layer fill the root by stylesheet (volume.css): only the host's display is inline,
  // and neither declares the transform style they have by default (flat).
  assert.deepEqual({ ...volumeRoot.style }, { display: 'none' });
  assert.ok(readFileSync(new URL('../styles/volume.css', import.meta.url), 'utf8').includes('.prepared-volume-context { background: #000; }'));
  assert.equal(volumeImage.style.transformStyle, undefined);
  // The galaxy is its bulge slices, mounted directly: it has no impostor views to hand off to.
  assert.equal(volumeImage.children.some(node => node.className === 'css-volume-impostors'), false);
  assert.equal(volumeImage.children.filter(node => node.className === 'css-volume-projection').length, 3);
  const count = document.count, originalNodes = [...root.children];
  if (withSky) assert.ok(root.children.indexOf(skyRoot) < root.children.indexOf(volumeRoot));
  else assert.equal(skyRoot, undefined);
  assert.equal(root.children.some(node => node.className === 'stellar-direct-points'), false, 'the Sun draws no star layer of its own');
  // The camera `reach` disc half-heights from the body it looks at, in any direction: orbiting never changes the answer.
  const at = (reach: number, axis = 2): WorldCameraPose => ({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
    pose: { positionM: context.focus.positionM.map((n: number, index: number) => n + (index === axis ? reach * context.volume.discHalfHeightM : 0)) as [number, number, number], orientationXyzw: [0, 0, 0, 1] } });
  for (const [reach, outside] of [[.01, 0], [.5, 0], [1, 0], [Math.SQRT2, .5], [2, 1], [4, 1]] as const) {
    for (const axis of [0, 1]) {
      mounted.publish(at(reach, axis), viewport, spatialFrame);
      assert.ok(Math.abs(Number(volumeRoot.dataset.volumeOpacity) - (outside)) < 10 ** -12 / 2, `${Number(volumeRoot.dataset.volumeOpacity)} is not close to ${outside}`);
    }
    const camera = at(reach);
    mounted.publish(camera, viewport, spatialFrame);
    assert.ok(Math.abs(Number(volumeRoot.dataset.volumeOpacity) - (outside)) < 10 ** -12 / 2, `${Number(volumeRoot.dataset.volumeOpacity)} is not close to ${outside}`);
    assert.ok(Math.abs(Number(volumeRoot.style.opacity) - (outside)) < 10 ** -12 / 2, `${Number(volumeRoot.style.opacity)} is not close to ${outside}`);
    if (withSky) {
      assert.equal(skyRoot.style.visibility, outside < 1 ? 'visible' : 'hidden');
      assert.ok(Math.abs(Number(skyRoot.dataset.skyContribution) - (1 - outside)) < 10 ** -12 / 2, `${Number(skyRoot.dataset.skyContribution)} is not close to ${1 - outside}`);
      // The actual DOM source-over equation: the band and the galaxy share one whole weight.
      assert.ok(Math.abs(completedPixel(volumeRoot, volumeImage, skyRoot, .4) - (.4)) < 10 ** -12 / 2, `${completedPixel(volumeRoot, volumeImage, skyRoot, .4)} is not close to ${.4}`);
    } else assert.ok(Math.abs(completedPixel(volumeRoot, volumeImage, undefined, .4) - (.4 * outside)) < 10 ** -12 / 2, `${completedPixel(volumeRoot, volumeImage, undefined, .4)} is not close to ${.4 * outside}`);
    mounted.publish({ ...camera, pose: { ...camera.pose, orientationXyzw: [0, 1, 0, 0] } }, viewport, spatialFrame);
    assert.ok(Math.abs(Number(volumeRoot.style.opacity) - (outside)) < 10 ** -12 / 2, `${Number(volumeRoot.style.opacity)} is not close to ${outside}`);
  }
  assert.equal(document.count, count); assert.deepEqual(root.children, originalNodes);
  mounted.destroy(); assert.deepEqual(stage.children, [detail]); assert.equal(document.defaultView.pending.size, 0);
});

test('a galaxy backing that loads while the camera rests is placed before any layer shows', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const backing = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/backing.json', base), 'utf8'));
  stubGlobal('fetch', async () => new Response(JSON.stringify(backing)));
  const document = new FakeDocument(), stage = document.createElement();
  const mounted = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {}, galaxyBacking: '/backing.json',
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}` }).mount(stage as unknown as HTMLElement);
  const all = (node: FakeElement): FakeElement[] => [node, ...node.children.flatMap(all)];
  try {
    // One frame from 20 kpc out, then the camera rests: no further publication after the backing arrives.
    const camera: WorldCameraPose = { referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 20000 * parsecM], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(camera, viewport, spatialFrame);
    await waitFor(() => assert.equal(all(mounted.root as unknown as FakeElement).filter(node => node.dataset.galaxyBacking).length, 1 + backing.sections.length));
    // Right over the galaxy's own layer, under every later one: its black square never hides what is drawn after it.
    const order = (mounted.root as unknown as FakeElement).children.map(node => node.className);
    assert.equal(order.indexOf('prepared-galaxy-backing'), order.indexOf('prepared-volume-context') + 1);
    for (const layer of all(mounted.root as unknown as FakeElement).filter(node => node.dataset.galaxyBacking)) {
      const scene = all(layer).find(node => node.className === 'css-volume-scene')!;
      assert.match(scene.style.transform, /^translate3d/, 'placed from the latest frame');
      assert.equal(layer.style.display, '');
    }
  } finally { mounted.destroy(); unstubAllGlobals(); }
});

test('a galaxy backing whose ring image cannot resolve mounts no layer at all', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const backing = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/backing.json', base), 'utf8'));
  stubGlobal('fetch', async () => new Response(JSON.stringify(backing)));
  const failed = mock.method(console, 'error', () => {});
  const document = new FakeDocument(), stage = document.createElement();
  const mounted = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {}, galaxyBacking: '/backing.json',
    resolveResource: path => { if (path === 'backing/middle.webp') throw new Error(`Prepared context resource unavailable: ${path}.`); return `/volume/${path}`; },
    resolvePointResource: path => `/stars/${path}` }).mount(stage as unknown as HTMLElement);
  const all = (node: FakeElement): FakeElement[] => [node, ...node.children.flatMap(all)];
  try {
    mounted.publish({ referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 20000 * parsecM], orientationXyzw: [0, 0, 0, 1] } }, viewport, spatialFrame);
    await waitFor(() => assert.ok(failed.mock.callCount() > 0));
    assert.equal(all(mounted.root as unknown as FakeElement).filter(node => node.dataset.galaxyBacking).length, 0, 'no stranded, unplaced plane');
  } finally { mounted.destroy(); failed.mock.restore(); unstubAllGlobals(); }
});

test('shared universe draws only resolved nebulae and never prefetches their datasets with the galaxy', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
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
  const fetchResource = mock.fn<typeof fetch>(async () => new Response(new Uint8Array([1])));
  Object.assign(document.defaultView, { fetch: fetchResource });
  // Loading a bank's prepared payload (all its datasets and catalogue points) is deferred, one bank at
  // a time, exactly like loadShells defers a surface shell: nothing here is fetched until a bank is
  // either selected or first comes close enough to draw.
  const loadVolumeDataset = mock.fn((id: string) => Promise.resolve({ payload: banksById.get(id)!,
    resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks(banks.map(payload => ({ id: payload.id, frame: payload.datasets[0]!.volume.frame, contextVisibility: payload.contextVisibility, attachedTo: payload.attachedTo }))), loadVolumeDataset });
  // Declaring a bank must not fetch it: the whole point of deferring it is that the first frame never pays for it.
  assert.equal(loadVolumeDataset.mock.callCount(), 0);
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
    assert.equal(loadVolumeDataset.mock.callCount(), 0);
    assert.equal(findBank(bank.id), undefined);
    assert.equal(findBank('galactic-default'), undefined);
    // A 0.1 pc radius spans 30 px at 2 pc and 1.25 px at 48 pc, using the default visibility thresholds.
    for (const [distancePc, visible] of [[98, false], [52, true], [98, false], [52, true]] as const) {
      const camera: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
        pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
          orientationXyzw: [0, 0, 0, 1] } };
      mounted.publish(camera, viewport, spatialFrame);
      // The first crossing into view fetches the independent bank; give its promise a turn to resolve and
      // mount before reading the DOM. The galactic bank's prepared context visibility keeps it unfetched.
      if (visible && !findBank(bank.id)) {
        await waitFor(() => { assert.notEqual(findBank(bank.id), undefined); });
        mounted.publish(camera, viewport, spatialFrame);
      }
      assert.equal(milkyWay.dataset.volumeOpacity, '0');
      assert.equal(milkyWay.style.display, 'none');
      const galactic = findBank('galactic-default');
      const independent = findBank(bank.id);
      if (!visible && !independent) continue; // not yet fetched: the first (invisible) distance, nothing to check
      assert.notEqual(independent, undefined);
      if (visible) await waitFor(() => {
        mounted.publish(camera, viewport, spatialFrame);
        assert.equal(independent!.style.opacity, '1');
      });
      assert.equal(independent!.style.opacity, visible ? '1' : '0');
      assert.equal(independent!.style.display, visible ? 'block' : 'none');
      // The galactic bank has the same silhouette but fades with the galaxy, which is zero here: its datasets are
      // neither drawn nor fetched.
      assert.equal(galactic, undefined);
      if (visible) {
        const cloud = independent!.children.find(node => node.className === 'prepared-volume-dataset-cloud')!;
        const axes = cloud.children.filter(node => node.className === 'css-volume-projection');
        assert.equal(axes.length, 3);
        assert.ok(Number(independent!.dataset.cloudOpacity) > 0);
        assert.equal(axes.some(axis => axis.style.visibility === 'visible' && Number(axis.style.opacity) > 0), true);
        assert.deepEqual(([...new Set(images(independent!))]), ['url("/nebula/nearby-nebula/z.webp")']);
      }
    }
    assert.equal(loadVolumeDataset.mock.callCount(), 1); assert.deepEqual(loadVolumeDataset.mock.calls[0]!.arguments, [bank.id]);
    // Trigger the actual universe warm-up: it must finish without any nebula
    // URL, even for legacy banks with no distant-image payload or leaf bounds.
    mounted.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1],
        context.focus.positionM[2] + context.volume.fullDistanceM * 2], orientationXyzw: [0, 0, 0, 1] } }, viewport, spatialFrame);
    const skyPaths = new Set((volume.sky?.faces ?? []).map(face => face.texturePath));
    const expected = volume.resources.filter(resource => !skyPaths.has(resource.path)).map(resource => `/volume/${resource.path}`);
    await waitFor(() => assert.equal(fetchResource.mock.callCount(), expected.length));
    assert.deepEqual(fetchResource.mock.calls.map(({ arguments: [url] }) => url), expected);
    // The galaxy warm-up prefetches the Milky Way's own resources only; it must never load a dataset bank
    // beyond the one already fetched by proximity above.
    assert.equal(loadVolumeDataset.mock.callCount(), 1);
  } finally { mounted.destroy(); }
  assert.deepEqual(stage.children, []);
  assert.equal(document.defaultView.pending.size, 0);
});

test('an unloaded independent bank is fetched by proximity while the galactic fade is zero; a galactic one waits for the galaxy', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
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
  const loadVolumeDataset = mock.fn((id: string) => Promise.resolve({ payload: bank, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
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
    assert.equal(milkyWay.dataset.volumeOpacity, '0');
    assert.equal(loadVolumeDataset.mock.callCount(), 1); assert.deepEqual(loadVolumeDataset.mock.calls[0]!.arguments, [bank.id]);
  } finally { mounted.destroy(); }
  // The same bank, prepared as fading with the galaxy, is not fetched while the galaxy is faded out.
  const galacticLoad = mock.fn(loadVolumeDataset);
  const galactic = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks([{ id: bank.id, frame, contextVisibility: 'galactic' }]), loadVolumeDataset: galacticLoad }).mount(document.createElement() as unknown as HTMLElement);
  try {
    galactic.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 52 * parsecM], orientationXyzw: [0, 0, 0, 1] } }, viewport, spatialFrame);
    assert.equal(galacticLoad.mock.callCount(), 0);
  } finally { galactic.destroy(); }
});

test('selecting a nebula loads its bank on demand even while it is out of view', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
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
  const loadVolumeDataset = mock.fn((id: string) => Promise.resolve({ payload: bank, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks([{ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }]), loadVolumeDataset });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const far: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2]], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(far, viewport, spatialFrame);
    assert.equal(loadVolumeDataset.mock.callCount(), 0);
    assert.equal(mounted.focusBank(bank.id)!.state(), null);
    assert.equal(mounted.focusBank(bank.id)!.framingRadiusM(), Math.hypot(1, 1, 1) * frame.metersPerUnit);
    // Focus readiness and dataset selection share the same real loader work.
    const readiness = mounted.focusBank(bank.id)!.load();
    mounted.selectVolumeDataset(bank.id, 'optical');
    assert.equal(loadVolumeDataset.mock.callCount(), 1); assert.deepEqual(loadVolumeDataset.mock.calls[0]!.arguments, [bank.id]);
    await readiness;
    assert.notEqual(mounted.focusBank(bank.id)!.state(), null);
    assert.equal(mounted.focusBank(bank.id)!.framingRadiusM(), .25 * frame.metersPerUnit);
    assert.equal(mounted.focusBank(bank.id)!.state()!.selectedDataset, 'optical');
    const failure = new Error('Bank download failed');
    const failed = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
      resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
      ...datasetBanks([{ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }]), loadVolumeDataset: () => Promise.reject(failure) }).mount(document.createElement() as unknown as HTMLElement);
    try {
      await assert.rejects(failed.focusBank(bank.id)!.load(), (error: unknown) => error === failure);
      assert.equal(failed.focusBank(bank.id)!.state(), null);
      assert.equal(failed.focusBank('unknown'), null);
    } finally { failed.destroy(); }
  } finally { mounted.destroy(); }
});

test('hidden dataset banks are bounded, active subscriptions pin them, and eviction reloads saved presentation', async () => {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
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
  const loadVolumeDataset = mock.fn(async (id: string) => ({ payload: byId.get(id)!, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const document = new FakeDocument(), stage = document.createElement();
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks(banks.map(bank => ({ id: bank.id, frame: bank.datasets[0]!.volume.frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }))), loadVolumeDataset,
    warmVolumeDatasetDomNodeBudget: 0 });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    mounted.selectVolumeDataset('near-bank', 'infrared');
    const releaseNear = mounted.focusBank('near-bank')!.subscribe(() => {});
    await waitFor(() => assert.notEqual(mounted.focusBank('near-bank')!.state(), null));
    const camera = (distancePc: number): WorldCameraPose => ({ referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
        orientationXyzw: [0, 0, 0, 1] } });
    mounted.publish(camera(52), viewport, spatialFrame);
    mounted.publish(camera(102), viewport, spatialFrame);
    await waitFor(() => assert.notEqual(mounted.focusBank('far-bank')!.state(), null));
    mounted.publish(camera(102), viewport, spatialFrame);
    assert.notEqual(mounted.focusBank('near-bank')!.state(), null);
    assert.partialDeepStrictEqual((mounted.root as unknown as FakeElement).dataset, { volumeDatasetPinnedBankCount: '1', volumeDatasetWarmDomNodeBudget: '0' });

    releaseNear();
    assert.equal(mounted.focusBank('near-bank')!.state(), null);
    assert.equal((mounted.root as unknown as FakeElement).dataset.volumeDatasetWarmDomNodes, '0');

    const releaseReloaded = mounted.focusBank('near-bank')!.subscribe(() => {});
    await waitFor(() => assert.notEqual(mounted.focusBank('near-bank')!.state(), null));
    assert.partialDeepStrictEqual(mounted.focusBank('near-bank')!.state(), { selectedDataset: 'infrared', starsVisible: false });
    assert.equal(loadVolumeDataset.mock.calls.filter(({ arguments: [id] }) => id === 'near-bank').length, 2);
    releaseReloaded();
    assert.equal(mounted.focusBank('near-bank')!.state(), null);

    // A hidden, unpinned explicit load is trimmed when it settles; eviction does
    // not need another camera publication to enforce the warm budget.
    mounted.selectVolumeDataset('near-bank', 'optical');
    await waitFor(() => assert.equal(loadVolumeDataset.mock.calls.filter(({ arguments: [id] }) => id === 'near-bank').length, 3));
    await loadVolumeDataset.mock.calls.at(-1)!.result; await Promise.resolve(); await Promise.resolve();
    assert.equal(mounted.focusBank('near-bank')!.state(), null);
    assert.equal((mounted.root as unknown as FakeElement).dataset.volumeDatasetWarmDomNodes, '0');
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
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const base = new URL('../../../../src/', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  context.volume.opacityProfile = { model: 'logarithmic-distance', fadeStartDistanceM: 1e19, fullDistanceM: 1e21, nearOpacity: 0, fullOpacity: 1 };
  // The galaxy's volume is gated by the distance to the selected body, as for every body: the close-up is mid-fade.
  context.volume.discHalfHeightM = .5 * parsecM;
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way-volume/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
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
  // Each package the host draws is a body of the world context; one of them has no bank of its own.
  const nebula = context.bodies.find((body: { id: string }) => body.id === 'm1');
  // The galaxy stands apart from the nebulae: a body inside a galaxy's framing sphere draws that galaxy's dots.
  const imageFrame = { ...frame, originM: [frame.originM[0] + 100 * frame.metersPerUnit, frame.originM[1], frame.originM[2]] as [number, number, number] };
  for (const id of ['focus-bank', 'image-bank', 'no-bank']) context.bodies.push({ ...nebula, id, name: id,
    positionM: id === 'image-bank' ? imageFrame.originM : frame.originM, radiusM: frame.metersPerUnit });
  const image: PreparedCssImageLayers = { ...small, frame: imageFrame, id: 'image-bank', bankViews: small.stacks.map(stack => ({ axis: stack.axis,
    normalUnits: stack.axis === 'x' ? [1, 0, 0] : stack.axis === 'y' ? [0, 1, 0] : [0, 0, 1], samplingStepUnits: 1 })) };
  const loadVolumeDataset = mock.fn(async (id: string) => ({ payload: banks.find(bank => bank.id === id)!, resolveResource: (path: string) => `/bank/${id}/${path}` }));
  const loadImageLayer = mock.fn(async () => ({ payload: image, resolveResource: (path: string) => `/image/${path}` }));
  catalogMount.mock.mockImplementation(() => ({ destroy() {}, select() {}, highlight() {}, resolve: (id: string) => ({ id, detailedObjectId: id === 'no-bank' ? undefined : id.replace('catalogue:', '') }), publish() {}, inspect() {} }));
  const document = new FakeDocument(), stage = document.createElement();
  const fetchResource = mock.fn<typeof fetch>(async () => new Response(new Uint8Array([1])));
  Object.assign(document.defaultView, { fetch: fetchResource });
  const mounted = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    ...datasetBanks(banks.map(bank => ({ id: bank.id, frame, contextVisibility: bank.contextVisibility, attachedTo: bank.attachedTo }))), loadVolumeDataset,
    imageLayerBanks: [{ id: image.id, frame: imageFrame }], loadImageLayer, catalog: { payload: {}, fadeStartDistanceM: 10, fullDistanceM: 20 },
  }).mount(stage as unknown as HTMLElement);
  const root = mounted.root as unknown as FakeElement;
  const findBank = (id: string) => root.children.find(node => node.dataset.volumeDatasetObject === id)!;
  const mw = root.children.find(node => node.className === 'prepared-volume-context')!;
  const sky = root.children.find(node => node.className === 'prepared-celestial-sky')!;
  // A bank package is a body of the world; its scene's dataset shows the bank as its companion.
  let shown: string | null = null;
  const select = (id: string) => {
    if (shown) mounted.setVolumeDatasetEnabled(shown, false);
    shown = mounted.focusBank(id) ? id : null;
    const body = [context.focus, ...context.bodies].find((candidate: { id: string }) => candidate.id === id) as { positionM: [number, number, number]; radiusM: number };
    mounted.selectObject(id, { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: body.positionM,
      presentationToReference: [0, 1, 0, 1, 0, 0, 0, 0, 1], metersPerUnit: body.radiusM, bodyRadiusM: body.radiusM });
    if (shown) mounted.setVolumeDatasetEnabled(shown, true);
  };
  const camera = (radii: number): WorldCameraPose => ({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: [frame.originM[0], frame.originM[1], frame.originM[2] + radii * frame.metersPerUnit], orientationXyzw: [0, 0, 0, 1] } });
  try {
    await mounted.focusBank('focus-bank')!.load(); await mounted.focusBank('warm-bank')!.load();
    select('focus-bank');
    const near = camera(6.1), savedPose = structuredClone(near);
    mounted.publish(near, viewport, spatialFrame);
    assert.deepEqual(loadVolumeDataset.mock.calls.map(({ arguments: [id] }) => id), ['focus-bank', 'warm-bank']);
    assert.equal(loadImageLayer.mock.callCount(), 0); assert.equal(fetchResource.mock.callCount(), 0);
    assert.equal(findBank('focus-bank').style.display, 'none');
    await waitFor(() => {
      mounted.publish(near, viewport, spatialFrame);
      assert.equal(findBank('focus-bank').style.display, 'block');
    });
    assert.equal(findBank('warm-bank').style.display, 'none'); assert.equal(mw.style.display, 'none');
    assert.deepEqual(near, savedPose);
    const all = (node: FakeElement): FakeElement[] => [node, ...node.children.flatMap(all)];
    assert.equal(all(findBank('warm-bank')).some(node => node.style.backgroundImage), false);
    for (const [radii, multiplier] of [[6.1, 0], [20, .5], [32, 1]] as const) {
      mounted.publish(camera(radii), viewport, spatialFrame);
      if (radii > 8) { await mounted.focusBank('cold-bank')!.load(); await mounted.focusBank(image.id)!.load(); mounted.publish(camera(radii), viewport, spatialFrame); }
      const originalOpacity = Number(mw.dataset.volumeOpacity), alpha = Number(mw.style.opacity);
      assert.ok(originalOpacity > 0); assert.ok(radii > 8 ? originalOpacity === 1 : originalOpacity < 1);
      const completedContribution = originalOpacity;
      assert.ok(Math.abs(alpha - (completedContribution * multiplier)) < 10 ** -12 / 2, `${alpha} is not close to ${completedContribution * multiplier}`);
      assert.ok(Math.abs(((1 - alpha) * Number(sky.style.opacity)) - (1 - completedContribution)) < 10 ** -12 / 2, `${((1 - alpha) * Number(sky.style.opacity))} is not close to ${1 - completedContribution}`);
      assert.ok(Math.abs(Number(sky.dataset.skyContribution) - (1 - completedContribution)) < 10 ** -12 / 2, `${Number(sky.dataset.skyContribution)} is not close to ${1 - completedContribution}`);
      if (multiplier > 0) await waitFor(() => {
        mounted.publish(camera(radii), viewport, spatialFrame);
        assert.ok(Number(findBank('warm-bank').style.opacity) > 0);
      });
      const selectedOpacity = Number(findBank('focus-bank').style.opacity);
      assert.ok(selectedOpacity > 0);
      assert.ok(Math.abs(Number(findBank('warm-bank').style.opacity) - (multiplier * selectedOpacity)) < 10 ** -12 / 2, `${Number(findBank('warm-bank').style.opacity)} is not close to ${multiplier * selectedOpacity}`);
    }
    const imageRoot = root.children.find(node => node.dataset.imageLayerObject === image.id)!;
    mounted.publish(near, viewport, spatialFrame);
    assert.equal(imageRoot.style.display, 'none');
    const before = all(findBank('warm-bank')).map(node => ({ ...node.style }));
    mounted.publish({ ...near, pose: { ...near.pose, orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2] } }, viewport, spatialFrame);
    assert.deepEqual(all(findBank('warm-bank')).map(node => ({ ...node.style })), before);
    select('image-bank');
    mounted.publish({ ...near, pose: { ...near.pose, positionM: [imageFrame.originM[0], near.pose.positionM[1], near.pose.positionM[2]] } }, viewport, spatialFrame);
    assert.equal(imageRoot.style.display, ''); assert.equal(findBank('focus-bank').style.display, 'none');
    select(context.focus.id); mounted.publish(near, viewport, spatialFrame);
    assert.equal(mw.style.display, '');
    await waitFor(() => {
      mounted.publish(near, viewport, spatialFrame);
      assert.equal(findBank('focus-bank').style.display, 'block');
    });
    select('no-bank'); mounted.publish(near, viewport, spatialFrame);
    assert.equal(mw.style.display, '');
  } finally { mounted.destroy(); }
});
