import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeCloudCamera, shapeCloudOrthographicCamera } from '@cssearth/nebula-lab/adapters/viewer/shape-cloud-camera';
import { preparedVolumeCameraTransform } from '../../../../../../../src/renderers/css/volume/prepared-volume-runtime.js';
import type { PreparedCssVolume, VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types.js';

const frame: PreparedCssVolume['frame'] = { referenceFrame: 'lab', epochJdTt: 2451545, originM: [0, 0, 0],
  localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-5, -5, -5], max: [5, 5, 5] } };
const image = { width: 768, height: 534, unitsPerPixel: 10 / 768 };
function project(publication: VolumeCameraPublication, pixel: [number, number], z = 0): [number, number] {
  const { rotation: r, translationCssPixels: t, focalPixels } = preparedVolumeCameraTransform(publication, frame);
  // The prepared PolyCSS coordinate convention is [physical y, physical x, physical z].
  const point = [(image.height / 2 - pixel[1]) * image.unitsPerPixel * 50, (pixel[0] - image.width / 2) * image.unitsPerPixel * 50, z * 50];
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
      const point = [y * 50, x * 50, z * 50], r = camera.rotation;
      const actual = [0, 1].map(row => (r[row * 3]! * point[0]! + r[row * 3 + 1]! * point[1]! + r[row * 3 + 2]! * point[2]!) * camera.scale);
      const expected = [(cy * x - sy * z) * fit / image.unitsPerPixel, (sx * sy * x - cx * y + sx * cy * z) * fit / image.unitsPerPixel];
      assert.ok(Math.hypot(actual[0]! - expected[0]!, actual[1]! - expected[1]!) < 1e-9);
    }
  }
});
