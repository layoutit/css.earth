import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { mountPreparedCssSky, preparedSkyCameraTransform } from './prepared-sky-runtime.js';
import { validatePreparedCssSky } from './validation.js';
import type { PreparedCssSky } from './types.js';
import type { PreparedCssVolume } from '../volume/types.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import { createPreparedUniverse } from '../universe/prepared-universe-runtime.js';
import { logarithmicFade } from '../universe/prepared-world-context.js';

const starPublish = vi.hoisted(() => vi.fn());
const spatialPublish = vi.hoisted(() => vi.fn());
const foregroundRects = vi.hoisted(() => [{ left: 100, top: 100, right: 150, bottom: 114 }]);
// These unrelated layers keep their normal publication contract; the test mounts
// the actual universe, sky and volume compositor without building a star catalogue.
vi.mock('../stars/prepared-point-field-runtime.js', () => ({ mountPreparedCssPointField: () => ({ publish: starPublish, inspect: () => ({}), setOccluder() {}, destroy() {} }) }));
vi.mock('../universe/world-context-point-source.js', () => ({ mountWorldContextPointSource: () => null }));
vi.mock('../universe/prepared-world-context.js', async importOriginal => ({ ...await importOriginal<typeof import('../universe/prepared-world-context.js')>(),
  mountPreparedWorldContext: () => ({ publish: spatialPublish, inspect: () => [], selectObject() {}, backgroundExclusionRects: () => foregroundRects, destroy() {} }) }));

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
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = ''; textContent = ''; clientWidth = 800; clientHeight = 600;
  readonly ownerDocument: FakeDocument;
  constructor(ownerDocument: FakeDocument) { this.ownerDocument = ownerDocument; Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } }); }
  get firstChild(): FakeElement | null { return this.children[0] ?? null; }
  get offsetWidth(): number { return this.textContent.length * 7; }
  get offsetHeight(): number { return 14; }
  setAttribute(name: string, value: string): void { this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())] = value; }
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
class FakeDocument { count = 0; defaultView = new FakeWindow(); createElement(): FakeElement { this.count++; return new FakeElement(this); } }
afterEach(() => vi.unstubAllGlobals());

test('retains exactly six prepared images and changes only shared camera presentation during travel and rotation', () => {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const payload = fixture(), resolveResource = vi.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssSky({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resources, resolveResource });
  const root = runtime.root as unknown as FakeElement, camera = root.children[0]!, scene = camera.children[0]!, leaves = [...scene.children];
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

test('sky and volume project ICRF directions identically with exactly one PolyCSS reflection', () => {
  const frame: PreparedCssVolume['frame'] = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  for (const quaternion of [[0, 0, 0, 1], [0, Math.SQRT1_2, 0, Math.SQRT1_2], [.5, .5, .5, .5]] as const) {
    const pose = world([0, 0, 0], quaternion), volume = preparedVolumeCameraTransform({ world: pose, viewport }, frame);
    expect(preparedSkyCameraTransform(pose, viewport)).toBe(`translate3d(17px,-11px,600px) ${worldRotationCss(volume.rotation)}`);
  }
  // Independent cardinal proof: at identity, CSS [y,x,z] becomes ICRF [x,y,z].
  const css = preparedSkyCameraTransform(world(), viewport).split('matrix3d(')[1]!.slice(0, -1).split(',').map(Number);
  expect([css[0]! * 2 + css[4]! * 1, css[1]! * 2 + css[5]! * 1, css[10]! * -3]).toEqual([1, 2, -3]);
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

test.each([
  { withSky: true, withBrightness: true }, { withSky: true, withBrightness: false },
  { withSky: false, withBrightness: true }, { withSky: false, withBrightness: false },
])('shared universe crossfades NASA with the independently graded completed volume (sky=$withSky, profile=$withBrightness)', ({ withSky, withBrightness }) => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('planets/sun/prepared/world-context.json', base), 'utf8'));
  const brightness = context.volume.brightnessProfile;
  if (!withBrightness) delete context.volume.brightnessProfile;
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const { sky: _originalSky, ...volumeWithoutSky } = volume;
  const data = { ...volumeWithoutSky, ...(withSky ? { sky } : {}), resources: [
    ...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...(withSky ? resources : []),
  ] };
  const stars = JSON.parse(readFileSync(new URL('objects/stellar-neighbourhood/prepared/stars.json', base), 'utf8')).data;
  const document = new FakeDocument(), stage = document.createElement(), detail = document.createElement(); stage.appendChild(detail);
  const universe = createPreparedUniverse({ context, volume: data, stars, resolveResource: path => `/volume/${path}`, resolveStarResource: path => `/stars/${path}`, sprites: {} });
  const skyAssets = universe.assets.entries.filter(entry => entry.key.includes(':sky/'));
  expect(skyAssets).toHaveLength(withSky ? 6 : 0);
  for (const asset of skyAssets) expect(universe.assets.startup).toContain(asset.key);
  const mounted = universe.mount(stage as unknown as HTMLElement), root = mounted.root as unknown as FakeElement;
  const skyRoot = root.children.find(node => node.className === 'prepared-celestial-sky')!, volumeRoot = root.children.find(node => node.className === 'prepared-volume-context')!;
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
  if (withSky) expect(root.children.indexOf(skyRoot)).toBeLessThan(root.children.indexOf(volumeRoot));
  else expect(skyRoot).toBeUndefined();
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
    expect(Number(volumeRoot.dataset.volumeOpacity)).toBeCloseTo(expected, 12);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected * (withSky ? expectedGain : 1), 12);
    if (withBrightness && distance === gradedDistance) {
      expect(expectedGain).toBeGreaterThan(.23);
      expect(expectedGain).toBeLessThan(.25);
    }
    expect(volumeImage.style.opacity).toBe(withSky ? '' : String(expectedGain));
    expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    if (withSky) {
      expect(skyRoot.style.visibility).toBe(expected < 1 ? 'visible' : 'hidden');
      expect((1 - Number(volumeRoot.style.opacity)) * Number(skyRoot.style.opacity)).toBeCloseTo(1 - expected, 12);
      const skyWeight = Number(skyRoot.dataset.skyContribution);
      expect(skyWeight).toBeCloseTo(1 - expected, 12);
      expect(Number(volumeRoot.dataset.volumeOpacity) + skyWeight).toBeCloseTo(1, 12);
      // Test the actual DOM source-over equation, not just reported weights.
      // Regrouping must not turn exposure into extra NASA contribution.
      expect(completedPixel(volumeRoot, volumeImage, skyRoot, .4)).toBeCloseTo(.4 * (expected * expectedGain + 1 - expected), 12);
      if (distance === regressionDistance) {
        expect(expected).toBe(0);
        expect(skyWeight).toBe(1);
        expect(skyRoot.style.visibility).toBe('visible');
        if (withBrightness) expect(expectedGain).toBe(.094);
        expect(completedPixel(volumeRoot, volumeImage, skyRoot, .4)).toBe(.4);
      }
    } else expect(completedPixel(volumeRoot, volumeImage, undefined, .4)).toBeCloseTo(.4 * expected * expectedGain, 12);
    const starCalls = starPublish.mock.calls.length;
    for (const high of [true, false]) {
      mounted.setHighContrastSky(high);
      const effectiveGain = high ? 1 : expectedGain;
      expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected * (withSky ? effectiveGain : 1), 12);
      expect(completedPixel(volumeRoot, volumeImage, skyRoot, .2, .7)).toBeCloseTo(
        .2 * expected * effectiveGain + (withSky ? .7 * (1 - expected) : 0), 12);
      expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    }
    expect(starPublish.mock.calls.length).toBe(starCalls);
    expect(starPublish).toHaveBeenLastCalledWith(camera, viewport, 1 - logarithmicFade(distance, context.volume.fadeStartDistanceM, context.volume.fullDistanceM), mounted.inspect().foregroundLabelExclusions);
    expect(starPublish.mock.lastCall![3]).toEqual(expect.arrayContaining(foregroundRects));
    expect(spatialPublish.mock.invocationCallOrder.at(-1)).toBeLessThan(starPublish.mock.invocationCallOrder.at(-1)!);
    mounted.publish({ ...camera, pose: { ...camera.pose, orientationXyzw: [0, 1, 0, 0] } }, viewport);
    expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected * (withSky ? expectedGain : 1), 12);
  }
  expect(document.count).toBe(count); expect(root.children).toEqual(originalNodes);
  mounted.destroy(); expect(stage.children).toEqual([detail]); expect(document.defaultView.pending.size).toBe(0);
});

/** Ordinary source-over through the actual DOM opacity levels. */
function completedPixel(host: FakeElement, image: FakeElement, sky: FakeElement | undefined, volumeValue: number, skyValue = volumeValue): number {
  const t = Number(host.style.opacity), g = Number(image.style.opacity || '1');
  const foregroundAlpha = t * (host.style.background === '#000' ? 1 : g);
  const underlay = sky?.style.visibility === 'visible' ? skyValue * Number(sky.style.opacity || '1') : 0;
  return t * g * volumeValue + (1 - foregroundAlpha) * underlay;
}
