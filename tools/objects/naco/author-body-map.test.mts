import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { cropAroundBrightest, nacoSkyRegistration, relativeIntensity } from './author-body-map.mts';

const header = { CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CD1_1: -0.00000368611, CD1_2: 0, CD2_1: 0, CD2_2: 0.00000368611, 'ESO ADA POSANG': 0 };

test('the NACO adapter recovers one sky orientation only from agreeing raw WCS headers', () => {
  assert.ok(Math.abs(nacoSkyRegistration([header, { ...header }]).arcsecPerPixel - 0.013269996) < 1e-12);
  assert.throws(() => nacoSkyRegistration([header, { ...header, CD1_2: 0.000001 }]), /do not share/u);
  assert.throws(() => nacoSkyRegistration([header, { ...header, 'ESO ADA POSANG': 10 }]), /do not share/u);
});

test('the NACO adapter crops the resolved source and states its relative-intensity noise', () => {
  const width = 101, height = 99, image = new Float64Array(width * height).fill(10);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) image[y * width + x] += (x + y) % 2 ? 1 : -1;
  for (let y = 40; y <= 58; y++) for (let x = 42; x <= 60; x++) if (Math.hypot(x - 51, y - 49) <= 9) image[y * width + x] += 100;
  const crop = cropAroundBrightest(image, width, height, 9);
  assert.deepEqual([crop.width, crop.height], [55, 55]);
  const relative = relativeIntensity(crop, 9);
  assert.ok(Math.abs(relative.background - 10) <= 1);
  assert.ok(relative.sigma > 2 && relative.sigma < 4);
  assert.ok(Math.abs(relative.values[crop.brightest[1] * crop.width + crop.brightest[0]] - 1) < 0.02);
  assert.ok(relative.uncertainty[0] > 0);
});
