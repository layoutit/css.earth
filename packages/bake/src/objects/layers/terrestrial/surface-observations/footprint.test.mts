import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSkyField } from './footprint.ts';
import type { ObservationImage } from './contract.ts';

// An 8 x 8 sky field that rises one unit a column and ten a row, seen from far along +z: a point's column and row are its x and y
// plus 3.5, so a sphere of radius 3 about the origin covers the columns and rows from 0.5 to 6.5.
const width = 8, height = 8, values = Float64Array.from({ length: width * height }, (_, i) => i % width + 10 * Math.floor(i / width));
const image = (rejected: readonly number[] = []): ObservationImage => ({ width, height, values, startTime: '2020-02-08T00:00:00', filter: 'L',
  reject: i => rejected.includes(i) ? 'background' : null, report: {} });
const camera = { project: (point: readonly number[]) => [point[0]! + 3.5, point[1]! + 3.5, 1e12 - point[2]!], positionMeters: [0, 0, 1e12] };
const photometry = { gain: () => 1, retainsIllumination: true };
const onSphere = (emissionDegrees: number) => { const e = emissionDegrees * Math.PI / 180, normal = [Math.sin(e), 0, Math.cos(e)]; return { normal, point: normal.map(n => 3 * n) }; };

test('a point near the limb takes the field at its own place, though a pixel beside it lies off the body', () => {
  // At 80 degrees the point projects to column 6.454; column 7 is 3.5 from the centre, outside the radius-3 silhouette.
  const { point, normal } = onSphere(80), sample = sampleSkyField({ image: image(), camera, photometry }, point, normal, { maximumEmissionDegrees: 88 });
  assert.equal(sample.reason, undefined);
  assert.ok(Math.abs(sample.radiance! - (point[0]! + 3.5 + 35)) < 1e-9, `${sample.radiance}`);
  assert.ok(Math.abs(sample.maximumEmissionDegrees! - 80) < 1e-6);
  assert.equal(sample.gain, 1);
});

test('the point itself is held to the emission limit, and the far side is never sampled', () => {
  const { point, normal } = onSphere(80);
  assert.deepEqual(sampleSkyField({ image: image(), camera, photometry }, point, normal, { maximumEmissionDegrees: 70 }), { reason: 'grazing' });
  const behind = onSphere(120);
  assert.deepEqual(sampleSkyField({ image: image(), camera, photometry }, behind.point, behind.normal, { maximumEmissionDegrees: 88 }), { reason: 'grazing' });
});

test('pixels the archive withholds do not contribute, and a sample with under half its weight left is refused for their reason', () => {
  const { point, normal } = onSphere(80), row = 3 * width;
  // The point sits at column 6.454, row 3.5: columns 6 and 7 of rows 3 and 4. Withholding column 6 leaves 0.454 of the weight.
  assert.deepEqual(sampleSkyField({ image: image([row + 6, row + width + 6]), camera, photometry }, point, normal, { maximumEmissionDegrees: 88 }), { reason: 'background' });
  // Withholding column 7 leaves 0.546 of it, and the sample is the field along column 6.
  const kept = sampleSkyField({ image: image([row + 7, row + width + 7]), camera, photometry }, point, normal, { maximumEmissionDegrees: 88 });
  assert.ok(Math.abs(kept.radiance! - (6 + 35)) < 1e-9, `${kept.radiance}`);
  assert.deepEqual(sampleSkyField({ image: image(), camera, photometry: { ...photometry, gain: () => null } }, point, normal, { maximumEmissionDegrees: 88 }), { reason: 'photometry' });
});
