import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { Vector3 } from '@cssearth/renderer/solar-system/types.ts';
import { LIT_DEFAULT_VIEW, LOPSIDED_COVERAGE, openingDirection, prepareDefaultCameraAngles, prepareFacingCameraAngles } from './default-camera.mts';
import { detectMissingCoverage, missingCoverageColor } from './prepare-missing-coverage.mts';

const distance = (a: Vector3, b: Vector3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const point = (longitude: number, latitude: number) => { const l = longitude * Math.PI / 180, b = latitude * Math.PI / 180; return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)] as unknown as Vector3; };

test('the opening direction is the inverse of facing a direction', () => {
  for (const [id, target] of [['triton', point(-179, -16)], ['pluto', point(146.5, 43.2)], ['titania', point(10, 60)]] as const) {
    assert.ok(distance(openingDirection(id, prepareFacingCameraAngles(id, target)), target) < 1e-12, id);
  }
});

test('a lopsided map turns the design tilt toward its data, on the south side when the data is south of the ecliptic', () => {
  const tilt = Math.abs(LIT_DEFAULT_VIEW.initialScenePitchDegrees);
  // Triton's Voyager data centre lies south of the ecliptic; a map centre north of it keeps the northern tilt.
  for (const [id, centre, pitch] of [['triton', point(-179, -16), tilt], ['triton', point(-179, 60), -tilt]] as const) {
    const coverage = centre.map(value => value * 0.7) as unknown as Vector3;
    const angles = prepareDefaultCameraAngles(id, { coverage });
    assert.equal(angles.initialScenePitchDegrees, pitch, `${id} ${centre}`);
    assert.equal(angles.defaultControlYawDegrees, prepareFacingCameraAngles(id, centre).defaultControlYawDegrees);
  }
});

test('a map complete enough to have no data side keeps the design pose, and a photograph still outranks coverage', () => {
  const nearlyEven = point(131, -6).map(value => value * (LOPSIDED_COVERAGE - 0.01)) as unknown as Vector3;
  assert.deepEqual(prepareDefaultCameraAngles('moon', { coverage: nearlyEven }), LIT_DEFAULT_VIEW);
  const photograph = point(146.5, 43.2);
  assert.deepEqual(prepareDefaultCameraAngles('pluto', { observation: [photograph], coverage: point(-30, -10) }), prepareFacingCameraAngles('pluto', photograph));
});

test('the painted gap is found in a noisy copy, and a gray surface of the same tone is not', () => {
  // The minimaps this reads are 640 × 320.
  const width = 640, height = 320, channels = 3, data = new Uint8Array(width * height * channels);
  let seed = 7; const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return Math.round((seed / 2147483648 - 0.5) * 8); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // West half: the painted gap. East half: a flat surface at the gap's own base tone, as a gray moon can be.
    const color = x < width / 2 ? missingCoverageColor((x + 0.5) * 360 / width, 90 - (y + 0.5) * 180 / height, 180 / height) : [82, 84, 82];
    for (let c = 0; c < channels; c++) data[(y * width + x) * channels + c] = Math.max(0, Math.min(255, color[c]! + noise()));
  }
  const missing = detectMissingCoverage(data, { width, height, channels });
  // By area, as the camera rule weighs coverage. A polar cap has no meridians to split it, so this map's half-painted caps
  // stay whole and are left out.
  let west = 0, east = 0, half = 0;
  for (let y = 0; y < height; y++) {
    const latitude = 90 - (y + 0.5) * 180 / height, area = Math.cos(latitude * Math.PI / 180);
    if (Math.abs(latitude) >= 80) continue;
    for (let x = 0; x < width; x++) {
      if (x < width / 2) half += area;
      if (missing[y * width + x]) { if (x < width / 2) west += area; else east += area; }
    }
  }
  assert.ok(west / half > 0.99, `gap found over ${(west / half * 100).toFixed(1)}% of its area`);
  assert.ok(east / half < 0.01, `surface taken for gap over ${(east / half * 100).toFixed(1)}% of its area`);
});
