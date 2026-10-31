import { readFileSync } from 'node:fs';
import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedCssVolume, type PreparedCssVolume, type VolumeVector } from '@cssearth/objects';
import { mountPreparedCssVolume, transparentStackOpacities, completedStackOpacities } from './prepared-volume-runtime.ts';
import type { VolumeCameraPublication } from './types.ts';

import { stubGlobal, unstubAllGlobals } from '@cssearth/objects/node/contract';

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
const payload = (count = 1): PreparedCssVolume => validatePreparedCssVolume({
  schema: 'cssearth-css-volume@1', id: 'fixture', frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } }, anchors: [],
  stacks: AXES.map((axis, coordinate) => ({ axis, leaves: Array.from({ length: count }, (_, index) => {
    const depth = -1 + (index + .5) * 2 / count, center: [number, number, number] = [0, 0, 0]; center[coordinate] = depth;
    const transform = axis === 'x' ? [50, 0, 0, 0, 0, 0, 50, 0, 0, -1, 0, 0, -50, 50 * depth, -50, 1] :
      axis === 'y' ? [0, 50, 0, 0, 0, 0, 50, 0, 1, 0, 0, 0, 50 * depth, -50, -50, 1] :
        [0, 50, 0, 0, 50, 0, 0, 0, 0, 0, -1, 0, -50, -50, 50 * depth, 1];
    return { id: `${axis}-${index}`, centerUnits: center, texturePath: `${axis}.png`, widthPx: 1, heightPx: 1,
      style: { width: '2px', height: '2px', transform: `matrix3d(${transform})`, backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } };
  }) })), resources: AXES.map(axis => ({ path: `${axis}.png`, bytes: 1, width: 1, height: 1 })), provenance: {}, approximation: {},
});
function mount(data = payload(), residentStacks = false) {
  stubGlobal('HTMLElement', FakeElement); stubGlobal('Element', FakeElement);
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.append(before);
  const resolver = mock.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssVolume({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload: validatePreparedCssVolume({ ...data }), residentStacks, resolveResource: resolver });
  const roots = runtime.roots as unknown as FakeElement[], root = roots[0]!, camera = root.children[0]!, scene = camera.children[0]!;
  const meshes = roots.map(node => node.children[0]!.children[0]!.children[0]!);
  return { data, document, host, before, runtime, roots, root, camera, scene, meshes, resolver };
}
function publication(direction: VolumeVector, position: VolumeVector = [0, 0, 10]): VolumeCameraPublication {
  const length = Math.hypot(...direction), [x, y, z] = direction.map(value => value / length);
  const quaternion: readonly [number, number, number, number] = z < -.999999999 ? [0, 1, 0, 0] : [-y / Math.sqrt(2 * (1 + z)), x / Math.sqrt(2 * (1 + z)), 0, Math.sqrt((1 + z) / 2)];
  return { world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: position, orientationXyzw: quaternion } }, viewport: { focalPixels: 600, principalOffsetPixels: [17, -11] } };
}
afterEach(() => unstubAllGlobals());

test('normalized transparent overlap cannot exceed the weighted completed emission', () => {
  for (const weights of [[1, 1, 0], [1, 1, 1], [1, .2, .6]]) for (const alpha of [.05, .5, 1]) {
    const opacities = transparentStackOpacities(weights); let actual = 0, ceiling = 0;
    for (let i = 0; i < 3; i++) { const emission = [.2, .7, .4][i]! * alpha, share = opacities[i]!; actual = emission * share + actual * (1 - alpha * share); ceiling += emission * share; }
    assert.ok(actual <= ceiling + 1e-14); assert.ok(opacities.reduce((s, v) => s + v, 0) <= .999001);
  }
  assert.notDeepEqual(transparentStackOpacities([1, 1, 0]), completedStackOpacities([1, 1, 0]), 'Opaque compensation is invalid for a transparent footprint');
});

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

test('hybrid slabs publish two dense optical layers and keep the retained geometry stable',()=>{
  const original=payload(),stacks=original.stacks.map(stack=>({...stack,leaves:stack.leaves.map(leaf=>({...leaf,opticalSlab:{id:leaf.id,role:'merged-three' as const}}))})),base=stacks[2]!.leaves[0]!;
  const data:PreparedCssVolume={...original,mergedOpticalCopies:3,frame:{...original.frame,boundsUnits:{min:[-1,-1,-.1],max:[1,1,.1]}},stacks:[stacks[0]!,stacks[1]!,{axis:'z',leaves:[{...base,opticalSlab:{id:base.id,role:'single'}},{...base,id:'z-pair',opticalSlab:{id:base.id,role:'merged-two'}}]}]};
  const {runtime,meshes,document}=mount(data,true),nodes=meshes.flatMap(m=>m.children),count=document.count;
  runtime.publish(publication([0,0,1]));assert.equal(copyOpacity(meshes[2]!.children[0]!),.998);assert.equal(copyOpacity(meshes[2]!.children[1]!),.001);
  runtime.publish(publication([0,Math.sqrt(3),1]));assert.equal(copyOpacity(meshes[2]!.children[0]!),.998);assert.equal(copyOpacity(meshes[2]!.children[1]!),127/255);
  assert.equal(nodes.length,4);assert.equal(document.count,count);assert.deepEqual(meshes.flatMap(m=>m.children),nodes);
  for(const node of nodes)node.propertyWrites.length=0;runtime.publish(publication([0,Math.sqrt(3),1]));assert.deepEqual(nodes.flatMap(n=>n.propertyWrites),[]);
});

test('optical copies reuse canonical textures and transforms inside isolated unflattened axis cameras', () => {
  const { data, runtime, roots, meshes, resolver } = mount(payload(3)); runtime.publish(publication([1, 1, 1]));
  assert.equal(roots.length, 3);
  for (let axis = 0; axis < 3; axis++) {
    const root = roots[axis]!, camera = root.children[0]!, scene = camera.children[0]!, mesh = meshes[axis]!;
    assert.deepEqual(root.children, [camera]); assert.deepEqual(camera.children, [scene]); assert.deepEqual(scene.children, [mesh]);
    for (const ancestor of [camera, scene, mesh]) { assert.equal(ancestor.style.opacity, undefined); assert.equal(ancestor.style.background, undefined); }
    assert.equal(mesh.children.length, 9);
    for (const node of [root, camera, scene, mesh, ...mesh.children]) assert.deepEqual(node.dataset, {});
    for (let index = 0; index < 3; index++) {
      const copies = mesh.children.slice(index * 3, index * 3 + 3), original = copies[0]!;
      assert.partialDeepStrictEqual(original.style, data.stacks[axis]!.leaves[index]!.style);
      assert.equal(original.style.opacity, undefined);
      for (let copy = 1; copy < 3; copy++) {
        // A shown copy keeps the 8-bit step nearest its exact alpha, held inside [0.001, 0.999].
        assert.equal(Number(copies[copy]!.style.opacity), copy === 1 ? Math.round((Math.sqrt(3) - 1) * 255) / 255 : .001);
        assert.equal(copies[copy]!.style.transform, original.style.transform);
        assert.equal(copies[copy]!.style.backgroundImage, original.style.backgroundImage);
      }
    }
  }
  assert.equal(resolver.mock.callCount(), 9);
  const css = readFileSync(new URL('../styles/volume.css', import.meta.url), 'utf8');
  assert.match(css, /\.css-volume-projection\s*\{[^}]*background:\s*#000[^}]*transform-style:\s*flat/su);
  assert.match(css, /\.css-volume-camera,\s*\.css-volume-scene,\s*\.css-volume-mesh\s*\{[^}]*transform-style:\s*preserve-3d/su);
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
  assert.notDeepEqual(scenes.map(scene => scene.style.transform), transforms);
  assert.deepEqual(roots.map(root => root.propertyWrites), [[], [], []]);
  assert.deepEqual(roots.map(root => [opticalGain(root), root.style.opacity]), optics);
  runtime.publish(publication([1, 0, 0], [3, 4, 12]));
  assert.equal(roots.every(root => root.propertyWrites.every(name => !name.startsWith('--'))), true);
  assert.equal(roots[0]!.style.visibility, 'visible');
  assert.equal(roots[1]!.style.visibility, 'hidden');
  runtime.destroy();
});

test('rotation only publishes changed optical copies and translation leaves their opacity untouched', () => {
  const { runtime, meshes } = mount(payload(3));
  runtime.publish(publication([1, .3, 0]));
  const leaves = meshes.flatMap(mesh => mesh.children);
  for (const leaf of leaves) leaf.propertyWrites.length = 0;
  runtime.publish(publication([1, .35, 0]));
  // Only X's fractional first copy steps (11/255 to 15/255). Its base and its
  // second copy held at 0.001, and both inactive axes, keep their presentation.
  assert.deepEqual(meshes.map(mesh => mesh.children.map(leaf => leaf.propertyWrites)), [
    [[], ['opacity'], [], [], ['opacity'], [], [], ['opacity'], []],
    Array.from({ length: 9 }, () => []), Array.from({ length: 9 }, () => []),
  ]);
  for (const leaf of leaves) leaf.propertyWrites.length = 0;
  runtime.publish(publication([1, .35, 0], [4, 5, 12]));
  assert.equal(leaves.every(leaf => leaf.propertyWrites.length === 0), true);
});

test('prepared homogeneous emission keeps physical optical density through a full rotation and stack handoffs', () => {
  const count = 256, data = payload(count), { runtime, roots, meshes } = mount(data);
  // Canonical one-byte alpha from the producer's homogeneous emission contract.
  const alpha = 1 / 255, density = -count * Math.log1p(-alpha) / 2;
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
  assert.ok(worstDensityError < .005);
  assert.ok(oldDominantError > .4);
});

test('coincident copies preserve opaque dust and exactly multiply integer optical lengths', () => {
  const { runtime, roots, meshes } = mount();
  // X remains inside the active band while its optical length is doubled; steady copies hold 0.999 and 0.001, each
  // within 1/510 of exact, so the doubled length is kept to that step and opaque dust stays opaque.
  runtime.publish(publication([.5, Math.sqrt(.375), Math.sqrt(.375)]));
  const root = roots[0]!, copies = meshes[0]!.children;
  assert.ok(Math.abs(opticalGain(root) - 2) < 1e-12, `${opticalGain(root)} is not close to 2`);
  for (const alpha of [0, 1 / 255, .25, .5, .8, 1]) assert.ok(Math.abs(sliceTransmission(copies, alpha) - ((1 - alpha) ** 2)) < 2 / 510, `${sliceTransmission(copies, alpha)} is not close to ${(1 - alpha) ** 2}`);
  runtime.publish(publication([1, 1, 1]));
  for (let axis = 0; axis < 3; axis++) assert.equal(sliceTransmission(meshes[axis]!.children, 1), 0);
  runtime.publish(publication([.47, Math.sqrt((1 - .47 ** 2) / 2), Math.sqrt((1 - .47 ** 2) / 2)]));
  assert.equal(root.style.visibility, 'visible'); assert.ok(copyOpacity(copies[2]!) > 0);
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
      assert.ok(value.gain >= 1); assert.ok(value.gain < 2.15);
      assert.ok(Math.abs(value.gain - (negative[index]!.gain)) < 10 ** -9 / 2, `${value.gain} is not close to ${negative[index]!.gain}`); assert.ok(Math.abs(value.opacity - (negative[index]!.opacity)) < 10 ** -9 / 2, `${value.opacity} is not close to ${negative[index]!.opacity}`);
    });
  }
  const nearTwo = (x: number): VolumeVector => [x, Math.sqrt((1 - x * x) / 2), Math.sqrt((1 - x * x) / 2)];
  const below = sample(nearTwo(.5 - 1e-7)), above = sample(nearTwo(.5 + 1e-7));
  assert.ok(Math.abs(below[0]!.transmission - above[0]!.transmission) < 1e-6);
});

test('rotation keeps geometry and texture resources stable while publishing leaf opacity', () => {
  const { runtime, document, meshes, resolver, host, before, camera } = mount(payload(3));
  // Opacity, culling and deferred textures are published presentation, not geometry.
  const leaves = meshes.flatMap(mesh => mesh.children), count = document.count, styles = leaves.map(leaf => { const { opacity, display, visibility, backgroundImage, ...staticStyle } = leaf.style; return staticStyle; });
  for (const direction of [[0, 0, 1], [1, 1, 1], [-1, .2, .5]] as const) runtime.publish(publication(direction));
  assert.equal(document.count, count); assert.deepEqual(meshes.flatMap(mesh => mesh.children), leaves);
  assert.deepEqual(leaves.map(leaf => { const { opacity, display, visibility, backgroundImage, ...staticStyle } = leaf.style; return staticStyle; }), styles); assert.equal(resolver.mock.callCount(), 9);
  assert.equal(camera.style.perspectiveOrigin, 'calc(50% + 17px) calc(50% + -11px)');
  runtime.destroy(); runtime.destroy(); assert.deepEqual(host.children, [before]);
  runtime.publish(publication([1, 0, 0])); assert.equal(document.count, count);
});

for (const bounds of ['leaf', 'frame']) test(`prepared ${bounds} bounds defer offscreen textures and restore retained optical copies`, () => {
  const data = payload(3);
  if (bounds === 'leaf') for (const [coordinate, stack] of data.stacks.entries()) for (const leaf of stack.leaves) {
    const cssAxis = [1, 0, 2][coordinate]!, depth = leaf.centerUnits[coordinate]! * 50;
    const min: [number,number,number] = [-50,-50,-50], max: [number,number,number] = [50,50,50];
    min[cssAxis] = depth; max[cssAxis] = depth;
    Object.assign(leaf, { boundsCssPixels: { min, max } });
  }
  const { runtime, meshes, document, resolver } = mount(data), nodes = meshes.flatMap(m => m.children), count = document.count;
  const view = (position: VolumeVector) => ({ ...publication([0,0,1], position), viewport: { focalPixels:600, principalOffsetPixels:[17,-11] as const, widthPixels:1000, heightPixels:800 } });
  runtime.publish(view([100,0,10]));
  assert.equal(nodes.every(n => n.style.visibility === 'hidden'), true);
  assert.equal(nodes.every(n => !n.style.backgroundImage), true);
  for (const n of nodes) n.propertyWrites.length = 0;
  runtime.publish(view([100,0,10]));
  assert.deepEqual(nodes.flatMap(n => n.propertyWrites), []);
  runtime.publish(view([0,0,10]));
  assert.equal(nodes.every(n => n.style.visibility === ''), true);
  assert.deepEqual(([...new Set(nodes.map(node => node.style.backgroundImage).filter(Boolean))]), ['url("/prepared/z.png")']);
  assert.deepEqual(meshes.flatMap(m => m.children), nodes);
  assert.equal(document.count, count);
  assert.equal(resolver.mock.callCount(), 9);
});

test('a stack the camera turns to joins eight slices a frame, every eighth slice first, and leaves whole at rest', () => {
  const frames: ((time: number) => void)[] = [];
  let now = 0;
  const frame = () => { now += 16; frames.shift()!(now); };
  stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => frames.push(callback));
  stubGlobal('cancelAnimationFrame', () => {});
  stubGlobal('performance', { now: () => now });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { runtime, roots, meshes } = mount(payload(100));
    const slices = meshes[2]!.children.filter((_, index) => index % 3 === 0), shown = () => slices.filter(node => node.style.display === '').length;
    runtime.publish(publication([0, 0, 1]));
    assert.equal(roots[2]!.style.display, 'none', 'a stack is never displayed empty: Safari would not draw the slices that join it');
    assert.equal(shown(), 0);
    frame();
    assert.equal(roots[2]!.style.display, 'block', 'its root is displayed in the frame its first slices are');
    assert.equal(shown(), 8);
    for (const index of [0, 8, 56]) assert.equal(slices[index]!.style.display, '');
    for (const index of [1, 4, 64]) assert.equal(slices[index]!.style.display, 'none');
    frame();
    assert.equal(shown(), 16, 'eight a frame, never more');
    let joining = 2;
    while (shown() < 100) { frame(); joining++; }
    assert.equal(joining, 13, 'a hundred slices, eight a frame');
    // Turned away, the stack stays while the camera moves, then leaves in one frame.
    runtime.publish(publication([1, 0, 0]));
    while (frames.length) frame();
    assert.equal(shown(), 100); assert.equal(roots[2]!.style.display, 'block');
    now += 1000; mock.timers.tick(1000);
    frame();
    assert.equal(shown(), 0); assert.equal(roots[2]!.style.display, 'none');
    runtime.destroy();
  } finally {
    // The document's frame clock is shared: leave it idle, or the next test's frames never arrive.
    for (let left = 0; frames.length && left < 100; left++) frame();
    mock.timers.reset();
  }
});

test('a turning camera never takes a shown optical copy to opacity 0 or 1, nor retires one while its stack is visible', () => {
  const frames: ((time: number) => void)[] = [];
  let now = 0;
  const frame = () => { now += 16; frames.shift()?.(now); };
  stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => frames.push(callback));
  stubGlobal('cancelAnimationFrame', () => {});
  stubGlobal('performance', { now: () => now });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { runtime, roots, meshes } = mount(payload(3));
    // X's optical gain runs from 1 through 2 and back as the camera turns from +X towards (1,1,1)-like views: its
    // first copy crosses exact alpha 0 and 1, its second copy exact alpha 0. Stacks join, and the turn rests twice.
    const path: VolumeVector[] = [];
    for (let step = 0; step <= 120; step++) {
      const x = 1 - .53 * Math.sin(step / 120 * Math.PI), side = Math.sqrt((1 - x * x) / 2);
      path.push([x, side, side]);
    }
    // Copies of a visible stack join eight slices a frame; once joined, a copy stays until its stack is hidden.
    const joined = new Set<FakeElement>();
    const check = (where: string, settled: boolean) => {
      for (const [axis, root] of roots.entries()) {
        const nodes = meshes[axis]!.children.filter((_, index) => index % 3 !== 0);
        if (!(Number(root.style.opacity) > 0)) { for (const node of nodes) joined.delete(node); continue; }
        for (const node of nodes) {
          const opacity = Number(node.style.opacity);
          assert.ok(opacity > 0 && opacity < 1, `${where}: axis ${axis} copy opacity ${node.style.opacity}`);
          const shown = root.style.display === 'block' && node.style.display !== 'none';
          if (joined.has(node)) assert.ok(shown, `${where}: axis ${axis} copy retired while its stack is visible`);
          else if (settled) assert.ok(shown, `${where}: axis ${axis} copy not joined at rest while its stack is visible`);
          if (shown) joined.add(node);
        }
      }
    };
    for (const [step, direction] of path.entries()) {
      runtime.publish(publication(direction));
      frame(); check(`step ${step}`, false);
      if (step === 30 || step === 60 || step === 90) {
        // The camera rests: anything the turn no longer wants retires now.
        now += 1000; mock.timers.tick(1000);
        for (let rest = 0; rest < 8; rest++) { frame(); if (!frames.length) break; }
        check(`rest at step ${step}`, true);
      }
    }
    runtime.destroy();
  } finally {
    // The document's frame clock is shared: leave it idle, or the next test's frames never arrive.
    for (let left = 0; frames.length && left < 100; left++) frame();
    mock.timers.reset();
  }
});

test('a stack alone in the mix stays just under opaque, so its root never crosses opacity 1', () => {
  const { runtime, roots } = mount(payload(3));
  runtime.publish(publication([0, 0, 1]));
  assert.deepEqual(roots.map(root => root.style.opacity), ['0', '0', '0.999']);
  runtime.publish(publication([1, 0, 0]));
  assert.equal(roots[0]!.style.opacity, '0.999');
  for (const direction of [[1, 1, 1], [1, .9, 0], [0, 1, .95], [0, -1, 0]] as const) {
    runtime.publish(publication(direction));
    for (const root of roots) assert.ok(Number(root.style.opacity) <= .999, `opacity ${root.style.opacity}`);
  }
  runtime.destroy();
});

test('a stack without leaves takes no part in the choice of view: the stack that draws keeps the whole weight', () => {
  // A thin disc prepared as sheets has leaves in one stack only.
  const sheets = payload(3), only = { ...sheets, stacks: sheets.stacks.map(stack => stack.axis === 'z' ? stack : { ...stack, leaves: [] }),
    resources: sheets.resources.filter(resource => resource.path === 'z.png') };
  const { runtime, roots } = mount(only);
  for (const direction of [[0, 0, 1], [1, 1, 1], [1, 0, .3], [1, 0, .05], [0, 1, .01]] as const) {
    runtime.publish(publication(direction));
    assert.deepEqual(roots.map(root => root.style.opacity), ['0', '0', '0.999'], `view ${direction.join(',')}`);
  }
  runtime.destroy();
});

test('material replacement survives first visibility of every deferred axis', () => {
  const { runtime, meshes } = mount(payload(3));
  runtime.publish(publication([0, 0, 1]));
  const textures = ['x', 'y', 'z'].map(axis => `/colored/${axis}.png`);
  runtime.setTextures(textures.flatMap(texture => [texture, texture, texture]));
  assert.equal(meshes[0]!.children.every(node => !node.style.backgroundImage), true);
  for (const direction of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) runtime.publish(publication(direction));
  for (const [axis, mesh] of meshes.entries()) for (const node of mesh.children)
    assert.equal(node.style.backgroundImage, `url("${textures[axis]}")`);
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
    assert.equal(meshes[0]!.children.every(node => !node.style.backgroundImage), true);
    runtime.publish(publication([1, 0, 0]));
    assert.deepEqual(meshes[0]!.children.slice(0, 3).map(node => node.style.backgroundImage), Array(3).fill('url("/tone/x.png")'));
  } finally { globalThis.Image = originalImage; }
});

test('prepared rotated bank normals select the matching retained stack', () => {
  const data = payload();
  const normals: VolumeVector[] = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
  const rotated = { ...data, stacks: data.stacks.map((stack, index) => ({ ...stack, normalUnits: normals[index]! })) };
  const fixture = mount(rotated), count = fixture.document.count;
  fixture.runtime.publish(publication([0, 1, 0]));
  assert.equal(fixture.roots[0]!.style.visibility, 'visible'); assert.equal(fixture.roots[1]!.style.visibility, 'hidden');
  fixture.runtime.publish(publication([1, 0, 0]));
  assert.equal(fixture.roots[0]!.style.visibility, 'hidden'); assert.equal(fixture.roots[1]!.style.visibility, 'visible');
  assert.equal(fixture.document.count, count);
});


test('resident background stacks admit every coast-reachable image before motion and change only transforms/opacities', () => {
  const { runtime, roots, meshes, document } = mount(payload(3), true);
  runtime.publish(publication([0, 0, 1]));
  const nodes = roots.flatMap(root => [root, root.children[0]!, root.children[0]!.children[0]!, ...root.children[0]!.children[0]!.children, ...root.children[0]!.children[0]!.children[0]!.children]);
  assert.ok(roots.every(root => root.style.display === 'block' && root.style.visibility === 'visible'));
  assert.ok(meshes.every(mesh => mesh.children.every(leaf => leaf.style.display === '' && leaf.style.backgroundImage)));
  const count = document.count;
  for (const direction of [[1, 0, 0], [1, 1, .1], [0, -1, 0], [0, 0, -1]] as const) {
    for (const node of nodes) node.propertyWrites.length = 0;
    runtime.publish(publication(direction, [100, 0, 10]));
    assert.ok(nodes.flatMap(node => node.propertyWrites).every(name => ['opacity', 'transform'].includes(name)));
    assert.equal(document.count, count);
  }
  runtime.destroy();
});


test('mounted thin-volume roots preserve equal completed light through the full edge handover', () => {
  const source = payload(3), data = { ...source, frame: { ...source.frame, boundsUnits: { min: [-1, -1, -.125] as const, max: [1, 1, .125] as const } } };
  const { runtime, roots } = mount(data, true);
  for (const azimuth of [0, .3, .8, 1.5]) for (let degree = 0; degree <= 90; degree++) {
    const angle = degree * Math.PI / 180;
    runtime.publish(publication([Math.cos(angle) * Math.cos(azimuth), Math.cos(angle) * Math.sin(azimuth), Math.sin(angle)]));
    if (degree >= 10) assert.deepEqual(roots.map(root => Number(root.style.opacity)), [0, 0, .999]);
    let light = 0;
    for (const root of roots) { const opacity = Number(root.style.opacity); light = .37 * opacity + light * (1 - opacity); }
    assert.ok(Math.abs(light - .37 * .999) < 1e-12);
  }
  runtime.destroy();
});

test('mounted thin handover follows pure translation and preserves light without coast membership changes',()=>{
 const source=payload(3),data={...source,frame:{...source.frame,boundsUnits:{min:[-1,-1,-.2] as const,max:[1,1,.2] as const}}};
 const {runtime,roots,meshes,document}=mount(data,true),angle=12*Math.PI/180,direction=[Math.cos(angle),0,Math.sin(angle)] as const;
 runtime.publish(publication(direction,[0,0,10]));assert.equal(Number(roots[2]!.style.opacity),.999);
 const nodes=roots.flatMap((root,i)=>[root,...meshes[i]!.children]),count=document.count;
 for(const distance of[1.7,1.5,1,.5,.2,.5,1,10]){
  const previousZ=Number(roots[2]!.style.opacity);
  for(const n of nodes)n.propertyWrites.length=0;
  runtime.publish(publication(direction,[0,0,distance]));
  if(distance===1.5)assert.ok(Number(roots[2]!.style.opacity)<previousZ,'pure zoom must publish its changed handover inside the active fade');
  if(distance===.2)assert.equal(Number(roots[2]!.style.opacity),0,'pure zoom must publish its changed handover');
  if(distance===10)assert.equal(Number(roots[2]!.style.opacity),.999);
  let light=0;for(const root of roots){const a=Number(root.style.opacity);light=.37*a+light*(1-a);}
  assert.ok(Math.abs(light-.37*.999)<1e-12);assert.equal(document.count,count);
  assert.ok(nodes.flatMap(n=>n.propertyWrites).every(k=>['transform','opacity'].includes(k)));
 }
 runtime.destroy();
});

test('a bank with merged optical copies draws one layer a slice, exact for faint material and lighter where dense', () => {
  const merged = { ...payload(3), mergedOpticalCopies: 3 as const };
  const { runtime, meshes } = mount(merged), stacked = mount(payload(3));
  for (const [view, direction] of [['straight on', [0, 0, 1]], ['oblique', [1, 1, 1]], ['grazing', [.05, .05, 1]]] as const) {
    runtime.publish(publication(direction)); stacked.runtime.publish(publication(direction));
    for (let axis = 0; axis < 3; axis++) {
      const mesh = meshes[axis]!, copies = stacked.meshes[axis]!;
      assert.equal(mesh.children.length, 3, `${view}: one layer a slice, not three`);
      if (stacked.roots[axis]!.style.opacity === '0') continue;
      // Faint material: the merged image's alpha at its opacity transmits what the three stacked copies do.
      for (const alpha of [.01, .05]) {
        const mergedAlpha = Math.round((1 - (1 - alpha) ** 3) * 255) / 255;
        const transmitted = 1 - mergedAlpha * copyOpacity(mesh.children[0]!);
        assert.ok(Math.abs(transmitted - sliceTransmission(copies.children.slice(0, 3), alpha)) < .006,
          `${view} axis ${axis} alpha ${alpha}: ${transmitted} vs ${sliceTransmission(copies.children.slice(0, 3), alpha)}`);
      }
      // The accepted limit (README): one scalar opacity scales a dense pixel's merged alpha linearly, so face-on an
      // opaque pixel draws at a third and half-opaque at 0.29 where stacked copies draw 1 and 0.5.
      if (view === 'straight on' && axis === 2) {
        assert.ok(Math.abs(1 * copyOpacity(mesh.children[0]!) - 1 / 3) < .003);
        assert.ok(Math.abs((1 - .5 ** 3) * copyOpacity(mesh.children[0]!) - .2917) < .003);
        assert.equal(1 - sliceTransmission(copies.children.slice(0, 3), 1), 1);
      }
    }
  }
});
