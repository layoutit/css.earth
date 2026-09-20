import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeCloudCamera, shapeCloudOrthographicCamera } from '@cssearth/nebula-lab/adapters/viewer/shape-cloud-camera';
import { compilerRenderer } from './compiler-renderer.ts';
import { physicalLabBank, physicalLabFrame, volumeRenderer } from './volume-renderer.ts';
import { preparedVolumeCameraTransform } from '../../../../../../../src/renderers/css/volume/prepared-volume-runtime.js';
import type { PreparedCssVolume, VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types.js';

const frame: PreparedCssVolume['frame'] = { referenceFrame: 'lab-sky-west-north-toward', epochJdTt: 2451545, originM: [0, 0, 0],
  localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-5, -5, -5], max: [5, 5, 5] } };
const image = { width: 768, height: 534, unitsPerPixel: 10 / 768 };
function project(publication: VolumeCameraPublication, pixel: [number, number], z = 0): [number, number] {
  const { rotation: r, translationCssPixels: t, focalPixels } = preparedVolumeCameraTransform(publication, frame);
  // The prepared PolyCSS coordinate convention is [physical y, physical x, physical z].
  const point = [(image.height / 2 - pixel[1]) * image.unitsPerPixel * 50, (pixel[0] - image.width / 2) * image.unitsPerPixel * 50, -z * 50];
  const eye = [0, 1, 2].map(row => r[row * 3]! * point[0]! + r[row * 3 + 1]! * point[1]! + r[row * 3 + 2]! * point[2]! + t[row]!);
  const [px, py] = publication.viewport.principalOffsetPixels;
  return [publication.viewport.widthPixels! / 2 + px + (eye[0]! - px) * focalPixels / (focalPixels - eye[2]!),
    publication.viewport.heightPixels! / 2 + py + (eye[1]! - py) * focalPixels / (focalPixels - eye[2]!)];
}

test('Earth projection matches the source pixel edges, handedness, pan, zoom and resized fit', () => {
  for (const viewport of [{ width: 900, height: 650 }, { width: 500, height: 900 }]) {
    for (const zoom of [.5, 1, 2]) {
      const framing = { zoom, panX: 27, panY: -18 };
      const camera = shapeCloudCamera(frame, image, viewport, framing, 0, 0);
      const scale = Math.min(viewport.width / image.width, viewport.height / image.height) * .94 * zoom;
      for (const pixel of [[0, 0], [768, 0], [0, 534], [768, 534], [384, 267], [213, 421]] as [number, number][]) {
        const actual = project(camera, pixel);
        const expected = [viewport.width / 2 + framing.panX + (pixel[0] - image.width / 2) * scale,
          viewport.height / 2 + framing.panY + (pixel[1] - image.height / 2) * scale];
        assert.ok(Math.hypot(actual[0] - expected[0]!, actual[1] - expected[1]!) < 1e-6);
      }
    }
  }
});

test('posed cloud stays centered, camera orientation is proper, and ordinary-depth parallax is below 0.05 pixels', () => {
  const framing = { zoom: 1, panX: 0, panY: 0 }, viewport = { width: 900, height: 650 };
  for (const [yaw, pitch] of [[0, 0], [35, 27], [90, 0], [0, -90], [170, 80]]) {
    const camera = shapeCloudCamera(frame, image, viewport, framing, yaw!, pitch!);
    assert.ok(Math.abs(Math.hypot(...camera.world.pose.orientationXyzw) - 1) < 1e-9);
    const center = project(camera, [384, 267]);
    assert.ok(Math.hypot(center[0] - viewport.width / 2, center[1] - viewport.height / 2) < 1e-6);
  }
  const camera = shapeCloudCamera(frame, image, viewport, framing, 0, 0);
  const front = project(camera, [0, 0]);
  for (const depth of [-5, 5]) {
    const offset = project(camera, [0, 0], depth);
    assert.ok(Math.hypot(offset[0] - front[0], offset[1] - front[1]) < .05);
  }
  assert.throws(() => shapeCloudCamera(frame, image, viewport, { ...framing, zoom: 0 }, 0, 0), /positive extents/);
});

test('prepared compact lights and slab geometry share the same physical camera projection', () => {
  const viewport = { width: 900, height: 650 }, framing = { zoom: 1, panX: 21, panY: -17 };
  for (const [yaw, pitch] of [[0, 0], [35, 27], [90, 0], [0, -89]]) {
    const camera = shapeCloudCamera(frame, image, viewport, framing, yaw!, pitch!);
    const stars = compilerRenderer.starProjection(camera, frame, viewport);
    for (const pixel of [[160, 170], [530, 390]] as [number, number][]) {
      const point = [(pixel[0] - image.width / 2) * image.unitsPerPixel,
        (image.height / 2 - pixel[1]) * image.unitsPerPixel, -1];
      const star = stars.project(point), volume = project(camera, pixel, -point[2]!);
      assert.ok(Math.hypot(star.x + viewport.width / 2 - volume[0], star.y + viewport.height / 2 - volume[1]) < 1e-6);
    }
  }
});

test('true orthographic CSS transport keeps exact image projection at every depth without large CSS translations', () => {
  const viewport = { width: 900, height: 650 }, framing = { zoom: 2.5, panX: 21, panY: -17 };
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height) * .94 * framing.zoom;
  for (const [yaw, pitch] of [[0, 0], [30, 0], [45, 0], [90, 0], [45, 35], [-60, -35]]) {
    const camera = shapeCloudOrthographicCamera(frame, image, viewport, framing, yaw!, pitch!);
    assert.ok(camera.transform.startsWith('translate3d(21px,-17px,0px)'));
    const cy = Math.cos(yaw! * Math.PI / 180), sy = Math.sin(yaw! * Math.PI / 180);
    const cx = Math.cos(pitch! * Math.PI / 180), sx = Math.sin(pitch! * Math.PI / 180);
    for (const z of [-5, 0, 5]) for (const [px, py] of [[0, 0], [768, 534], [213, 421]]) {
      const x = (px! - image.width / 2) * image.unitsPerPixel, y = (image.height / 2 - py!) * image.unitsPerPixel;
      const point = [y * 50, x * 50, -z * 50], r = camera.rotation;
      const actual = [0, 1].map(row => (r[row * 3]! * point[0]! + r[row * 3 + 1]! * point[1]! + r[row * 3 + 2]! * point[2]!) * camera.scale);
      const expected = [(cy * x - sy * z) * fit / image.unitsPerPixel, (sx * sy * x - cx * y + sx * cy * z) * fit / image.unitsPerPixel];
      assert.ok(Math.hypot(actual[0]! - expected[0]!, actual[1]! - expected[1]!) < 1e-9);
    }
  }
});

test('negative source-away depth is nearer and magnifies more than positive source-away depth', () => {
  const viewport = { width: 900, height: 650 }, framing = { zoom: 1, panX: 0, panY: 0 };
  const camera = shapeCloudCamera(frame, image, viewport, framing, 0, 0);
  assert.ok(camera.world.pose.positionM[2] > 0, 'The physical toward-axis observer must lie at positive local Z.');
  const radius = (sourceAway: number) => {
    const point = project(camera, [160, 170], sourceAway);
    return Math.hypot(point[0] - viewport.width / 2, point[1] - viewport.height / 2);
  };
  assert.ok(radius(-5) > radius(0) && radius(0) > radius(5), 'Near source points must magnify more; this is independent of legacy camera formulas.');
});

test('historical compiler banks transport retained source depth once and agree with their stars', () => {
  const oldFrame = { ...frame, referenceFrame: 'lab-sky-angular' };
  const bank: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: 'old', frame: oldFrame, anchors: [],
    resources: [], provenance: {}, approximation: {}, stacks: [{ axis: 'z', leaves: [{ id: 'near', centerUnits: [1, 2, -3],
      texturePath: 'pinned.png', widthPx: 1, heightPx: 1, boundsCssPixels: { min: [1, 2, -151], max: [3, 4, -149] },
      style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,100,50,-150,1)',
        backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] }] };
  const before = structuredClone(bank), actual = physicalLabBank(bank);
  assert.deepEqual(bank, before);
  assert.deepEqual(actual.stacks[0]!.leaves[0]!.centerUnits, [1, 2, 3]);
  assert.equal(actual.frame.referenceFrame, 'lab-sky-west-north-toward');
  assert.match(actual.stacks[0]!.leaves[0]!.style.transform, /100,50,150,1\)$/);
  assert.equal(physicalLabBank({ ...bank, frame }).stacks, bank.stacks, 'New prepared geometry must not reflect again.');
  const viewport = { width: 900, height: 650 }, framing = { zoom: 1, panX: 0, panY: 0 };
  const oldCamera = compilerRenderer.camera(oldFrame, image, viewport, framing, 35, 27).publication;
  const newCamera = compilerRenderer.camera(frame, image, viewport, framing, 35, 27).publication;
  assert.equal(oldCamera.world.referenceFrame, actual.frame.referenceFrame);
  assert.doesNotThrow(() => preparedVolumeCameraTransform(oldCamera, actual.frame));
  const historical = compilerRenderer.starProjection(oldCamera, oldFrame, viewport).project([1, 2, -3]);
  const current = compilerRenderer.starProjection(newCamera, frame, viewport).project([1, 2, 3]);
  assert.deepEqual(historical, current);
});

test('legacy Shapes and Joint-fit share the angular-to-physical mount and camera boundary', () => {
  for (const referenceFrame of ['lab-sky-angular', 'lab-image-relative-unscaled']) {
    const source = { ...frame, referenceFrame, boundsUnits: { min: [-1, -2, -3] as const, max: [4, 5, 6] as const } };
    const actual = physicalLabFrame(source);
    assert.deepEqual(actual.boundsUnits, { min: [-1, -2, -6], max: [4, 5, 3] });
    const camera = volumeRenderer.camera(source, image, { width: 900, height: 650 }, { zoom: 1, panX: 0, panY: 0 }, 35, 27);
    assert.equal(camera.publication.world.referenceFrame, actual.referenceFrame);
    assert.doesNotThrow(() => preparedVolumeCameraTransform(camera.publication, actual));
    assert.equal(source.referenceFrame, referenceFrame, 'Historical receipts stay unchanged.');
  }
});
