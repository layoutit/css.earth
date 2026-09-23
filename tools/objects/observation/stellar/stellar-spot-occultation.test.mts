import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
import { hostedOrbit } from '@cssearth/astronomy';
import { addSpotOccultationToLimbPlate, parseSpotOccultation, spotDiscCentre } from './stellar-spot-occultation.mts';
const test = sourceTest();

const source = new URL('../../../../src/objects/hd-189733/source/photometry/haris-2025-spot-occultation.json', import.meta.url);
const transcript = JSON.parse(await readFile(source, 'utf8'));
const event = parseSpotOccultation(transcript);
const orbit = hostedOrbit('hd-189733b');

test('Table 3 transit 2165 locates a dark region on the visible transit chord', () => {
  assert.deepEqual([event.transitIndex, event.midEventOffsetSeconds, event.minimumAngularRadiusDegrees, event.contrast], [2165, 1890, 5, 0.076]);
  assert.deepEqual(transcript.event.minimumAngularRadiusUncertaintyDegrees, { lower: 0.8, upper: 1.0 });
  assert.deepEqual(transcript.event.contrastUncertainty, { lower: 0.025, upper: 0.041 });
  const centre = spotDiscCentre(event, orbit);
  // Independent circular-orbit calculation: phase from elapsed time, impact parameter from a cos(i).
  const expectedX = 8.86287385036163 * Math.sin(2 * Math.PI * 1890 / (2.21857567 * 86400));
  const expectedY = 8.86287385036163 * Math.cos(85.71 * Math.PI / 180) * Math.cos(2 * Math.PI * 1890 / (2.21857567 * 86400));
  assert.ok(Math.abs(centre.x - expectedX) < 1e-12 && Math.abs(centre.y - expectedY) < 1e-12);
  assert.ok(centre.x > 0.5 && centre.x < 0.6 && centre.y > 0.6 && centre.y < 0.7);
  assert.ok(centre.z > 0, 'the event is on the visible hemisphere');
});

test('one minimum-size cap darkens only its source region without changing the limb silhouette', () => {
  const size = 512, base = new Uint8Array(size * size * 4);
  const out = addSpotOccultationToLimbPlate({ data: base, size, lossless: true }, event, orbit);
  const centre = spotDiscCentre(event, orbit);
  const pixel = (x: number, y: number) => 4 * (Math.floor(y) * size + Math.floor(x)) + 3;
  const mid = pixel(size / 2 * (1 + centre.x), size / 2 * (1 - centre.y));
  assert.ok(Math.abs(out.data[mid]! / 255 - 0.076) < 1 / 255, 'centre has the published TESS contrast');
  assert.equal(out.data[pixel(size / 2, size / 2)], 0, 'unobserved disc centre stays unchanged');
  assert.equal(out.data[3], 0, 'outside the disc stays transparent');
  assert.equal(base[mid], 0, 'input plate is not mutated');
  const changed = out.data.filter((value, index) => index % 4 === 3 && value > 0).length;
  assert.ok(changed > 50 && changed < 0.005 * Math.PI * (size / 2) ** 2, `the 5-degree cap affects under 0.5% of the disc: ${changed} texels`);
});

test('invalid spot measurements fail before rendering', () => {
  assert.throws(() => parseSpotOccultation({ schema: 'cssearth-spot-occultation@1', source: 'x', event: { ...event, contrast: 1 } }), /invalid/u);
  assert.throws(() => spotDiscCentre({ ...event, midEventOffsetSeconds: 10000 }, orbit), /outside/u);
});
