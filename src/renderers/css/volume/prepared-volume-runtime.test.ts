import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { bakeSlab } from '../../../preparation/volume/slices.js';
import type { VolumeRecipe } from '../../../preparation/volume/config.js';
import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import type { PreparedCssVolume, VolumeCameraPublication, VolumeVector } from './types.js';

const AXES = ['x', 'y', 'z'] as const;
class FakeElement {
  readonly children: FakeElement[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null; className = '';
  constructor(readonly ownerDocument: FakeDocument, readonly tagName: string) { Object.defineProperty(this.style, 'setProperty', { value: (name: string, value: string) => { this.style[name] = value; } }); }
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

function copyOpacity(root: FakeElement, copy: FakeElement): number {
  const match = /var\((--volume-optical-copy-\d), 0\)/u.exec(copy.style.opacity ?? '');
  return match ? Number(root.style[match[1]!]) : 1;
}
function sliceTransmission(root: FakeElement, copies: readonly FakeElement[], alpha: number): number {
  return copies.reduce((transmission, copy) => transmission * (1 - alpha * copyOpacity(root, copy)), 1);
}

test('optical copies reuse canonical textures and transforms inside isolated unflattened axis cameras', () => {
  const { runtime, roots, meshes, resolver } = mount(payload(3)); runtime.publish(publication([1, 1, 1]));
  expect(roots).toHaveLength(3); expect(roots.map(root => root.dataset.volumeAxis)).toEqual(AXES);
  for (let axis = 0; axis < 3; axis++) {
    const root = roots[axis]!, camera = root.children[0]!, scene = camera.children[0]!, mesh = meshes[axis]!;
    expect(root.children).toEqual([camera]); expect(camera.children).toEqual([scene]); expect(scene.children).toEqual([mesh]);
    for (const ancestor of [camera, scene, mesh]) { expect(ancestor.style.opacity).toBeUndefined(); expect(ancestor.style.background).toBeUndefined(); }
    expect(mesh.children.filter(node => node.dataset.volumeSlice)).toHaveLength(3);
    expect(mesh.children.filter(node => node.dataset.volumeSliceCopy)).toHaveLength(6);
    for (let index = 0; index < 3; index++) {
      const copies = mesh.children.slice(index * 3, index * 3 + 3), original = copies[0]!;
      expect(original.dataset.volumeSlice).toBe(`${AXES[axis]}-${index}`);
      for (let copy = 1; copy < 3; copy++) {
        expect(copies[copy]!.dataset.volumeSliceCopy).toBe(`${original.dataset.volumeSlice}:${copy}`);
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

test('actual baked homogeneous emission keeps physical optical density through a full rotation and stack handoffs', () => {
  const count = 256, data = payload(count), { runtime, roots, meshes } = mount(data);
  const recipe: VolumeRecipe = { schema: 'cssearth-volume-recipe@1', grid: { path: 'density.ktx2', sha256: 'a'.repeat(64), decodedSha256: 'b'.repeat(64),
    dimensions: [1, 1, 1], encoding: 'sqrt-density-unorm8', bounds: { min: [-1, -1, -1], max: [1, 1, 1] } },
    material: { emission: [0, 1, 2].map(channel => ({ channel, color: [Number(channel === 0), Number(channel === 1), Number(channel === 2)], strength: 1 })),
      absorption: [], intensityScale: 1, stepScale: 1, exposureGain: 16 },
    bake: { sliceCounts: { x: count, y: count, z: count }, unitsPerSourceUnit: 1, imageWidth: 1, samplesPerSlab: 1, cropTransparent: false, opticalWeight: 1 },
    anchors: [], provenance: { path: 'provenance.json', sha256: 'c'.repeat(64) } };
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
        transmission *= sliceTransmission(root, meshes[axis]!.children.slice(index * 3, index * 3 + 3), alpha);
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
  expect(Number(root.dataset.volumeOpticalGain)).toBeCloseTo(2, 12);
  for (const alpha of [0, 1 / 255, .25, .5, .8, 1]) expect(sliceTransmission(root, copies, alpha)).toBeCloseTo((1 - alpha) ** 2, 12);
  runtime.publish(publication([1, 1, 1]));
  for (let axis = 0; axis < 3; axis++) expect(sliceTransmission(roots[axis]!, meshes[axis]!.children, 1)).toBe(0);
  runtime.publish(publication([.47, Math.sqrt((1 - .47 ** 2) / 2), Math.sqrt((1 - .47 ** 2) / 2)]));
  expect(root.style.visibility).toBe('visible'); expect(copyOpacity(root, copies[2]!)).toBeGreaterThan(0);
});

test('the active band has enough retained copies and remains continuous across gain and direction boundaries', () => {
  const { runtime, roots, meshes } = mount();
  const sample = (direction: VolumeVector) => {
    runtime.publish(publication(direction));
    return roots.map((root, axis) => ({ gain: Number(root.dataset.volumeOpticalGain), opacity: Number(root.style.opacity), transmission: sliceTransmission(root, meshes[axis]!.children, .3) }));
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

test('rotation only updates camera, root weights and inherited copy coefficients', () => {
  const { runtime, document, meshes, resolver, host, before, camera } = mount(payload(3));
  const leaves = meshes.flatMap(mesh => mesh.children), count = document.count, styles = leaves.map(leaf => ({ ...leaf.style }));
  for (const direction of [[0, 0, 1], [1, 1, 1], [-1, .2, .5]] as const) runtime.publish(publication(direction));
  expect(document.count).toBe(count); expect(meshes.flatMap(mesh => mesh.children)).toEqual(leaves);
  expect(leaves.map(leaf => leaf.style)).toEqual(styles); expect(resolver).toHaveBeenCalledTimes(9);
  expect(camera.style.perspectiveOrigin).toBe('calc(50% + 17px) calc(50% + -11px)');
  runtime.destroy(); runtime.destroy(); expect(host.children).toEqual([before]);
  runtime.publish(publication([1, 0, 0])); expect(document.count).toBe(count);
});
