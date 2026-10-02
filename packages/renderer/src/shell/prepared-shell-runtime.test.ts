import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { worldRotationCss } from '@cssearth/engine';
import { validatePreparedCssSurfaceShell, type WorldCameraPose, type PreparedCssSurfaceShell } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { mountPreparedCssSurfaceShell } from './prepared-shell-runtime.js';

function fixture(): PreparedCssSurfaceShell {
  return {
    schema: 'cssearth-css-surface-shell@1', id: 'fixture', unitScale: 37,
    frame: { referenceFrame: 'fixture-frame', epochJdTt: 123, originM: [120, 300, -70], localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
      metersPerUnit: 10, boundsUnits: { min: [-2, -2, -2], max: [2, 2, 2] } },
    atlas: { path: 'materials/rim.png', tileSize: 16, columns: 4, frames: 8 },
    visibility: { hiddenInsideM: 10, fullUntilM: 100, hiddenBeyondM: 200 },
    faces: [face('near', [0, 0, 1], [0, 0, 1], [0, 0, 1]), face('far', [0, 0, -1], [0, 0, -1], [0, 0, -1])],
    resources: [{ path: 'materials/rim.png', bytes: 100, width: 64, height: 32 }], provenance: {},
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
  const resolveResource = mock.fn((path: string) => `/prepared/${path}`);
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
  assert.deepEqual(validatePreparedCssSurfaceShell(payload), payload);
  runtime.publish(world(payload, [6, 2, 4]), viewport);
  assert.equal(leaves[0]!.dataset.shellFrame, '17');
  assert.equal(leaves[0]!.style.transform, payload.faces[0]!.materialTransforms![3]);
  const writes = { ...leaves[0]!.writes };
  runtime.publish(world(payload, [6, 2, 4]), viewport);
  assert.deepEqual(leaves[0]!.writes, writes);
  runtime.publish(world(payload, [-6, 2, 4]), viewport);
  assert.equal(leaves[0]!.dataset.shellFrame, '7');
  assert.equal(leaves[0]!.style.transform, payload.faces[0]!.materialTransforms![0]);
  assert.equal(document.created, created); assert.equal(leaves.length, 1);
});

test('retains one transparent perspective scene and applies the prepared CSS verbatim', () => {
  const { payload, host, before, root, camera, scene, leaves, resolveResource } = mount();
  assert.deepEqual(host.children, [root, before]);
  assert.equal(root.children.length, 1); assert.deepEqual(camera.children, [scene]);
  assert.equal(leaves.length, payload.faces.length);
  assert.equal(root.style.transformStyle, 'flat'); assert.equal(root.style.background, undefined);
  assert.equal(camera.style.transformStyle, 'preserve-3d'); assert.equal(scene.style.transformStyle, 'preserve-3d');
  assert.equal(camera.style.opacity, undefined); assert.equal(scene.style.opacity, undefined);
  for (let index = 0; index < leaves.length; index++) {
    const leaf = leaves[index]!;
    assert.equal(leaf.tagName, 's'); assert.partialDeepStrictEqual(leaf.style, payload.faces[index]!.style);
    assert.equal(leaf.style.opacity, undefined); assert.equal(leaf.style.backgroundImage, 'url("/prepared/materials/rim.png")');
  }
  assert.equal(resolveResource.mock.callCount(), 1); assert.deepEqual(resolveResource.mock.calls[0]!.arguments, ['materials/rim.png']);
});

test('uses the shared physical camera transform, prepared scale, frame origin and rotation', () => {
  const { payload, runtime, root, camera, scene } = mount();
  const observer = world(payload, [3, 4, 6], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  runtime.publish(observer, viewport);
  const expected = preparedVolumeCameraTransform({ world: observer, viewport }, payload.frame, payload.unitScale);
  assert.equal(scene.style.transform, `translate3d(${expected.translationCssPixels.map(value => `${Number(value.toFixed(6))}px`).join(',')}) ${worldRotationCss(expected.rotation)}`);
  assert.equal(camera.style.perspective, '600px'); assert.equal(camera.style.perspectiveOrigin, 'calc(50% + 17px) calc(50% + -11px)');
  assert.ok(Math.abs(runtime.stats().distanceM - (Math.sqrt(61) * 10)) < 10 ** -10 / 2, `${runtime.stats().distanceM} is not close to ${Math.sqrt(61) * 10}`);
  assert.equal(root.style.opacity, '1');
});

test('distance visibility uses the local physical observer with exact endpoints and smoothstep fade', () => {
  const { payload, runtime, root } = mount();
  for (const [distance, opacity] of [[0, 0], [10, 0], [10.01, 1], [100, 1], [125, .84375], [150, .5], [175, .15625], [200, 0], [300, 0]]) {
    runtime.publish(world(payload, [0, 0, distance! / 10]), viewport);
    assert.ok(Math.abs(runtime.stats().distanceM - (distance!)) < 10 ** -10 / 2, `${runtime.stats().distanceM} is not close to ${distance!}`); assert.ok(Math.abs(runtime.stats().opacity - (opacity!)) < 10 ** -10 / 2, `${runtime.stats().opacity} is not close to ${opacity!}`);
    assert.equal(root.style.visibility, opacity! > 0 ? 'visible' : 'hidden');
    if (opacity === 0) assert.equal(runtime.stats().visibleFaces, 0);
  }
});

test('culls by the true face normal while sampling and clamping radial-facing atlas frames', () => {
  const payload = { ...fixture(), faces: [face('rim', [0, 0, 0], [0, 0, 1], [1, 0, 0])] };
  const { runtime, leaves } = mount(payload), leaf = leaves[0]!;
  runtime.publish(world(payload, [-6, 0, 4]), viewport);
  assert.equal(runtime.stats().visibleFaces, 1); assert.equal(leaf.dataset.shellFrame, '0'); assert.equal(leaf.style.backgroundPosition, '2px -3px');
  runtime.publish(world(payload, [6, 0, 4]), viewport);
  assert.equal(leaf.dataset.shellFrame, '6'); assert.equal(leaf.style.backgroundPosition, '-38px -33px');
  runtime.publish(world(payload, [6, 0, -4]), viewport);
  assert.equal(runtime.stats().visibleFaces, 0); assert.equal(leaf.style.visibility, 'hidden');
  runtime.publish(world(payload, [6, 0, .1]), viewport);
  assert.equal(leaf.dataset.shellFrame, '7'); assert.equal(leaf.style.backgroundPosition, '-58px -33px');
});

test('grazing geometric faces stay culled even when their radial normal faces the observer', () => {
  const payload = { ...fixture(), faces: [face('tangent', [0, 0, 0], [0, 0, 1], [1, 0, 0])] };
  const { runtime, leaves } = mount(payload);
  runtime.publish(world(payload, [6, 0, 0]), viewport);
  assert.equal(runtime.stats().visibleFaces, 0); assert.equal(leaves[0]!.style.visibility, 'hidden');
});

test('camera updates retain every node and avoid repeated material and transform style writes', () => {
  const { payload, runtime, document, root, camera, scene, leaves, resolveResource } = mount();
  const nodes = [...leaves], created = document.created, observer = world(payload, [0, 0, 6]);
  runtime.publish(observer, viewport);
  const writes = [root, camera, scene, ...leaves].map(node => ({ ...node.writes }));
  runtime.publish(observer, viewport);
  assert.deepEqual([root, camera, scene, ...leaves].map(node => node.writes), writes);
  runtime.publish(world(payload, [0, 0, 7]), viewport);
  assert.equal(leaves[0]!.writes.backgroundPosition, 1); assert.equal(scene.writes.transform, 2);
  assert.equal(document.created, created); assert.deepEqual(scene.children, nodes); assert.equal(resolveResource.mock.callCount(), 1);
});

test('hidden distance publications skip all retained face reads and camera style work, then resume cleanly', () => {
  const { payload, runtime, root, camera, scene, leaves } = mount();
  runtime.publish(world(payload, [0, 0, 6]), viewport);
  const writes = [camera, scene, ...leaves].map(node => ({ ...node.writes }));
  const center = payload.faces[0]!.centerUnits;
  Object.defineProperty(payload.faces[0], 'centerUnits', { configurable: true, get() { throw new Error('Hidden shell read a face'); } });
  runtime.publish(world(payload, [0, 0, 6]), viewport, false);
  assert.partialDeepStrictEqual(runtime.stats(), { visible: false, distanceM: 60, opacity: 0, visibleFaces: 0 });
  runtime.publish(world(payload, [0, 0, 0]), viewport);
  runtime.publish(world(payload, [0, 0, 30]), viewport);
  assert.deepEqual([camera, scene, ...leaves].map(node => node.writes), writes);
  assert.equal(root.style.opacity, '0'); assert.partialDeepStrictEqual(runtime.stats(), { distanceM: 300, visibleFaces: 0, opacity: 0 });
  Object.defineProperty(payload.faces[0], 'centerUnits', { configurable: true, value: center });
  runtime.publish(world(payload, [0, 0, 6]), viewport);
  assert.partialDeepStrictEqual(runtime.stats(), { visible: true, visibleFaces: 1, opacity: 1 });
  assert.partialDeepStrictEqual(runtime.stats(), { distanceM: 60, visibleFaces: 1, opacity: 1 });
  assert.equal(leaves[0]!.style.visibility, 'visible');
});

test('rejects incompatible publications before mutating DOM and destroys only its retained root', () => {
  const { payload, runtime, root, host, before } = mount();
  const observer = world(payload, [0, 0, 6]), snapshot = JSON.stringify(root.style);
  assert.throws(() => runtime.publish({ ...observer, referenceFrame: 'other' }, viewport));
  assert.throws(() => runtime.publish({ ...observer, epochJdTt: 124 }, viewport));
  assert.throws(() => runtime.publish(observer, { ...viewport, focalPixels: Infinity }));
  assert.throws(() => runtime.publish(observer, { ...viewport, focalPixels: 0 }));
  assert.equal(JSON.stringify(root.style), snapshot);
  runtime.publish(observer, viewport); runtime.destroy(); runtime.destroy();
  assert.deepEqual(host.children, [before]); assert.partialDeepStrictEqual(runtime.stats(), { visible: false, visibleFaces: 0, opacity: 0 });
  const destroyedStyle = JSON.stringify(root.style); runtime.publish(world(payload, [0, 0, 7]), viewport);
  assert.equal(JSON.stringify(root.style), destroyedStyle);
});

test('a shell its setting turns off leaves the document, and returns in place when turned on', () => {
  const payload = fixture(), { runtime, host, before, root } = mount(payload);
  runtime.publish(world(payload, [6, 2, 4]), viewport);
  assert.deepEqual(host.children, [root, before]);
  runtime.publish(world(payload, [6, 2, 4]), viewport, false);
  assert.deepEqual(host.children, [before]);
  assert.equal(runtime.stats().visible, false);
  runtime.publish(world(payload, [6, 2, 4]), viewport);
  assert.deepEqual(host.children, [root, before]);
});
