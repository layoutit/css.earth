import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { offLimbPlate } from './off-limb-plate.mts';

// A 64 px frame: a disc of radius 10 px at (32, 32) with value 1, a halo ring out to 20 px at value 0.2, a marker blob of value 0.5
// straight above the disc (north), and background 0 elsewhere.
const width = 64, height = 64, values = new Float64Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
  values[y * width + x] = r <= 10 ? 1 : r <= 20 ? 0.2 : 0;
  if (Math.hypot(x + 0.5 - 32, y + 0.5 - 6) <= 2) values[y * width + x] = 0.5;
}
const source = { width, height, values, center: [32, 32] as const, discRadiusPx: 10, backgroundMaximum: 1e-3 };
const display = { low: 0.4, high: 1, palette: ['#000000', '#ffffff'], rotationDegrees: 0 };
const pixel = (data: Uint8Array, size: number, x: number, y: number) => [...data.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];

test('the plate registers the disc to the body diameter and fades with the light', () => {
  const size = 400, plate = offLimbPlate(source, display, size, 100);
  // Disc centre: value 1 is at the top of the stretch, opaque white.
  assert.deepEqual(pixel(plate, size, 200, 200), [255, 255, 255, 255]);
  // 15 frame px out = 75 plate px: halo at 0.2, below the stretch's low, so the darkest colour, alpha (0.2 - 0.001) / (0.4 - 0.001).
  const halo = pixel(plate, size, 200 + 75, 200);
  assert.deepEqual(halo.slice(0, 3), [0, 0, 0]); assert.ok(Math.abs(halo[3]! - Math.round(255 * 0.199 / 0.399)) <= 1, `halo alpha ${halo[3]}`);
  // 25 frame px out to the right = 125 plate px: background, transparent.
  assert.equal(pixel(plate, size, 200 + 125, 200)[3], 0);
  // The disc's edge sits at the body radius: 10 frame px = 50 plate px.
  assert.equal(pixel(plate, size, 200 + 48, 200)[3], 255); assert.ok(pixel(plate, size, 200 + 52, 200)[3]! < 255);
});

test('a positive rotation turns image-up counterclockwise on the y-down screen', () => {
  const size = 400, bodyDiameter = 100;
  // Marker 26 frame px above the centre = 130 plate px; unrotated it sits straight up.
  const up = offLimbPlate(source, display, size, bodyDiameter);
  assert.ok(pixel(up, size, 200, 200 - 130)[3]! > 0, 'marker above the centre');
  // Rotated 90 degrees counterclockwise the marker moves to the left.
  const left = offLimbPlate(source, { ...display, rotationDegrees: 90 }, size, bodyDiameter);
  assert.ok(pixel(left, size, 200 - 130, 200)[3]! > 0, 'marker left of the centre'); assert.equal(pixel(left, size, 200, 200 - 130)[3], 0);
  assert.throws(() => offLimbPlate(source, { ...display, low: 0 }, size, bodyDiameter), /display stretch/);
});
