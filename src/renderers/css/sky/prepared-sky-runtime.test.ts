import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { mountPreparedCssSky, preparedSkyCameraTransform } from './prepared-sky-runtime.js';
import { validatePreparedCssSky } from './validation.js';
import type { PreparedCssSky } from './types.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { PreparedCssImageLayers } from '../image-layers/loader.js';
import type { PreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import { createPreparedUniverse } from '../universe/prepared-universe-runtime.js';
import { logarithmicFade } from '../universe/prepared-world-context.js';
import { STELLAR_POINTS_MAX_OPACITY } from '../universe/stellar-points.js';
import { readCanonicalPointField } from '../preparation/stars/canonical-point-field-fixture.js';

const spatialPublish = vi.hoisted(() => vi.fn());
const catalogMount = vi.hoisted(() => vi.fn());
const foregroundRects = vi.hoisted(() => [{ left: 100, top: 100, right: 150, bottom: 114 }]);
// These unrelated layers keep their normal publication contract; the test mounts
// the actual universe, sky and volume compositor without building a star catalogue.
vi.mock('../universe/world-context-point-source.js', () => ({ mountWorldContextPointSource: () => null }));
vi.mock('../universe/prepared-galaxy-catalog.js', () => ({ mountPreparedGalaxyCatalog: catalogMount }));
vi.mock('../universe/prepared-world-context.js', async importOriginal => ({ ...await importOriginal<typeof import('../universe/prepared-world-context.js')>(),
  mountPreparedWorldContext: () => ({ publish: spatialPublish, inspect: () => [], opacityStats: () => ({}), publicationStats: () => ({}), selectObject() {}, backgroundExclusionRects: () => foregroundRects, destroy() {} }) }));

const bases = [
  ['px', [1, 0, 0], [0, -1, 0], [0, 0, 1]], ['nx', [-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  ['py', [0, 1, 0], [1, 0, 0], [0, 0, 1]], ['ny', [0, -1, 0], [-1, 0, 0], [0, 0, 1]],
  ['pz', [0, 0, 1], [0, -1, 0], [-1, 0, 0]], ['nz', [0, 0, -1], [0, -1, 0], [1, 0, 0]],
] as const;
const fixture = (): PreparedCssSky => ({ schema: 'cssearth-css-sky@1', referenceFrame: 'fixture', epochJdTt: 123, radiusUnits: 1,
  faces: bases.map(([id, forwardIcrf, rightIcrf, upIcrf]) => ({ id, forwardIcrf, rightIcrf, upIcrf, texturePath: `sky/${id}.webp`, widthPx: 1536, heightPx: 1536,
    style: { width: '100px', height: '100px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-50,-50,-50,1)', backgroundSize: '100px 100px', backgroundPosition: '0px 0px' } })),
  provenance: {}, approximation: {} });
const resources = fixture().faces.map(face => ({ path: face.texturePath, width: face.widthPx, height: face.heightPx, bytes: 100, sha256: 'a'.repeat(64) }));
const world = (positionM: readonly [number, number, number] = [0, 0, 0], orientationXyzw: readonly [number, number, number, number] = [0, 0, 0, 1]): WorldCameraPose =>
  ({ referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM, orientationXyzw } });
const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11] } as const;
class FakeElement {
  readonly nodeType = 1;
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = ''; textContent = ''; clientWidth = 800; clientHeight = 600;
  readonly ownerDocument: FakeDocument;
  readonly localName: string;
  constructor(ownerDocument: FakeDocument, localName = 'div') { this.ownerDocument = ownerDocument; this.localName = localName; Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } }); }
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
  const base = new URL('../../../', import.meta.url);
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
  await Promise.all([mounted.ensureGalaxyCatalog(), mounted.ensureGalaxyCatalog(), mounted.ensureImageLayer(image.id), mounted.ensureImageLayer(image.id)]);
  expect(loadCatalog).toHaveBeenCalledTimes(1); expect(loadImageLayer).toHaveBeenCalledTimes(1); expect(catalogMount).toHaveBeenCalledTimes(1);
  expect(root.dataset).toMatchObject({ imageLayerResidentBankCount: '1', imageLayerLoadingBankCount: '0', catalogResident: 'true', catalogLoading: 'false' });
  await mounted.ensureGalaxyCatalog(); await mounted.ensureImageLayer(image.id);
  expect(loadCatalog).toHaveBeenCalledTimes(1); expect(loadImageLayer).toHaveBeenCalledTimes(1);
  mounted.destroy(); expect(catalogRuntime.destroy).toHaveBeenCalledTimes(1);
});

test('retains exactly six prepared images and changes only shared camera presentation during travel and rotation', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const payload = fixture(), resolveResource = vi.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssSky({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resources, resolveResource });
  const root = runtime.root as unknown as FakeElement, camera = root.children[0]!.children[0]!, scene = camera.children[0]!, leaves = [...scene.children];
  const count = document.count, styles = leaves.map(leaf => ({ ...leaf.style }));
  expect(leaves.map(leaf => leaf.dataset.skyFace)).toEqual(bases.map(([id]) => id));
  runtime.publish(world(), viewport); const initial = scene.style.transform;
  runtime.publish(world([1e25, -2e25, 3e25]), viewport); expect(scene.style.transform).toBe(initial);
  runtime.publish(world([0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]), viewport); expect(scene.style.transform).not.toBe(initial);
  expect(camera.style.perspectiveOrigin).toBe('calc(50% + 17px) calc(50% + -11px)');
  expect(root.style.opacity).toBeUndefined(); expect(root.style.transformStyle).toBe('flat');
  for (const node of [camera, scene]) { expect(node.style.transformStyle).toBe('preserve-3d'); expect(node.style.opacity).toBeUndefined(); }
  runtime.publish(world(), viewport, false); expect(root.style.visibility).toBe('hidden');
  runtime.publish(world(), viewport); expect(scene.style.transform).toBe(initial);
  expect(document.count).toBe(count); expect(scene.children).toEqual(leaves); expect(leaves.map(leaf => leaf.style)).toEqual(styles);
  expect(resolveResource).toHaveBeenCalledTimes(6);
  leaves.forEach((leaf, index) => expect(leaf.style).toMatchObject({ ...payload.faces[index]!.style, backgroundImage: `url("/prepared/${payload.faces[index]!.texturePath}")` }));
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
  const volume = JSON.parse(readFileSync(new URL('../../../objects/milky-way/prepared/volume.json', import.meta.url), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const withSky = { ...volume, sky, resources: [...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...resources] };
  expect(validatePreparedCssVolume(withSky).sky).toEqual(sky);
  expect(() => validatePreparedCssVolume({ ...withSky, sky: { ...sky, epochJdTt: sky.epochJdTt + 1 } })).toThrow('reference frame');
  const { sky: _sky, ...legacy } = withSky; expect(validatePreparedCssVolume(legacy).sky).toBeUndefined();
});

test('near star cube is fully handed off before solar-system parallax produces duplicate stars', () => {
  const source = JSON.parse(readFileSync(new URL('../../../objects/sun/source/navigation/universe.json', import.meta.url), 'utf8'));
  const astronomicalUnitM = 149_597_870_700;
  expect(source.stars.fadeStartDistanceM).toBe(100 * astronomicalUnitM);
  expect(source.stars.fullDistanceM).toBe(200 * astronomicalUnitM);
  expect(logarithmicFade(591.27 * astronomicalUnitM, source.stars.fadeStartDistanceM, source.stars.fullDistanceM)).toBe(1);
});

test('direct stars peak at half opacity', () => {
  expect(STELLAR_POINTS_MAX_OPACITY).toBe(.5);
});

test.each([
  { withSky: true, withBrightness: true }, { withSky: true, withBrightness: false },
  { withSky: false, withBrightness: true }, { withSky: false, withBrightness: false },
])('shared universe crossfades NASA with the independently graded completed volume (sky=$withSky, profile=$withBrightness)', ({ withSky, withBrightness }) => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const brightness = context.volume.brightnessProfile;
  if (!withBrightness) delete context.volume.brightnessProfile;
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const { sky: _originalSky, ...volumeWithoutSky } = volume;
  const data = { ...volumeWithoutSky, ...(withSky ? { sky } : {}), resources: [
    ...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...(withSky ? resources : []),
  ] };
  const stars = readCanonicalPointField();
  const document = new FakeDocument(), stage = document.createElement(), detail = document.createElement(); stage.appendChild(detail);
  const universe = createPreparedUniverse({ context, volume: data, pointAppearance: stars, resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`, sprites: {} });
  const skyAssets = universe.assets.entries.filter(entry => entry.key.includes(':sky/'));
  expect(skyAssets).toHaveLength(withSky ? 6 : 0);
  for (const asset of skyAssets) expect(universe.assets.startup).toContain(asset.key);
  const mounted = universe.mount(stage as unknown as HTMLElement), root = mounted.root as unknown as FakeElement;
  const skyRoot = root.children.find(node => node.className === 'prepared-celestial-sky')!, stellarRoot = root.children.find(node => node.className === 'stellar-direct-points')!, volumeRoot = root.children.find(node => node.className === 'prepared-volume-context')!;
  const volumeImage = volumeRoot.children.find(node => node.className === 'prepared-volume-image')!;
  expect(volumeRoot.style.background).toBe('#000');
  expect(volumeRoot.style.transformStyle).toBe('flat');
  expect(volumeImage.style.transformStyle).toBe('flat');
  const axes = volumeImage.children.filter(node => node.className === 'css-volume-projection');
  expect(axes).toHaveLength(3);
  for (const axis of axes) {
    expect(axis.children[0]!.style.opacity).toBeUndefined();
    expect(axis.children[0]!.children[0]!.style.opacity).toBeUndefined();
  }
  const count = document.count, originalNodes = [...root.children];
  if (withSky) expect(root.children.indexOf(skyRoot)).toBeLessThan(root.children.indexOf(stellarRoot));
  else expect(skyRoot).toBeUndefined();
  expect(root.children.indexOf(stellarRoot)).toBeLessThan(root.children.indexOf(volumeRoot));
  const profile = context.volume.opacityProfile;
  const nearGain = brightness.nearOpacity;
  const regressionDistance = 98 * 3.085677581491367e16;
  const gradedDistance = 2255 * 3.085677581491367e16;
  expect(profile.fadeStartDistanceM).toBeGreaterThan(regressionDistance);
  const distances = [profile.fadeStartDistanceM / 2, regressionDistance, gradedDistance,
    Math.sqrt(profile.fadeStartDistanceM * profile.fullDistanceM), profile.fullDistanceM,
    Math.sqrt(brightness.fadeStartDistanceM * brightness.fullDistanceM), brightness.fullDistanceM,
    profile.fadeStartDistanceM / 2];
  for (const distance of distances) {
    const expected = logarithmicFade(distance, profile.fadeStartDistanceM, profile.fullDistanceM);
    const gain = nearGain + (brightness.fullOpacity - nearGain) * logarithmicFade(distance, brightness.fadeStartDistanceM, brightness.fullDistanceM);
    const camera: WorldCameraPose = { referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distance], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(camera, viewport);
    const expectedGain = withBrightness ? gain : 1;
    const expectedSkyContribution = 1 - expected * expectedGain;
    const starHandoff = logarithmicFade(distance, context.stars.fadeStartDistanceM, context.stars.fullDistanceM);
    const completedVolumeContribution = expected * (withSky ? expectedGain : 1);
    expect(Number(stellarRoot.style.opacity)).toBeCloseTo(STELLAR_POINTS_MAX_OPACITY * starHandoff * (1 - completedVolumeContribution), 12);
    expect(Number(volumeRoot.dataset.volumeOpacity)).toBeCloseTo(expected, 12);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected * (withSky ? expectedGain : 1), 12);
    if (withBrightness && distance === gradedDistance) {
      expect(expectedGain).toBeGreaterThan(.23);
      expect(expectedGain).toBeLessThan(.25);
    }
    expect(volumeImage.style.opacity).toBe(withSky ? '' : String(expectedGain));
    expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    if (withSky) {
      expect(skyRoot.style.visibility).toBe(expectedSkyContribution > 0 ? 'visible' : 'hidden');
      expect((1 - Number(volumeRoot.style.opacity)) * Number(skyRoot.style.opacity)).toBeCloseTo(expectedSkyContribution, 12);
      const skyWeight = Number(skyRoot.dataset.skyContribution);
      expect(skyWeight).toBeCloseTo(expectedSkyContribution, 12);
      // Test the actual DOM source-over equation, not just reported weights.
      expect(completedPixel(volumeRoot, volumeImage, skyRoot, .4)).toBeCloseTo(.4 * (expected * expectedGain + expectedSkyContribution), 12);
      if (distance === regressionDistance) {
        expect(expected).toBe(0);
        expect(skyWeight).toBe(1);
        expect(skyRoot.style.visibility).toBe('visible');
        if (withBrightness) expect(expectedGain).toBe(.094);
        expect(completedPixel(volumeRoot, volumeImage, skyRoot, .4)).toBe(.4);
      }
    } else expect(completedPixel(volumeRoot, volumeImage, undefined, .4)).toBeCloseTo(.4 * expected * expectedGain, 12);
    mounted.publish({ ...camera, pose: { ...camera.pose, orientationXyzw: [0, 1, 0, 0] } }, viewport);
    expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected * (withSky ? expectedGain : 1), 12);
  }
  expect(document.count).toBe(count); expect(root.children).toEqual(originalNodes);
  mounted.destroy(); expect(stage.children).toEqual([detail]); expect(document.defaultView.pending.size).toBe(0);
});

test('shared universe draws only resolved nebulae and never prefetches their lenses with the galaxy', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url), parsecM = 3.085677581491367e16;
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
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {} };
  const bank: PreparedVolumeLenses = { schema: 'cssearth-volume-lenses@1', id: 'nearby-nebula', defaultLens: 'optical',
    framingRadiusUnits: 1, contextVisibility: 'independent', lenses: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared nearby nebula', sourceUrl: 'https://example.org/nebula', volume: nebula,
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] };
  const { contextVisibility: _independent, ...galacticBank } = bank;
  const banks = [bank, { ...galacticBank, id: 'galactic-default' }];
  const banksById = new Map(banks.map(payload => [payload.id, payload]));
  const document = new FakeDocument(), stage = document.createElement();
  const fetchResource = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1])));
  Object.assign(document.defaultView, { fetch: fetchResource });
  // Loading a bank's prepared payload (all its lenses and catalogue points) is deferred, one bank at
  // a time, exactly like loadShells defers a surface shell: nothing here is fetched until a bank is
  // either selected or first comes close enough to draw.
  const loadVolumeLens = vi.fn((id: string) => Promise.resolve({ payload: banksById.get(id)!,
    resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    volumeLensBanks: banks.map(payload => ({ id: payload.id, frame: payload.lenses[0]!.volume.frame })), loadVolumeLens });
  // Declaring a bank must not fetch it: the whole point of deferring it is that the first frame never pays for it.
  expect(loadVolumeLens).not.toHaveBeenCalled();
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const root = mounted.root as unknown as FakeElement;
    const milkyWay = root.children.find(node => node.className === 'prepared-volume-context')!;
    const findBank = (id: string) => root.children.find(node => node.dataset.volumeLensObject === id);
    const images = (node: FakeElement): string[] => [node.style.backgroundImage, ...node.children.flatMap(images)].filter(Boolean);
    // Mounting the universe and publishing while far from every bank must not fetch any of them either.
    mounted.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 1e6 * parsecM],
        orientationXyzw: [0, 0, 0, 1] } }, viewport);
    expect(loadVolumeLens).not.toHaveBeenCalled();
    expect(findBank(bank.id)).toBeUndefined();
    expect(findBank('galactic-default')).toBeUndefined();
    // A 0.1 pc radius spans 30 px at 2 pc and 1.25 px at 48 pc, using the default visibility thresholds.
    for (const [distancePc, visible] of [[98, false], [52, true], [98, false], [52, true]] as const) {
      const camera: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
        pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
          orientationXyzw: [0, 0, 0, 1] } };
      mounted.publish(camera, viewport);
      // The first crossing into view is what triggers the fetch for both banks (the fetch gate does not
      // check contextVisibility); give their promises a turn to resolve and mount before reading the DOM.
      if (visible && !findBank(bank.id)) {
        await vi.waitFor(() => { expect(findBank(bank.id)).toBeDefined(); expect(findBank('galactic-default')).toBeDefined(); });
        mounted.publish(camera, viewport);
      }
      expect(milkyWay.dataset.volumeOpacity).toBe('0');
      expect(milkyWay.style.display).toBe('none');
      const galactic = findBank('galactic-default');
      const independent = findBank(bank.id);
      if (!visible && !independent) continue; // not yet fetched: the first (invisible) distance, nothing to check
      expect(independent).toBeDefined();
      expect(independent!.style.opacity).toBe(visible ? '1' : '0');
      expect(independent!.style.display).toBe(visible ? 'block' : 'none');
      // The always-galactic bank is fetched right alongside it (same silhouette) but stays invisible:
      // rendering, unlike fetching, still waits on the general galactic fade, which is zero here.
      expect(galactic).toBeDefined();
      expect(galactic!.style.opacity).toBe('0');
      expect(galactic!.style.display).toBe('none');
      if (visible) {
        const cloud = independent!.children.find(node => node.className === 'prepared-volume-lens-cloud')!;
        const axes = cloud.children.filter(node => node.className === 'css-volume-projection');
        expect(axes).toHaveLength(3);
        expect(Number(independent!.dataset.cloudOpacity)).toBeGreaterThan(0);
        expect(axes.some(axis => axis.style.visibility === 'visible' && Number(axis.style.opacity) > 0)).toBe(true);
        expect([...new Set(images(independent!))]).toEqual(['url("/nebula/nearby-nebula/z.webp")']);
        expect(images(galactic!)).toEqual([]);
      }
    }
    expect(loadVolumeLens).toHaveBeenCalledTimes(2);
    expect(loadVolumeLens).toHaveBeenCalledWith(bank.id);
    expect(loadVolumeLens).toHaveBeenCalledWith('galactic-default');
    // Trigger the actual universe warm-up: it must finish without any nebula
    // URL, even for legacy banks with no distant-image payload or leaf bounds.
    mounted.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1],
        context.focus.positionM[2] + context.volume.fullDistanceM * 2], orientationXyzw: [0, 0, 0, 1] } }, viewport);
    const skyPaths = new Set([...volume.sky?.faces ?? [], ...volume.sky?.nearFaces ?? []].map(face => face.texturePath));
    const expected = volume.resources.filter(resource => !skyPaths.has(resource.path)).map(resource => `/volume/${resource.path}`);
    await vi.waitFor(() => expect(fetchResource).toHaveBeenCalledTimes(expected.length));
    expect(fetchResource.mock.calls.map(([url]) => url)).toEqual(expected);
    // The galaxy warm-up prefetches the Milky Way's own resources only; it must never load a lens bank
    // beyond the two already fetched by proximity above.
    expect(loadVolumeLens).toHaveBeenCalledTimes(2);
  } finally { mounted.destroy(); }
  expect(stage.children).toEqual([]);
  expect(document.defaultView.pending.size).toBe(0);
});

test('an unloaded bank is fetched by proximity even while the general galactic fade is still zero', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url), parsecM = 3.085677581491367e16;
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
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {} };
  // Default contextVisibility ('galactic'): this bank's eventual render still waits on the general
  // fade, but its fetch must not, or a future bank baked this way would never load by proximity at all.
  const bank: PreparedVolumeLenses = { schema: 'cssearth-volume-lenses@1', id: 'proximity-nebula', defaultLens: 'optical',
    framingRadiusUnits: 1, lenses: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared proximity nebula', sourceUrl: 'https://example.org/nebula', volume: nebula,
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] };
  const document = new FakeDocument(), stage = document.createElement();
  const loadVolumeLens = vi.fn((id: string) => Promise.resolve({ payload: bank, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    volumeLensBanks: [{ id: bank.id, frame }], loadVolumeLens });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const root = mounted.root as unknown as FakeElement;
    const milkyWay = root.children.find(node => node.className === 'prepared-volume-context')!;
    // 2 pc from the bank, 52 pc from the focus: well within its visibility threshold, but nowhere
    // near the Milky Way's own fade-in distance, so the general galactic fade reads zero here.
    const near: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + 52 * parsecM], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(near, viewport);
    expect(milkyWay.dataset.volumeOpacity).toBe('0');
    expect(loadVolumeLens).toHaveBeenCalledExactlyOnceWith(bank.id);
  } finally { mounted.destroy(); }
});

test('selecting a nebula loads its bank on demand even while it is out of view', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url), parsecM = 3.085677581491367e16;
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
    resources: ['x', 'y', 'z'].map(axis => ({ path: `${axis}.webp`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
    provenance: {}, approximation: {} };
  const bank: PreparedVolumeLenses = { schema: 'cssearth-volume-lenses@1', id: 'far-nebula', defaultLens: 'optical',
    framingRadiusUnits: 1, contextVisibility: 'independent', lenses: [{ id: 'optical', label: 'Optical', title: 'Optical emission',
      description: 'Prepared far nebula', sourceUrl: 'https://example.org/nebula', volume: nebula,
      brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } }] };
  const document = new FakeDocument(), stage = document.createElement();
  const loadVolumeLens = vi.fn((id: string) => Promise.resolve({ payload: bank, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    volumeLensBanks: [{ id: bank.id, frame }], loadVolumeLens });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    const far: WorldCameraPose = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2]], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(far, viewport);
    expect(loadVolumeLens).not.toHaveBeenCalled();
    expect(mounted.volumeLensState(bank.id)).toBeNull();
    // Selecting it, e.g. from the catalogue, must trigger the load without waiting for proximity.
    mounted.selectVolumeLens(bank.id, 'optical');
    expect(loadVolumeLens).toHaveBeenCalledExactlyOnceWith(bank.id);
    await vi.waitFor(() => expect(mounted.volumeLensState(bank.id)).not.toBeNull());
    expect(mounted.volumeLensState(bank.id)!.selectedLens).toBe('optical');
  } finally { mounted.destroy(); }
});

test('hidden lens banks are bounded, active subscriptions pin them, and eviction reloads saved presentation', async () => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url), parsecM = 3.085677581491367e16;
  const context = JSON.parse(readFileSync(new URL('objects/sun/prepared/world-context.json', base), 'utf8'));
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const makeBank = (id: string, distancePc: number): PreparedVolumeLenses => {
    const frame: PreparedCssVolume['frame'] = { referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      originM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: .1 * parsecM,
      boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
    const prepared = (lensId: string): PreparedCssVolume => ({ schema: 'cssearth-css-volume@1', id: `${id}-${lensId}`, frame, anchors: [],
      stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0],
        texturePath: `${lensId}/${axis}.webp`, widthPx: 1, heightPx: 1,
        style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
          backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
      resources: ['x', 'y', 'z'].map(axis => ({ path: `${lensId}/${axis}.webp`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })),
      provenance: {}, approximation: {} });
    return { schema: 'cssearth-volume-lenses@1', id, defaultLens: 'optical', framingRadiusUnits: 1, contextVisibility: 'independent',
      lenses: ['optical', 'infrared'].map(lensId => ({ id: lensId, label: lensId, title: `${lensId} emission`,
        description: `${id} prepared observation`, sourceUrl: 'https://example.org/nebula', volume: prepared(lensId),
        brightness: { overall: 1, x: 1, y: 1, z: 1 }, stars: { frame, points: [] } })) };
  };
  const banks = [makeBank('near-bank', 50), makeBank('far-bank', 100)], byId = new Map(banks.map(bank => [bank.id, bank]));
  const loadVolumeLens = vi.fn(async (id: string) => ({ payload: byId.get(id)!, resolveResource: (path: string) => `/nebula/${id}/${path}` }));
  const document = new FakeDocument(), stage = document.createElement();
  const universe = createPreparedUniverse({ context, volume, pointAppearance: readCanonicalPointField(), sprites: {},
    resolveResource: path => `/volume/${path}`, resolvePointResource: path => `/stars/${path}`,
    volumeLensBanks: banks.map(bank => ({ id: bank.id, frame: bank.lenses[0]!.volume.frame })), loadVolumeLens,
    warmVolumeLensDomNodeBudget: 0 });
  const mounted = universe.mount(stage as unknown as HTMLElement);
  try {
    mounted.selectVolumeLens('near-bank', 'infrared');
    mounted.setVolumeStarsVisible('near-bank', false);
    const releaseNear = mounted.subscribeVolumeLens('near-bank', () => {});
    await vi.waitFor(() => expect(mounted.volumeLensState('near-bank')).not.toBeNull());
    const camera = (distancePc: number): WorldCameraPose => ({ referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distancePc * parsecM],
        orientationXyzw: [0, 0, 0, 1] } });
    mounted.publish(camera(52), viewport);
    mounted.publish(camera(102), viewport);
    await vi.waitFor(() => expect(mounted.volumeLensState('far-bank')).not.toBeNull());
    mounted.publish(camera(102), viewport);
    expect(mounted.volumeLensState('near-bank')).not.toBeNull();
    expect((mounted.root as unknown as FakeElement).dataset).toMatchObject({ volumeLensPinnedBankCount: '1', volumeLensWarmDomNodeBudget: '0' });

    releaseNear();
    expect(mounted.volumeLensState('near-bank')).toBeNull();
    expect((mounted.root as unknown as FakeElement).dataset.volumeLensWarmDomNodes).toBe('0');

    const releaseReloaded = mounted.subscribeVolumeLens('near-bank', () => {});
    await vi.waitFor(() => expect(mounted.volumeLensState('near-bank')).not.toBeNull());
    expect(mounted.volumeLensState('near-bank')).toMatchObject({ selectedLens: 'infrared', starsVisible: false });
    expect(loadVolumeLens.mock.calls.filter(([id]) => id === 'near-bank')).toHaveLength(2);
    releaseReloaded();
    expect(mounted.volumeLensState('near-bank')).toBeNull();

    // A hidden, unpinned explicit load is trimmed when it settles; eviction does
    // not need another camera publication to enforce the warm budget.
    mounted.selectVolumeLens('near-bank', 'optical');
    await vi.waitFor(() => expect(loadVolumeLens.mock.calls.filter(([id]) => id === 'near-bank')).toHaveLength(3));
    await loadVolumeLens.mock.results.at(-1)!.value; await Promise.resolve(); await Promise.resolve();
    expect(mounted.volumeLensState('near-bank')).toBeNull();
    expect((mounted.root as unknown as FakeElement).dataset.volumeLensWarmDomNodes).toBe('0');
  } finally { mounted.destroy(); }
});

/** Ordinary source-over through the actual DOM opacity levels. */
function completedPixel(host: FakeElement, image: FakeElement, sky: FakeElement | undefined, volumeValue: number, skyValue = volumeValue): number {
  const t = Number(host.style.opacity), g = Number(image.style.opacity || '1');
  const foregroundAlpha = t * (host.style.background === '#000' ? 1 : g);
  const underlay = sky?.style.visibility === 'visible' ? skyValue * Number(sky.style.opacity || '1') : 0;
  return t * g * volumeValue + (1 - foregroundAlpha) * underlay;
}

test("baked stars hand the background to the plain Milky Way beyond the Sun's neighbourhood", () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const nearFaces = fixture().faces.map(face => ({ ...face, texturePath: `sky-near/${face.id}.webp` }));
  const payload: PreparedCssSky = { ...fixture(), nearFaces, stars: { objectId: 'stellar-neighbourhood', cssPixelsPerDegree: 21.8 } };
  const nearResources = [...resources, ...nearFaces.map(face => ({ path: face.texturePath, width: face.widthPx, height: face.heightPx, bytes: 100, sha256: 'b'.repeat(64) }))];
  const { stars: _stars, ...withoutStars } = payload;
  expect(() => validatePreparedCssSky(withoutStars, nearResources)).toThrow('come together');
  const runtime = mountPreparedCssSky({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resources: nearResources, resolveResource: path => `/prepared/${path}` });
  const root = runtime.root as unknown as FakeElement;
  const [plain, stars] = root.children as [FakeElement, FakeElement];
  const leaves = (cube: FakeElement) => [...cube.children[0]!.children[0]!.children];
  expect(leaves(plain).map(leaf => leaf.style.backgroundImage)).toEqual(bases.map(([id]) => `url("/prepared/sky/${id}.webp")`));
  expect(leaves(stars).map(leaf => leaf.style.backgroundImage)).toEqual(bases.map(([id]) => `url("/prepared/sky-near/${id}.webp")`));
  const count = document.count;
  // Inside the Sun's neighbourhood the plain cube never enters layout, so its images never load.
  for (const distance of [1, 100 * 149597870700, 140.3 * 149597870700, 3.085677581491367e15]) {
    runtime.publish(world([0, 0, distance]), viewport, true, 1);
    expect(plain.style.display).toBe('none');
    expect(stars.style.display ?? '').toBe('');
    expect(stars.style.opacity ?? '').toBe('');
    expect(root.style.visibility).toBe('visible');
  }
  runtime.publish(world([0, 0, 1e16]), viewport, true, .25);
  expect([plain.style.display, stars.style.display ?? '', stars.style.opacity]).toEqual(['', '', '0.25']);
  // From another star the Sun's neighbour stars would be misplaced; the diffuse Milky Way remains.
  runtime.publish(world([0, 0, 2.7e18]), viewport, true, 0);
  expect([plain.style.display, stars.style.display]).toEqual(['', 'none']);
  runtime.publish(world([0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]), viewport, true, 1);
  expect([plain.style.display, stars.style.display, stars.style.opacity]).toEqual(['none', '', '']);
  expect(leaves(stars)[0]!.parentNode!.style.transform).toBe(preparedSkyCameraTransform(world([0,0,0], [0,Math.SQRT1_2,0,Math.SQRT1_2]), viewport));
  expect(document.count).toBe(count);
});
