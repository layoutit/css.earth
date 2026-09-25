import { compileLeafBounds } from '../preparation/leaf-bounds.js';
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { bakeSlab } from '@cssearth/bake/volume/node';
import type { VolumeRecipe } from '@cssearth/bake/volume';
import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import type { PreparedCssVolume, VolumeCameraPublication, VolumeVector } from './types.js';

const AXES = ['x', 'y', 'z'] as const;
class FakeElement {
  readonly nodeType = 1;
  readonly children: FakeElement[] = [];
  readonly style: Record<string, string> = new Proxy({}, { set: (target: Record<string, string>, key: string, value: string) => { this.propertyWrites.push(key); target[key] = value; return true; } });
  readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = '';
  readonly propertyWrites: string[] = [];
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) { this.ownerDocument = ownerDocument; this.tagName = tagName; Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } }); }
  setAttribute(name: string, value: string): void { this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())] = value; }
  append(child: FakeElement): void { this.insertBefore(child, null); }
  insertBefore(child: FakeElement, before: FakeElement | null): void { child.remove(); child.parentNode = this; this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child); }
  remove(): void { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
}
class FakeDocument {
  count = 0;
  createElement(tag = 'div'): FakeElement { this.count++; return new FakeElement(this, tag); }
}
const payload = (count = 1): PreparedCssVolume => ({
  schema: 'cssearth-css-volume@1', id: 'fixture', frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } }, anchors: [],
  stacks: AXES.map((axis, coordinate) => ({ axis, leaves: Array.from({ length: count }, (_, index) => {
    const depth = -1 + (index + .5) * 2 / count, center: [number, number, number] = [0, 0, 0]; center[coordinate] = depth;
    const transform = axis === 'x' ? [50, 0, 0, 0, 0, 0, 50, 0, 0, -1, 0, 0, -50, 50 * depth, -50, 1] :
      axis === 'y' ? [0, 50, 0, 0, 0, 0, 50, 0, 1, 0, 0, 0, 50 * depth, -50, -50, 1] :
        [0, 50, 0, 0, 50, 0, 0, 0, 0, 0, -1, 0, -50, -50, 50 * depth, 1];
    return { id: `${axis}-${index}`, centerUnits: center, texturePath: `${axis}.png`, widthPx: 1, heightPx: 1,
      style: { width: '2px', height: '2px', transform: `matrix3d(${transform})`, backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } };
  }) })), resources: AXES.map(axis => ({ path: `${axis}.png`, sha256: 'a'.repeat(64), bytes: 1, width: 1, height: 1 })), provenance: {}, approximation: {},
});
function mount(data = payload()) {
  vi.stubGlobal('HTMLElement', FakeElement); vi.stubGlobal('Element', FakeElement);
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.append(before);
  const resolver = vi.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssVolume({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload: data, resolveResource: resolver });
  const roots = runtime.roots as unknown as FakeElement[], root = roots[0]!, camera = root.children[0]!, scene = camera.children[0]!;
  const meshes = roots.map(node => node.children[0]!.children[0]!.children[0]!);
  return { data, document, host, before, runtime, roots, root, camera, scene, meshes, resolver };
}
function publication(direction: VolumeVector, position: VolumeVector = [0, 0, 10]): VolumeCameraPublication {
  const length = Math.hypot(...direction), [x, y, z] = direction.map(value => value / length);
  const quaternion: readonly [number, number, number, number] = z < -.999999999 ? [0, 1, 0, 0] : [-y / Math.sqrt(2 * (1 + z)), x / Math.sqrt(2 * (1 + z)), 0, Math.sqrt((1 + z) / 2)];
  return { world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: position, orientationXyzw: quaternion } }, viewport: { focalPixels: 600, principalOffsetPixels: [17, -11] } };
}
afterEach(() => vi.unstubAllGlobals());

function copyOpacity(copy: FakeElement): number {
  return copy.style.opacity === undefined ? 1 : Number(copy.style.opacity);
}
function sliceTransmission(copies: readonly FakeElement[], alpha: number): number {
  return copies.reduce((transmission, copy) => transmission * (1 - alpha * copyOpacity(copy)), 1);
}
function opticalGain(root: FakeElement): number {
  return root.children[0]!.children[0]!.children[0]!.children.slice(0, 3)
    .reduce((sum, copy) => sum + copyOpacity(copy), 0);
}

test('optical copies reuse canonical textures and transforms inside isolated unflattened axis cameras', () => {
  const { data, runtime, roots, meshes, resolver } = mount(payload(3)); runtime.publish(publication([1, 1, 1]));
  expect(roots).toHaveLength(3);
  for (let axis = 0; axis < 3; axis++) {
    const root = roots[axis]!, camera = root.children[0]!, scene = camera.children[0]!, mesh = meshes[axis]!;
    expect(root.children).toEqual([camera]); expect(camera.children).toEqual([scene]); expect(scene.children).toEqual([mesh]);
    for (const ancestor of [camera, scene, mesh]) { expect(ancestor.style.opacity).toBeUndefined(); expect(ancestor.style.background).toBeUndefined(); }
    expect(mesh.children).toHaveLength(9);
    for (const node of [root, camera, scene, mesh, ...mesh.children]) expect(node.dataset).toEqual({});
    for (let index = 0; index < 3; index++) {
      const copies = mesh.children.slice(index * 3, index * 3 + 3), original = copies[0]!;
      expect(original.style).toMatchObject(data.stacks[axis]!.leaves[index]!.style);
      expect(original.style.opacity).toBeUndefined();
      for (let copy = 1; copy < 3; copy++) {
        expect(Number(copies[copy]!.style.opacity)).toBeCloseTo(copy === 1 ? Math.sqrt(3) - 1 : 0, 12);
        expect(copies[copy]!.style.transform).toBe(original.style.transform);
        expect(copies[copy]!.style.backgroundImage).toBe(original.style.backgroundImage);
      }
    }
  }
  expect(resolver).toHaveBeenCalledTimes(9);
  const css = readFileSync(new URL('../styles/volume.css', import.meta.url), 'utf8');
  expect(css).toMatch(/\.css-volume-projection\s*\{[^}]*background:\s*#000[^}]*transform-style:\s*flat/su);
  expect(css).toMatch(/\.css-volume-camera,\s*\.css-volume-scene,\s*\.css-volume-mesh\s*\{[^}]*transform-style:\s*preserve-3d/su);
});

test('translation updates retained cameras without republishing direction-owned optical coefficients', () => {
  const { runtime, roots, scenes } = (() => {
    const mounted = mount();
    return { ...mounted, scenes: mounted.roots.map(root => root.children[0]!.children[0]!) };
  })();
  runtime.publish(publication([1, 1, 1]));
  const transforms = scenes.map(scene => scene.style.transform);
  const optics = roots.map(root => [opticalGain(root), root.style.opacity]);
  for (const root of roots) root.propertyWrites.length = 0;
  runtime.publish(publication([1, 1, 1], [3, 4, 12]));
  expect(scenes.map(scene => scene.style.transform)).not.toEqual(transforms);
  expect(roots.map(root => root.propertyWrites)).toEqual([[], [], []]);
  expect(roots.map(root => [opticalGain(root), root.style.opacity])).toEqual(optics);
  runtime.publish(publication([1, 0, 0], [3, 4, 12]));
  expect(roots.every(root => root.propertyWrites.every(name => !name.startsWith('--')))).toBe(true);
  expect(roots[0]!.style.visibility).toBe('visible');
  expect(roots[1]!.style.visibility).toBe('hidden');
  runtime.destroy();
});

test('rotation only publishes changed optical copies and translation leaves their opacity untouched', () => {
  const { runtime, meshes } = mount(payload(3));
  runtime.publish(publication([1, .001, 0]));
  const leaves = meshes.flatMap(mesh => mesh.children);
  for (const leaf of leaves) leaf.propertyWrites.length = 0;
  runtime.publish(publication([1, .002, 0]));
  // Only X's fractional first copy changes. Its base and saturated second
  // copy, and both inactive axes, keep their existing presentation.
  expect(meshes.map(mesh => mesh.children.map(leaf => leaf.propertyWrites))).toEqual([
    [[], ['opacity'], [], [], ['opacity'], [], [], ['opacity'], []],
    Array.from({ length: 9 }, () => []), Array.from({ length: 9 }, () => []),
  ]);
  for (const leaf of leaves) leaf.propertyWrites.length = 0;
  runtime.publish(publication([1, .002, 0], [4, 5, 12]));
  expect(leaves.every(leaf => leaf.propertyWrites.length === 0)).toBe(true);
});

test('actual baked homogeneous emission keeps physical optical density through a full rotation and stack handoffs', () => {
  const count = 256, data = payload(count), { runtime, roots, meshes } = mount(data);
  const recipe: VolumeRecipe = { schema: 'cssearth-volume-recipe@1', grid: { path: 'density.ktx2',
    dimensions: [1, 1, 1], encoding: 'sqrt-density-unorm8', bounds: { min: [-1, -1, -1], max: [1, 1, 1] } },
    material: { emission: [0, 1, 2].map(channel => ({ channel, color: [Number(channel === 0), Number(channel === 1), Number(channel === 2)], strength: 1 })),
      absorption: [], intensityScale: 1, stepScale: 1, exposureGain: 16 },
    bake: { sliceCounts: { x: count, y: count, z: count }, unitsPerSourceUnit: 1, imageWidth: 1, samplesPerSlab: 1, cropTransparent: false, opticalWeight: 1 },
    anchors: [], provenance: { path: 'provenance.json' } };
  const texel = bakeSlab({ width: 1, height: 1, depth: 1, encodedRgba: Buffer.from([32, 32, 32, 0]), recipe, provenance: {} }, 'z', 0, 2 / count, 1, 1, undefined).rgba;
  expect([...texel]).toEqual([255, 255, 255, 1]);
  const alpha = texel[3]! / 255, density = -count * Math.log1p(-alpha) / 2;
  let worstDensityError = 0, oldDominantError = 0;
  for (let degree = 0; degree <= 360; degree++) {
    const angle = degree * Math.PI / 180, direction: VolumeVector = [Math.sin(angle) / Math.sqrt(2), Math.sin(angle) / Math.sqrt(2), Math.cos(angle)];
    runtime.publish(publication(direction));
    const cosines = direction.map(Math.abs), halfPath = 1 / Math.max(...cosines);
    let pixel = 0;
    for (let axis = 0; axis < 3; axis++) {
      const root = roots[axis]!;
      if (root.style.visibility === 'hidden') continue;
      let transmission = 1;
      // Actual central-ray intersections with the prepared homogeneous cube.
      for (let index = 0; index < count; index++) {
        const depth = data.stacks[axis]!.leaves[index]!.centerUnits[axis]!;
        if (Math.abs(depth / cosines[axis]!) >= halfPath) continue;
        transmission *= sliceTransmission(meshes[axis]!.children.slice(index * 3, index * 3 + 3), alpha);
      }
      const opacity = Number(root.style.opacity);
      pixel = (1 - transmission) * opacity + pixel * (1 - opacity);
    }
    const opticalDepth = -Math.log1p(-pixel);
    worstDensityError = Math.max(worstDensityError, Math.abs(opticalDepth / (2 * halfPath * density) - 1));
    oldDominantError = Math.max(oldDominantError, 1 - Math.max(...cosines));
  }
  expect(worstDensityError).toBeLessThan(.005);
  expect(oldDominantError).toBeGreaterThan(.4);
});

test('coincident copies preserve opaque dust and exactly multiply integer optical lengths', () => {
  const { runtime, roots, meshes } = mount();
  // X remains inside the active band while its optical length is exactly doubled.
  runtime.publish(publication([.5, Math.sqrt(.375), Math.sqrt(.375)]));
  const root = roots[0]!, copies = meshes[0]!.children;
  expect(opticalGain(root)).toBeCloseTo(2, 12);
  for (const alpha of [0, 1 / 255, .25, .5, .8, 1]) expect(sliceTransmission(copies, alpha)).toBeCloseTo((1 - alpha) ** 2, 12);
  runtime.publish(publication([1, 1, 1]));
  for (let axis = 0; axis < 3; axis++) expect(sliceTransmission(meshes[axis]!.children, 1)).toBe(0);
  runtime.publish(publication([.47, Math.sqrt((1 - .47 ** 2) / 2), Math.sqrt((1 - .47 ** 2) / 2)]));
  expect(root.style.visibility).toBe('visible'); expect(copyOpacity(copies[2]!)).toBeGreaterThan(0);
});

test('the active band has enough retained copies and remains continuous across gain and direction boundaries', () => {
  const { runtime, roots, meshes } = mount();
  const sample = (direction: VolumeVector) => {
    runtime.publish(publication(direction));
    return roots.map((root, axis) => ({ gain: opticalGain(root), opacity: Number(root.style.opacity), transmission: sliceTransmission(meshes[axis]!.children, .3) }));
  };
  for (let latitude = -90; latitude <= 90; latitude += 5) for (let longitude = 0; longitude < 360; longitude += 5) {
    const a = latitude * Math.PI / 180, b = longitude * Math.PI / 180;
    const direction: VolumeVector = [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
    const positive = sample(direction), negative = sample(direction.map(value => -value) as unknown as VolumeVector);
    positive.forEach((value, index) => {
      expect(value.gain).toBeGreaterThanOrEqual(1); expect(value.gain).toBeLessThan(2.15);
      expect(value.gain).toBeCloseTo(negative[index]!.gain, 9); expect(value.opacity).toBeCloseTo(negative[index]!.opacity, 9);
    });
  }
  const nearTwo = (x: number): VolumeVector => [x, Math.sqrt((1 - x * x) / 2), Math.sqrt((1 - x * x) / 2)];
  const below = sample(nearTwo(.5 - 1e-7)), above = sample(nearTwo(.5 + 1e-7));
  expect(Math.abs(below[0]!.transmission - above[0]!.transmission)).toBeLessThan(1e-6);
});

test('rotation keeps geometry and texture resources stable while publishing leaf opacity', () => {
  const { runtime, document, meshes, resolver, host, before, camera } = mount(payload(3));
  // Opacity, culling and deferred textures are published presentation, not geometry.
  const leaves = meshes.flatMap(mesh => mesh.children), count = document.count, styles = leaves.map(leaf => { const { opacity, display, visibility, backgroundImage, ...staticStyle } = leaf.style; return staticStyle; });
  for (const direction of [[0, 0, 1], [1, 1, 1], [-1, .2, .5]] as const) runtime.publish(publication(direction));
  expect(document.count).toBe(count); expect(meshes.flatMap(mesh => mesh.children)).toEqual(leaves);
  expect(leaves.map(leaf => { const { opacity, display, visibility, backgroundImage, ...staticStyle } = leaf.style; return staticStyle; })).toEqual(styles); expect(resolver).toHaveBeenCalledTimes(9);
  expect(camera.style.perspectiveOrigin).toBe('calc(50% + 17px) calc(50% + -11px)');
  runtime.destroy(); runtime.destroy(); expect(host.children).toEqual([before]);
  runtime.publish(publication([1, 0, 0])); expect(document.count).toBe(count);
});


test.each(['leaf', 'frame'])('prepared %s bounds defer offscreen textures and restore retained optical copies', bounds => {
  const data = payload(3);
  if (bounds === 'leaf') for (const stack of data.stacks) for (const leaf of stack.leaves) Object.assign(leaf, {
    boundsCssPixels: compileLeafBounds(leaf.style.transform.slice(9,-1), parseFloat(leaf.style.width), parseFloat(leaf.style.height)),
  });
  const { runtime, meshes, document, resolver } = mount(data), nodes = meshes.flatMap(m => m.children), count = document.count;
  const view = (position: VolumeVector) => ({ ...publication([0,0,1], position), viewport: { focalPixels:600, principalOffsetPixels:[17,-11] as const, widthPixels:1000, heightPixels:800 } });
  runtime.publish(view([100,0,10]));
  expect(nodes.every(n => n.style.visibility === 'hidden')).toBe(true);
  expect(nodes.every(n => !n.style.backgroundImage)).toBe(true);
  for (const n of nodes) n.propertyWrites.length = 0;
  runtime.publish(view([100,0,10]));
  expect(nodes.flatMap(n => n.propertyWrites)).toEqual([]);
  runtime.publish(view([0,0,10]));
  expect(nodes.every(n => n.style.visibility === '')).toBe(true);
  expect([...new Set(nodes.map(node => node.style.backgroundImage).filter(Boolean))]).toEqual(['url("/prepared/z.png")']);
  expect(meshes.flatMap(m => m.children)).toEqual(nodes);
  expect(document.count).toBe(count);
  expect(resolver).toHaveBeenCalledTimes(9);
});

test('material replacement survives first visibility of every deferred axis', () => {
  const { runtime, meshes } = mount(payload(3));
  runtime.publish(publication([0, 0, 1]));
  const textures = ['x', 'y', 'z'].map(axis => `/colored/${axis}.png`);
  runtime.setTextures(textures.flatMap(texture => [texture, texture, texture]));
  expect(meshes[0]!.children.every(node => !node.style.backgroundImage)).toBe(true);
  for (const direction of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) runtime.publish(publication(direction));
  for (const [axis, mesh] of meshes.entries()) for (const node of mesh.children)
    expect(node.style.backgroundImage).toBe(`url("${textures[axis]}")`);
});

test('tone callbacks update a hidden axis without revealing it before rotation', async () => {
  const { createToneResourceController } = await import('@cssearth/volume-viewer/scene/tone-resources');
  const originalImage = globalThis.Image;
  globalThis.Image = class { src = ''; naturalWidth = 10; naturalHeight = 10; async decode() {} } as unknown as typeof Image;
  try {
    const { runtime, meshes } = mount(payload(3));
    runtime.publish(publication([0, 0, 1]));
    const tone = createToneResourceController({ isAllowedUrl: () => true });
    tone.bind('x', 10, 10, meshes[0]!.children as unknown as HTMLElement[], url => runtime.setTexture(0, url));
    await tone.apply([{ sourcePath: 'x', url: '/tone/x.png', width: 10, height: 10 }], ['x'], () => true);
    expect(meshes[0]!.children.every(node => !node.style.backgroundImage)).toBe(true);
    runtime.publish(publication([1, 0, 0]));
    expect(meshes[0]!.children.slice(0, 3).map(node => node.style.backgroundImage)).toEqual(Array(3).fill('url("/tone/x.png")'));
  } finally { globalThis.Image = originalImage; }
});

test('prepared rotated bank normals select the matching retained stack', () => {
  const data = payload();
  const normals: VolumeVector[] = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
  const rotated = { ...data, stacks: data.stacks.map((stack, index) => ({ ...stack, normalUnits: normals[index]! })) };
  const fixture = mount(rotated), count = fixture.document.count;
  fixture.runtime.publish(publication([0, 1, 0]));
  expect(fixture.roots[0]!.style.visibility).toBe('visible'); expect(fixture.roots[1]!.style.visibility).toBe('hidden');
  fixture.runtime.publish(publication([1, 0, 0]));
  expect(fixture.roots[0]!.style.visibility).toBe('hidden'); expect(fixture.roots[1]!.style.visibility).toBe('visible');
  expect(fixture.document.count).toBe(count);
});
