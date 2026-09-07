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
// These unrelated layers keep their normal publication contract; the test mounts
// the actual universe, sky and volume compositor without building a star catalogue.
vi.mock('../stars/prepared-point-field-runtime.js', () => ({ mountPreparedCssPointField: () => ({ publish: starPublish, setOccluder() {}, destroy() {} }) }));
vi.mock('../universe/world-context-point-source.js', () => ({ mountWorldContextPointSource: () => null }));
vi.mock('../universe/prepared-world-context.js', async importOriginal => ({ ...await importOriginal<typeof import('../universe/prepared-world-context.js')>(),
  mountPreparedWorldContext: () => ({ publish() {}, selectObject() {}, destroy() {} }) }));

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
  parentNode: FakeElement | null = null; className = '';
  constructor(readonly ownerDocument: FakeDocument) { Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } }); }
  get firstChild(): FakeElement | null { return this.children[0] ?? null; }
  setAttribute(name: string, value: string): void { this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())] = value; }
  append(child: FakeElement): void { this.appendChild(child); }
  appendChild(child: FakeElement): void { this.insertBefore(child, null); }
  insertBefore(child: FakeElement, before: FakeElement | null): void { child.remove(); child.parentNode = this; this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); }
  remove(): void { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
}
class FakeDocument { count = 0; createElement(): FakeElement { this.count++; return new FakeElement(this); } }
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

test.each([true, false])('shared universe retains independent sky crossfade and completed-image attenuation (profile=%s)', withBrightness => {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const base = new URL('../../../', import.meta.url);
  const context = JSON.parse(readFileSync(new URL('planets/sun/prepared/world-context.json', base), 'utf8'));
  const brightness = context.volume.brightnessProfile;
  if (!withBrightness) delete context.volume.brightnessProfile;
  const volume = JSON.parse(readFileSync(new URL('objects/milky-way/prepared/volume.json', base), 'utf8')).data as PreparedCssVolume;
  const sky = { ...fixture(), referenceFrame: volume.frame.referenceFrame, epochJdTt: volume.frame.epochJdTt };
  const data = { ...volume, sky, resources: [...volume.resources.filter(resource => !resource.path.startsWith('sky/')), ...resources] };
  const stars = JSON.parse(readFileSync(new URL('objects/stellar-neighbourhood/prepared/stars.json', base), 'utf8')).data;
  const document = new FakeDocument(), stage = document.createElement(), detail = document.createElement(); stage.appendChild(detail);
  const universe = createPreparedUniverse({ context, volume: data, stars, resolveResource: path => `/volume/${path}`, resolveStarResource: path => `/stars/${path}`, sprites: {} });
  const skyAssets = universe.assets.entries.filter(entry => entry.key.includes(':sky/'));
  expect(skyAssets).toHaveLength(6);
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
  expect(root.children.indexOf(skyRoot)).toBeLessThan(root.children.indexOf(volumeRoot));
  const profile = context.volume.opacityProfile;
  for (const [distance, expected, gain] of [[profile.fadeStartDistanceM / 2, 0, .25], [Math.sqrt(profile.fadeStartDistanceM * profile.fullDistanceM), .5, .25],
    [profile.fullDistanceM, 1, .25], [Math.sqrt(brightness.fadeStartDistanceM * brightness.fullDistanceM), 1, .625], [brightness.fullDistanceM, 1, 1], [profile.fadeStartDistanceM / 2, 0, .25]]) {
    const camera: WorldCameraPose = { referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
      pose: { positionM: [context.focus.positionM[0], context.focus.positionM[1], context.focus.positionM[2] + distance], orientationXyzw: [0, 0, 0, 1] } };
    mounted.publish(camera, viewport);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected, 12);
    const expectedGain = withBrightness ? gain : 1;
    expect(volumeImage.style.opacity).toBe(`var(--universe-volume-brightness-override, ${Number(volumeImage.dataset.volumeBrightness)})`);
    expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    expect(skyRoot.style.visibility).toBe(expected < 1 ? 'visible' : 'hidden');
    expect(skyRoot.style.opacity).toBeUndefined();
    expect(Number(skyRoot.dataset.skyContribution)).toBeCloseTo(1 - expected, 12);
    expect(starPublish).toHaveBeenLastCalledWith(camera, viewport, 1 - logarithmicFade(distance, context.volume.fadeStartDistanceM, context.volume.fullDistanceM));
    mounted.publish({ ...camera, pose: { ...camera.pose, orientationXyzw: [0, 1, 0, 0] } }, viewport);
    expect(Number(volumeImage.dataset.volumeBrightness)).toBeCloseTo(expectedGain, 12);
    expect(Number(volumeRoot.style.opacity)).toBeCloseTo(expected, 12);
  }
  expect(document.count).toBe(count); expect(root.children).toEqual(originalNodes);
  mounted.destroy(); expect(stage.children).toEqual([detail]);
});
