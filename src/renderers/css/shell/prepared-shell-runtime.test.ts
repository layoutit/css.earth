import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { expect, test, vi } from 'vitest';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { mountPreparedCssSurfaceShell } from './prepared-shell-runtime.js';
import type { PreparedCssSurfaceShell } from './types.js';
import { validatePreparedCssSurfaceShell } from './validation.js';

function fixture(): PreparedCssSurfaceShell {
  return {
    schema: 'cssearth-css-surface-shell@1', id: 'fixture', unitScale: 37,
    frame: { referenceFrame: 'fixture-frame', epochJdTt: 123, originM: [120, 300, -70], localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
      metersPerUnit: 10, boundsUnits: { min: [-2, -2, -2], max: [2, 2, 2] } },
    atlas: { path: 'materials/rim.png', tileSize: 16, columns: 4, frames: 8 },
    visibility: { hiddenInsideM: 10, fullUntilM: 100, hiddenBeyondM: 200 },
    faces: [face('near', [0, 0, 1], [0, 0, 1], [0, 0, 1]), face('far', [0, 0, -1], [0, 0, -1], [0, 0, -1])],
    resources: [{ path: 'materials/rim.png', sha256: 'a'.repeat(64), bytes: 100, width: 64, height: 32 }], provenance: {},
  };
}
function face(id: string, centerUnits: readonly [number, number, number], faceNormal: readonly [number, number, number], radialNormal: readonly [number, number, number]): PreparedCssSurfaceShell['faces'][number] {
  return { id, centerUnits, faceNormal, radialNormal, atlasStepPixels: [20, 30], atlasOriginPixels: [2, -3],
    style: { width: '12px', height: '14px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1)', backgroundSize: '80px 60px' } };
}
function world(payload: PreparedCssSurfaceShell, positionUnits: readonly [number, number, number], orientationXyzw: WorldCameraPose['pose']['orientationXyzw'] = [0, 0, 0, 1]): WorldCameraPose {
  return { referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
    pose: cameraPoseToReferenceFrame({ positionM: positionUnits.map(value => value * payload.frame.metersPerUnit) as unknown as readonly [number, number, number], orientationXyzw }, payload.frame) };
}
const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11] as const };

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly writes: Record<string, number> = {};
  readonly style = new Proxy({} as Record<string, string>, { set: (target, property: string, value: string) => {
    this.writes[property] = (this.writes[property] ?? 0) + 1; target[property] = value; return true;
  } });
  parentNode: FakeElement | null = null;
  className = ''; ariaHidden = '';
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  constructor(ownerDocument: FakeDocument, tagName: string) { this.ownerDocument = ownerDocument; this.tagName = tagName;}
  appendChild(child: FakeElement): FakeElement { this.insertBefore(child, null); return child; }
  insertBefore(child: FakeElement, before: FakeElement | null): void {
    child.remove(); child.parentNode = this;
    this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child);
  }
  remove(): void {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
}
class FakeDocument {
  created = 0;
  createElement(tagName = 'div'): FakeElement { this.created++; return new FakeElement(this, tagName); }
}
function mount(payload = fixture()) {
  const document = new FakeDocument(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const resolveResource = vi.fn((path: string) => `/prepared/${path}`);
  const runtime = mountPreparedCssSurfaceShell({ host: host as unknown as HTMLElement, before: before as unknown as Element, payload, resolveResource });
  const root = runtime.root as unknown as FakeElement, camera = root.children[0]!, scene = camera.children[0]!;
  return { payload, document, host, before, runtime, root, camera, scene, leaves: scene.children, resolveResource };
}

function vertexFixture(): PreparedCssSurfaceShell {
  const base = fixture(), triangle = face('triangle', [0, -1 / 3, 1], [0, 0, 1], [0, 0, 1]);
  return { ...base, atlas: { path: 'materials/rim.png', tileSize: 16, columns: 5, frames: 20, facingLevels: [-1, 0, .5, 1] },
    vertices: [{ positionUnits: [-1, -1, 1], radialNormal: [1, 0, 0] },
      { positionUnits: [1, -1, 1], radialNormal: [0, 1, 0] }, { positionUnits: [0, 1, 1], radialNormal: [0, 0, 1] }],
    faces: [{ ...triangle, vertexIndices: [0, 1, 2], materialTransforms: [triangle.style.transform,
      ...[1, 2, 3, 4, 5].map(i => `matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,${i},0,0,1)`)] }],
    resources: [{ ...base.resources[0]!, width: 80, height: 64 }] };
}

test('retains one leaf while addressing sorted vertex gradients and all-prepared corner transforms', () => {
  const payload = vertexFixture(), { runtime, leaves, document } = mount(payload), created = document.created;
  expect(validatePreparedCssSurfaceShell(payload)).toEqual(payload);
  runtime.publish(world(payload, [6, 2, 4]), viewport);
  expect(leaves[0]!.dataset.shellFrame).toBe('17');
  expect(leaves[0]!.style.transform).toBe(payload.faces[0]!.materialTransforms![3]);
  const writes = { ...leaves[0]!.writes };
  runtime.publish(world(payload, [6, 2, 4]), viewport);
  expect(leaves[0]!.writes).toEqual(writes);
  runtime.publish(world(payload, [-6, 2, 4]), viewport);
  expect(leaves[0]!.dataset.shellFrame).toBe('7');
  expect(leaves[0]!.style.transform).toBe(payload.faces[0]!.materialTransforms![0]);
  expect(document.created).toBe(created); expect(leaves).toHaveLength(1);
});

test.each([
  ['missing prepared vertices', (data: any) => { delete data.vertices; }],
  ['unsorted facing levels', (data: any) => { data.atlas.facingLevels = [-1, .5, 0, 1]; }],
  ['incomplete triple bank', (data: any) => { data.atlas.frames = 19; }],
  ['out-of-range vertex', (data: any) => { data.faces[0].vertexIndices[2] = 3; }],
  ['missing corner permutation', (data: any) => { data.faces[0].materialTransforms.pop(); }],
  ['runtime transform expression', (data: any) => { data.faces[0].materialTransforms[1] = 'rotate(20deg)'; }],
  ['wrong initial permutation', (data: any) => { data.faces[0].materialTransforms[0] = data.faces[0].materialTransforms[1]; }],
  ['nonunit vertex normal', (data: any) => { data.vertices[0].radialNormal = [2, 0, 0]; }],
] as const)('rejects vertex material %s', (_name, mutate) => {
  const payload = structuredClone(vertexFixture()); mutate(payload);
  expect(() => validatePreparedCssSurfaceShell(payload)).toThrow(TypeError);
});

test('validates the complete shell with strict compiled material and geometry fields', () => {
  const payload = fixture();
  expect(validatePreparedCssSurfaceShell(payload)).toEqual(payload);
  const exponential = { ...payload, faces: [{ ...payload.faces[0], style: { ...payload.faces[0]!.style, transform: 'matrix3d(1e0,0,0,0,0,+1,0,0,0,0,1,0,-1e-3,2.5,3,1)' } }] };
  expect(validatePreparedCssSurfaceShell(exponential).faces).toHaveLength(1);
});

test.each([
  ['missing key', (data: any) => { delete data.unitScale; }],
  ['extra top-level key', (data: any) => { data.shader = ''; }],
  ['nonpositive unit scale', (data: any) => { data.unitScale = 0; }],
  ['bad reference quaternion', (data: any) => { data.frame.localToReferenceXyzw = [0, 0, 0, 2]; }],
  ['nonfinite camera frame', (data: any) => { data.frame.originM[0] = Infinity; }],
  ['reversed distance gates', (data: any) => { data.visibility.fullUntilM = 200; }],
  ['nonfinite distance gate', (data: any) => { data.visibility.hiddenBeyondM = Infinity; }],
  ['extra visibility key', (data: any) => { data.visibility.focusRange = 1; }],
  ['empty faces', (data: any) => { data.faces = []; }],
  ['unbounded faces', (data: any) => { data.faces = Array(20_001).fill(data.faces[0]); }],
  ['duplicate face id', (data: any) => { data.faces[1].id = data.faces[0].id; }],
  ['nonfinite center', (data: any) => { data.faces[0].centerUnits[0] = NaN; }],
  ['nonunit geometric normal', (data: any) => { data.faces[0].faceNormal = [0, 0, 2]; }],
  ['nonunit radial normal', (data: any) => { data.faces[0].radialNormal = [0, 0, 0]; }],
  ['extra face key', (data: any) => { data.faces[0].texturePath = 'other.png'; }],
  ['invalid atlas step', (data: any) => { data.faces[0].atlasStepPixels[0] = -1; }],
  ['nonfinite atlas origin', (data: any) => { data.faces[0].atlasOriginPixels[0] = Infinity; }],
  ['runtime style property', (data: any) => { data.faces[0].style.opacity = '0.2'; }],
  ['runtime style expression', (data: any) => { data.faces[0].style.width = 'calc(10px + 1px)'; }],
  ['zero face dimension', (data: any) => { data.faces[0].style.height = '0px'; }],
  ['negative background size', (data: any) => { data.faces[0].style.backgroundSize = '-1px 1px'; }],
  ['runtime transform URL', (data: any) => { data.faces[0].style.transform = 'url(/generated.png)'; }],
  ['short matrix', (data: any) => { data.faces[0].style.transform = 'matrix3d(1,0,0,0)'; }],
  ['blank matrix element', (data: any) => { data.faces[0].style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,,2,3,1)'; }],
  ['non-numeric matrix element', (data: any) => { data.faces[0].style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,null,2,3,1)'; }],
  ['nonfinite matrix element', (data: any) => { data.faces[0].style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1e999,2,3,1)'; }],
  ['atlas path traversal', (data: any) => { data.atlas.path = '../rim.png'; data.resources[0].path = '../rim.png'; }],
  ['encoded atlas traversal', (data: any) => { data.atlas.path = '%2e%2e/rim.png'; data.resources[0].path = '%2e%2e/rim.png'; }],
  ['atlas external URL', (data: any) => { data.atlas.path = 'https://host/rim.png'; data.resources[0].path = data.atlas.path; }],
  ['atlas wrong format', (data: any) => { data.atlas.path = 'rim.svg'; data.resources[0].path = 'rim.svg'; }],
  ['missing atlas resource', (data: any) => { data.resources = []; }],
  ['resource mismatch', (data: any) => { data.resources[0].path = 'other.png'; }],
  ['invalid resource hash', (data: any) => { data.resources[0].sha256 = 'not-a-digest'; }],
  ['invalid resource byte length', (data: any) => { data.resources[0].bytes = 0; }],
  ['wrong atlas dimensions', (data: any) => { data.resources[0].height = 64; }],
  ['fractional atlas frame count', (data: any) => { data.atlas.frames = 1.5; }],
  ['missing provenance', (data: any) => { data.provenance = null; }],
] as const)('rejects %s', (_name, mutate) => {
  const payload = structuredClone(fixture()); mutate(payload);
  expect(() => validatePreparedCssSurfaceShell(payload)).toThrow(TypeError);
});

test('retains one transparent perspective scene and applies the prepared CSS verbatim', () => {
  const { payload, host, before, root, camera, scene, leaves, resolveResource } = mount();
  expect(host.children).toEqual([root, before]);
  expect(root.children).toHaveLength(1); expect(camera.children).toEqual([scene]);
  expect(leaves).toHaveLength(payload.faces.length);
  expect(root.style.transformStyle).toBe('flat'); expect(root.style.background).toBeUndefined();
  expect(camera.style.transformStyle).toBe('preserve-3d'); expect(scene.style.transformStyle).toBe('preserve-3d');
  expect(camera.style.opacity).toBeUndefined(); expect(scene.style.opacity).toBeUndefined();
  for (let index = 0; index < leaves.length; index++) {
    const leaf = leaves[index]!;
    expect(leaf.tagName).toBe('s'); expect(leaf.style).toMatchObject(payload.faces[index]!.style);
    expect(leaf.style.opacity).toBeUndefined(); expect(leaf.style.backgroundImage).toBe('url("/prepared/materials/rim.png")');
  }
  expect(resolveResource).toHaveBeenCalledExactlyOnceWith('materials/rim.png');
});

test('uses the shared physical camera transform, prepared scale, frame origin and rotation', () => {
  const { payload, runtime, root, camera, scene } = mount();
  const observer = world(payload, [3, 4, 6], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  runtime.publish(observer, viewport);
  const expected = preparedVolumeCameraTransform({ world: observer, viewport }, payload.frame, payload.unitScale);
  expect(scene.style.transform).toBe(`translate3d(${expected.translationCssPixels.map(value => `${Number(value.toFixed(6))}px`).join(',')}) ${worldRotationCss(expected.rotation)}`);
  expect(camera.style.perspective).toBe('600px'); expect(camera.style.perspectiveOrigin).toBe('calc(50% + 17px) calc(50% + -11px)');
  expect(runtime.stats().distanceM).toBeCloseTo(Math.sqrt(61) * 10, 10);
  expect(root.style.opacity).toBe('1');
});

test('distance visibility uses the local physical observer with exact endpoints and smoothstep fade', () => {
  const { payload, runtime, root } = mount();
  for (const [distance, opacity] of [[0, 0], [10, 0], [10.01, 1], [100, 1], [125, .84375], [150, .5], [175, .15625], [200, 0], [300, 0]]) {
    runtime.publish(world(payload, [0, 0, distance! / 10]), viewport);
    expect(runtime.stats().distanceM).toBeCloseTo(distance!, 10); expect(runtime.stats().opacity).toBeCloseTo(opacity!, 10);
    expect(root.style.visibility).toBe(opacity! > 0 ? 'visible' : 'hidden');
    if (opacity === 0) expect(runtime.stats().visibleFaces).toBe(0);
  }
});

test('culls by the true face normal while sampling and clamping radial-facing atlas frames', () => {
  const payload = { ...fixture(), faces: [face('rim', [0, 0, 0], [0, 0, 1], [1, 0, 0])] };
  const { runtime, leaves } = mount(payload), leaf = leaves[0]!;
  runtime.publish(world(payload, [-6, 0, 4]), viewport);
  expect(runtime.stats().visibleFaces).toBe(1); expect(leaf.dataset.shellFrame).toBe('0'); expect(leaf.style.backgroundPosition).toBe('2px -3px');
  runtime.publish(world(payload, [6, 0, 4]), viewport);
  expect(leaf.dataset.shellFrame).toBe('6'); expect(leaf.style.backgroundPosition).toBe('-38px -33px');
  runtime.publish(world(payload, [6, 0, -4]), viewport);
  expect(runtime.stats().visibleFaces).toBe(0); expect(leaf.style.visibility).toBe('hidden');
  runtime.publish(world(payload, [6, 0, .1]), viewport);
  expect(leaf.dataset.shellFrame).toBe('7'); expect(leaf.style.backgroundPosition).toBe('-58px -33px');
});

test('grazing geometric faces stay culled even when their radial normal faces the observer', () => {
  const payload = { ...fixture(), faces: [face('tangent', [0, 0, 0], [0, 0, 1], [1, 0, 0])] };
  const { runtime, leaves } = mount(payload);
  runtime.publish(world(payload, [6, 0, 0]), viewport);
  expect(runtime.stats().visibleFaces).toBe(0); expect(leaves[0]!.style.visibility).toBe('hidden');
});

test('camera updates retain every node and avoid repeated material and transform style writes', () => {
  const { payload, runtime, document, root, camera, scene, leaves, resolveResource } = mount();
  const nodes = [...leaves], created = document.created, observer = world(payload, [0, 0, 6]);
  runtime.publish(observer, viewport);
  const writes = [root, camera, scene, ...leaves].map(node => ({ ...node.writes }));
  runtime.publish(observer, viewport);
  expect([root, camera, scene, ...leaves].map(node => node.writes)).toEqual(writes);
  runtime.publish(world(payload, [0, 0, 7]), viewport);
  expect(leaves[0]!.writes.backgroundPosition).toBe(1); expect(scene.writes.transform).toBe(2);
  expect(document.created).toBe(created); expect(scene.children).toEqual(nodes); expect(resolveResource).toHaveBeenCalledTimes(1);
});

test('hidden distance publications skip all retained face reads and camera style work, then resume cleanly', () => {
  const { payload, runtime, root, camera, scene, leaves } = mount();
  runtime.publish(world(payload, [0, 0, 6]), viewport);
  const writes = [camera, scene, ...leaves].map(node => ({ ...node.writes }));
  const center = payload.faces[0]!.centerUnits;
  Object.defineProperty(payload.faces[0], 'centerUnits', { configurable: true, get() { throw new Error('Hidden shell read a face'); } });
  runtime.publish(world(payload, [0, 0, 6]), viewport, false);
  expect(runtime.stats()).toMatchObject({ visible: false, distanceM: 60, opacity: 0, visibleFaces: 0 });
  runtime.publish(world(payload, [0, 0, 0]), viewport);
  runtime.publish(world(payload, [0, 0, 30]), viewport);
  expect([camera, scene, ...leaves].map(node => node.writes)).toEqual(writes);
  expect(root.style.opacity).toBe('0'); expect(root.dataset).toMatchObject({ shellDistanceM: '300', shellVisibleFaces: '0', shellOpacity: '0' });
  Object.defineProperty(payload.faces[0], 'centerUnits', { configurable: true, value: center });
  runtime.publish(world(payload, [0, 0, 6]), viewport);
  expect(runtime.stats()).toMatchObject({ visible: true, visibleFaces: 1, opacity: 1 });
  expect(root.dataset).toMatchObject({ shellDistanceM: '60', shellVisibleFaces: '1', shellOpacity: '1' });
  expect(leaves[0]!.style.visibility).toBe('visible');
});

test('rejects incompatible publications before mutating DOM and destroys only its retained root', () => {
  const { payload, runtime, root, host, before } = mount();
  const observer = world(payload, [0, 0, 6]), snapshot = JSON.stringify(root.style);
  expect(() => runtime.publish({ ...observer, referenceFrame: 'other' }, viewport)).toThrow();
  expect(() => runtime.publish({ ...observer, epochJdTt: 124 }, viewport)).toThrow();
  expect(() => runtime.publish(observer, { ...viewport, focalPixels: Infinity })).toThrow();
  expect(() => runtime.publish(observer, { ...viewport, focalPixels: 0 })).toThrow();
  expect(JSON.stringify(root.style)).toBe(snapshot);
  runtime.publish(observer, viewport); runtime.destroy(); runtime.destroy();
  expect(host.children).toEqual([before]); expect(runtime.stats()).toMatchObject({ visible: false, visibleFaces: 0, opacity: 0 });
  const destroyedStyle = JSON.stringify(root.style); runtime.publish(world(payload, [0, 0, 7]), viewport);
  expect(JSON.stringify(root.style)).toBe(destroyedStyle);
});
